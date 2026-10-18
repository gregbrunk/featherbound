// EPUB 2/3 parser: container -> OPF (metadata, manifest, spine, cover) -> TOC -> Blocks.
import { posix } from 'node:path';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { parse as parseHtml, HTMLElement, NodeType, type Node as HtmlNode } from 'node-html-parser';
import { buildSections, escapeHtml, htmlToText, stableId, type SectionDraft } from './sections';
import type { Block, ParsedImage, ParsedMetadata, ParseResult } from './types';

// --- XML helpers ---------------------------------------------------------------------------

const ARRAY_TAGS = new Set([
  'rootfile', 'item', 'itemref', 'meta', 'title', 'creator', 'subject', 'identifier', 'language',
  'publisher', 'description', 'navPoint', 'EncryptedData', 'reference',
]);

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

// fast-xml-parser output is untyped JSON.
type X = Record<string, unknown>;

function arr(v: unknown): X[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).filter((x) => x != null).map((x) => (typeof x === 'object' ? (x as X) : { '#text': String(x) }));
}

function obj(v: unknown): X | undefined {
  const first = Array.isArray(v) ? v[0] : v;
  return first && typeof first === 'object' ? (first as X) : undefined;
}

function text(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') return text((v as X)['#text']);
  return '';
}

function attr(v: X | undefined, name: string): string {
  const a = v?.[`@_${name}`];
  return a == null ? '' : String(a).trim();
}

// --- Paths -----------------------------------------------------------------------------------

function resolveHref(baseFile: string, href: string): { path: string; anchor?: string } {
  const [rawPath, rawAnchor] = href.split('#', 2);
  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    // keep the raw path
  }
  const path = decoded ? posix.normalize(posix.join(posix.dirname(baseFile), decoded)).replace(/^(\.\/)+/, '') : baseFile;
  let anchor: string | undefined;
  if (rawAnchor) {
    try {
      anchor = decodeURIComponent(rawAnchor);
    } catch {
      anchor = rawAnchor;
    }
  }
  return { path, anchor };
}

function isExternal(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

const MEDIA_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
};

function mediaTypeFor(path: string, manifestType?: string): string {
  if (manifestType) return manifestType;
  return MEDIA_BY_EXT[posix.extname(path).slice(1).toLowerCase()] ?? 'application/octet-stream';
}

// --- DRM -------------------------------------------------------------------------------------

const FONT_OBFUSCATION = new Set(['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC']);
const FONT_EXT = /\.(?:ttf|otf|woff2?|eot|pfb|pfm)$/i;

async function detectDrm(zip: JSZip): Promise<string | null> {
  if (zip.file('META-INF/rights.xml')) return 'This book is protected by Adobe DRM (rights.xml), so it can’t be imported. Use a DRM-free copy instead.';
  if (zip.file('META-INF/sinf.xml')) return 'This book is protected by Apple FairPlay DRM, so it can’t be imported. Use a DRM-free copy instead.';
  const enc = zip.file('META-INF/encryption.xml');
  if (!enc) return null;
  const raw = await enc.async('string');
  let entries: X[];
  try {
    entries = arr(obj(xml.parse(raw)?.encryption)?.EncryptedData);
  } catch {
    return 'This book has an unreadable encryption manifest, so it is probably DRM-protected.';
  }
  for (const e of entries) {
    const algorithm = attr(obj(e.EncryptionMethod), 'Algorithm');
    const uri = attr(obj(obj(e.CipherData)?.CipherReference), 'URI');
    if (FONT_OBFUSCATION.has(algorithm)) continue;
    if (uri && FONT_EXT.test(uri)) continue; // encrypted fonts only affect styling
    return 'This book is DRM-protected (its content is encrypted), so it can’t be imported. Use a DRM-free copy instead.';
  }
  return null;
}

// --- OPF -------------------------------------------------------------------------------------

type ManifestItem = { id: string; path: string; mediaType: string; properties: string[] };

type Opf = {
  metadata: ParsedMetadata;
  manifest: Map<string, ManifestItem>;
  byPath: Map<string, ManifestItem>;
  spine: ManifestItem[];
  coverItem?: ManifestItem;
  navItem?: ManifestItem;
  ncxItem?: ManifestItem;
};

function stripHtmlText(html: string): string {
  return parseHtml(html).text.replace(/\s+/g, ' ').trim();
}

function findIsbn(ids: X[]): string | undefined {
  for (const id of ids) {
    const value = text(id);
    const scheme = attr(id, 'scheme').toLowerCase();
    const m = value.replace(/^urn:isbn:/i, '').match(/(?:97[89][\d\s-]{10,16}|\b\d[\d\s-]{8,11}[\dXx])\b/);
    if (!m) continue;
    const digits = m[0].replace(/[\s-]/g, '').toUpperCase();
    if ((digits.length === 13 && /^97[89]\d{10}$/.test(digits)) || (digits.length === 10 && /^\d{9}[\dX]$/.test(digits))) {
      if (scheme === 'isbn' || /isbn/i.test(value) || digits.length === 13) return digits;
    }
  }
  return undefined;
}

function parseOpf(opfXml: string, opfPath: string, fileName: string): Opf {
  const pkg = obj(xml.parse(opfXml)?.package);
  if (!pkg) throw new Error('OPF has no <package> element');
  const md = obj(pkg.metadata) ?? {};
  const metas = arr(md.meta);

  // Authors: EPUB2 uses opf:role, EPUB3 refines with a role meta.
  const roleById = new Map<string, string>();
  for (const m of metas) {
    if (attr(m, 'property') === 'role' && attr(m, 'refines')) roleById.set(attr(m, 'refines').replace(/^#/, ''), text(m));
  }
  const creators = arr(md.creator).filter((c) => text(c));
  const authors = creators
    .filter((c) => {
      const role = (attr(c, 'role') || roleById.get(attr(c, 'id')) || 'aut').toLowerCase();
      return role === 'aut';
    })
    .map((c) => text(c));
  if (authors.length === 0 && creators.length > 0) authors.push(text(creators[0]));

  // Series: calibre meta, or EPUB3 belongs-to-collection + group-position.
  let series: ParsedMetadata['series'];
  const calibreSeries = metas.find((m) => attr(m, 'name') === 'calibre:series');
  if (calibreSeries && attr(calibreSeries, 'content')) {
    const idx = parseFloat(attr(metas.find((m) => attr(m, 'name') === 'calibre:series_index'), 'content'));
    series = { name: attr(calibreSeries, 'content'), ...(Number.isFinite(idx) ? { position: idx } : {}) };
  } else {
    const coll = metas.find((m) => attr(m, 'property') === 'belongs-to-collection' && text(m));
    if (coll) {
      const id = attr(coll, 'id');
      const posMeta = id ? metas.find((m) => attr(m, 'property') === 'group-position' && attr(m, 'refines') === `#${id}`) : undefined;
      const pos = parseFloat(text(posMeta));
      series = { name: text(coll), ...(Number.isFinite(pos) ? { position: pos } : {}) };
    }
  }

  const description = text(arr(md.description)[0]);
  const fallbackTitle = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Untitled';
  const metadata: ParsedMetadata = {
    title: text(arr(md.title)[0]) || fallbackTitle,
    authors,
    subjects: arr(md.subject).map(text).filter(Boolean),
  };
  if (description) metadata.description = stripHtmlText(description);
  const language = text(arr(md.language)[0]);
  if (language) metadata.language = language;
  const publisher = text(arr(md.publisher)[0]);
  if (publisher) metadata.publisher = publisher;
  const isbn = findIsbn(arr(md.identifier));
  if (isbn) metadata.isbn = isbn;
  if (series) metadata.series = series;

  const manifest = new Map<string, ManifestItem>();
  const byPath = new Map<string, ManifestItem>();
  for (const it of arr(obj(pkg.manifest)?.item)) {
    const href = attr(it, 'href');
    if (!href) continue;
    const item: ManifestItem = {
      id: attr(it, 'id'),
      path: resolveHref(opfPath, href).path,
      mediaType: attr(it, 'media-type'),
      properties: attr(it, 'properties').split(/\s+/).filter(Boolean),
    };
    manifest.set(item.id, item);
    byPath.set(item.path, item);
  }

  const spineEl = obj(pkg.spine);
  const spine = arr(spineEl?.itemref)
    .map((r) => manifest.get(attr(r, 'idref')))
    .filter((i): i is ManifestItem => !!i && /x?html|xml/i.test(i.mediaType || 'xhtml'));

  const items = [...manifest.values()];
  const isImage = (i?: ManifestItem) => !!i && (i.mediaType.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg)$/i.test(i.path));
  let coverItem = items.find((i) => i.properties.includes('cover-image'));
  if (!coverItem) {
    const coverId = attr(metas.find((m) => attr(m, 'name') === 'cover'), 'content');
    const byId = coverId ? manifest.get(coverId) : undefined;
    coverItem = isImage(byId) ? byId : undefined;
    if (!coverItem && coverId) coverItem = items.find((i) => isImage(i) && i.path.endsWith(coverId));
  }
  if (!coverItem) coverItem = items.find((i) => isImage(i) && /cover/i.test(i.id + i.path));

  const navItem = items.find((i) => i.properties.includes('nav'));
  const tocId = attr(spineEl, 'toc');
  const ncxItem = (tocId && manifest.get(tocId)) || items.find((i) => i.mediaType === 'application/x-dtbncx+xml');

  return { metadata, manifest, byPath, spine, coverItem, navItem, ncxItem };
}

// --- TOC -------------------------------------------------------------------------------------

type TocNode = { title: string; path: string; anchor?: string; children: TocNode[] };

function elementChildren(el: HTMLElement): HTMLElement[] {
  return el.childNodes.filter((n): n is HTMLElement => n.nodeType === NodeType.ELEMENT_NODE);
}

function tag(el: HTMLElement): string {
  return (el.rawTagName || '').toLowerCase().replace(/^.*:/, '');
}

function parseNavList(ol: HTMLElement, navPath: string): TocNode[] {
  const out: TocNode[] = [];
  for (const li of elementChildren(ol).filter((c) => tag(c) === 'li')) {
    const kids = elementChildren(li);
    const label = kids.find((c) => tag(c) === 'a' || tag(c) === 'span') ?? li.querySelector('a');
    const sub = kids.find((c) => tag(c) === 'ol' || tag(c) === 'ul');
    const children = sub ? parseNavList(sub, navPath) : [];
    const href = label?.getAttribute('href') ?? '';
    const title = (label?.text ?? '').replace(/\s+/g, ' ').trim();
    if (href && !isExternal(href)) {
      out.push({ title, ...resolveHref(navPath, href), children });
    } else if (children.length) {
      // A label without a link (a part heading): it starts where its first child starts.
      out.push({ title, path: children[0].path, anchor: children[0].anchor, children });
    }
  }
  return out;
}

function parseNav(html: string, navPath: string): TocNode[] {
  const root = parseHtml(html, { blockTextElements: { script: true, style: true } });
  const navs = root.querySelectorAll('nav');
  const toc = navs.find((n) => /\btoc\b/.test(n.getAttribute('epub:type') ?? '')) ?? navs.find((n) => !n.getAttribute('epub:type'));
  const list = toc?.querySelector('ol') ?? toc?.querySelector('ul');
  return list ? parseNavList(list, navPath) : [];
}

function parseNcxPoints(points: X[], ncxPath: string): TocNode[] {
  const out: TocNode[] = [];
  for (const p of points) {
    const src = attr(obj(p.content), 'src');
    const title = text(obj(p.navLabel)?.text).replace(/\s+/g, ' ');
    const children = parseNcxPoints(arr(p.navPoint), ncxPath);
    if (src && !isExternal(src)) out.push({ title, ...resolveHref(ncxPath, src), children });
    else if (children.length) out.push({ title, path: children[0].path, anchor: children[0].anchor, children });
  }
  return out;
}

function parseNcx(ncxXml: string, ncxPath: string): TocNode[] {
  const ncx = obj(xml.parse(ncxXml)?.ncx);
  return parseNcxPoints(arr(obj(ncx?.navMap)?.navPoint), ncxPath);
}

type TocEntry = { title: string; path: string; anchor?: string };

/** Top level of the TOC; if it has very few entries, descend a level (up to 3 times). */
function flattenToc(nodes: TocNode[], spinePaths: Set<string>): TocEntry[] {
  const usable = (list: TocNode[]) => list.filter((n) => spinePaths.has(n.path));
  let level = usable(nodes);
  for (let depth = 0; depth < 3 && level.length < 3; depth++) {
    const next = level.flatMap((n) => [n, ...usable(n.children)]);
    if (next.length === level.length) break;
    level = next;
  }
  // When a parent and its first child point at the same place, keep the child (more specific).
  const out: TocEntry[] = [];
  for (const n of level) {
    const prev = out[out.length - 1];
    const entry = { title: n.title, path: n.path, anchor: n.anchor };
    if (prev && prev.path === entry.path && prev.anchor === entry.anchor) out[out.length - 1] = entry;
    else out.push(entry);
  }
  return out;
}

// --- XHTML -> Blocks -------------------------------------------------------------------------

type Marker = { type: 'marker'; entries: number[] };
type Item = Block | Marker;

const SKIP_TAGS = new Set(['script', 'style', 'head', 'title', 'noscript', 'template', 'math', 'object', 'iframe', 'video', 'audio', 'link', 'meta']);
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'big', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'font', 'i', 'ins',
  'kbd', 'mark', 'q', 'rb', 'rp', 'rt', 'rtc', 'ruby', 's', 'samp', 'small', 'span', 'strike', 'strong',
  'sub', 'sup', 'time', 'tt', 'u', 'var', 'wbr', 'br', 'img', 'label',
]);
const HEADING: Record<string, 1 | 2 | 3> = { h1: 1, h2: 2, h3: 3, h4: 3, h5: 3, h6: 3 };

type InlineKind = { type: 'p' } | { type: 'quote' } | { type: 'h'; level: 1 | 2 | 3 };

type Images = {
  /** zip path -> image id */
  ids: Map<string, string>;
};

class DocConverter {
  readonly items: Item[] = [];
  readonly found = new Set<string>();
  private html = '';
  private pendingMarkers: number[] = [];
  private pendingImages: Block[] = [];

  constructor(
    private readonly docPath: string,
    private readonly anchors: Map<string, number[]>,
    private readonly images: Images,
    private readonly zip: JSZip,
  ) {}

  convert(body: HTMLElement) {
    this.container(body, { type: 'p' });
  }

  private marker(entries: number[]) {
    if (this.html.trim()) this.pendingMarkers.push(...entries);
    else this.items.push({ type: 'marker', entries });
  }

  private checkId(el: HTMLElement) {
    for (const key of ['id', 'name']) {
      const id = el.getAttribute(key);
      if (id && this.anchors.has(id) && !this.found.has(id)) {
        this.found.add(id);
        this.marker(this.anchors.get(id)!);
      }
    }
  }

  private checkIdsDeep(el: HTMLElement) {
    this.checkId(el);
    for (const c of elementChildren(el)) this.checkIdsDeep(c);
  }

  private flush(kind: InlineKind) {
    let html = this.html
      .replace(/\s+/g, ' ')
      .replace(/\s*<br>\s*/g, '<br>');
    // Drop empty formatting and leading/trailing line breaks.
    for (let i = 0; i < 3; i++) html = html.replace(/<(em|strong)>(\s*)<\/\1>/g, '$2').replace(/<\/(em|strong)>(\s*)<\1>/g, '$2');
    html = html.trim().replace(/^(?:<br>\s*)+|(?:\s*<br>)+$/g, '').trim();
    if (this.pendingMarkers.length) this.items.push({ type: 'marker', entries: this.pendingMarkers });
    this.pendingMarkers = [];
    if (htmlToText(html)) {
      this.items.push(kind.type === 'h' ? { type: 'h', level: kind.level, html } : { type: kind.type, html });
    }
    this.html = '';
    this.items.push(...this.pendingImages);
    this.pendingImages = [];
  }

  private image(src: string | undefined, alt: string): Block | null {
    if (!src || src.startsWith('data:') || isExternal(src)) return null;
    const { path } = resolveHref(this.docPath, src);
    if (!this.zip.file(path)) return null;
    let id = this.images.ids.get(path);
    if (!id) {
      id = stableId('img', path);
      this.images.ids.set(path, id);
    }
    return { type: 'img', imageId: id, alt: alt.replace(/\s+/g, ' ').trim() };
  }

  private svgImages(svg: HTMLElement): Block[] {
    const out: Block[] = [];
    for (const im of svg.querySelectorAll('image')) {
      const b = this.image(im.getAttribute('xlink:href') ?? im.getAttribute('href'), svg.querySelector('title')?.text ?? '');
      if (b) out.push(b);
    }
    return out;
  }

  private inline(node: HtmlNode) {
    if (node.nodeType === NodeType.TEXT_NODE) {
      this.html += escapeHtml(node.text.replace(/\s+/g, ' '));
      return;
    }
    if (node.nodeType !== NodeType.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const t = tag(el);
    if (SKIP_TAGS.has(t) || isNoteRef(el)) return;
    if (t === 'br') {
      this.html += '<br>';
    } else if (t === 'img') {
      const b = this.image(el.getAttribute('src'), el.getAttribute('alt') ?? '');
      if (b) this.pendingImages.push(b);
    } else if (t === 'svg') {
      this.pendingImages.push(...this.svgImages(el));
    } else if (t === 'em' || t === 'i') {
      this.html += '<em>';
      for (const c of el.childNodes) this.inline(c);
      this.html += '</em>';
    } else if (t === 'strong' || t === 'b') {
      this.html += '<strong>';
      for (const c of el.childNodes) this.inline(c);
      this.html += '</strong>';
    } else {
      for (const c of el.childNodes) this.inline(c);
    }
  }

  private hasBlock(el: HTMLElement): boolean {
    return elementChildren(el).some((c) => {
      const t = tag(c);
      return t === 'svg' ? false : !INLINE_TAGS.has(t) || this.hasBlock(c);
    });
  }

  private container(el: HTMLElement, kind: InlineKind) {
    this.checkId(el);
    for (const child of el.childNodes) {
      if (child.nodeType === NodeType.TEXT_NODE) {
        this.inline(child);
        continue;
      }
      if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
      const c = child as HTMLElement;
      const t = tag(c);
      if (SKIP_TAGS.has(t)) continue;
      if (t === 'svg') {
        this.flush(kind);
        this.items.push(...this.svgImages(c));
      } else if (t === 'img') {
        this.flush(kind);
        const b = this.image(c.getAttribute('src'), c.getAttribute('alt') ?? '');
        if (b) this.items.push(b);
      } else if (t === 'hr') {
        this.flush(kind);
        this.checkId(c);
        this.items.push({ type: 'hr' });
      } else if (INLINE_TAGS.has(t) && !this.hasBlock(c)) {
        this.checkIdsDeep(c);
        this.inline(c);
      } else if (HEADING[t]) {
        this.flush(kind);
        this.container(c, { type: 'h', level: HEADING[t] });
      } else if (t === 'blockquote') {
        this.flush(kind);
        this.container(c, { type: 'quote' });
      } else {
        // p, div, section, li, td, figure, ... (and inline elements wrapping blocks)
        this.flush(kind);
        this.container(c, kind);
      }
    }
    this.flush(kind);
  }
}

/** Footnote reference markers (e.g. <sup><a href="#n1">1</a></sup>) are dropped from the text. */
function isNoteRef(el: HTMLElement): boolean {
  const t = tag(el);
  if (t === 'a') {
    if (/\bnoteref\b/.test(el.getAttribute('epub:type') ?? '') || el.getAttribute('role') === 'doc-noteref') return true;
    return (el.getAttribute('href') ?? '').includes('#') && /^(?:\[?\d{1,3}\]?|[*†‡§]+)$/.test(el.text.trim());
  }
  if (t !== 'sup') return false;
  const kids = elementChildren(el);
  const onlyLink = kids.length === 1 && tag(kids[0]) === 'a' && (kids[0].getAttribute('href') ?? '').includes('#');
  return onlyLink && el.text.trim().length <= 4;
}

function firstHeadingText(root: HTMLElement): string {
  for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    const el = root.querySelector(h);
    const t = el?.text.replace(/\s+/g, ' ').trim();
    if (t) return t;
  }
  return '';
}

// --- Entry point -----------------------------------------------------------------------------

export async function parseEpub(bytes: Uint8Array, fileName: string): Promise<ParseResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return { ok: false, reason: 'corrupt', detail: 'This EPUB file is damaged and couldn’t be opened.' };
  }

  const drm = await detectDrm(zip);
  if (drm) return { ok: false, reason: 'drm', detail: drm };

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) return { ok: false, reason: 'corrupt', detail: 'This EPUB is missing META-INF/container.xml.' };
  let opfPath: string;
  let opf: Opf;
  try {
    const container = xml.parse(await containerFile.async('string'));
    const rootfiles = arr(obj(obj(container?.container)?.rootfiles)?.rootfile);
    const rootfile = rootfiles.find((r) => attr(r, 'media-type') === 'application/oebps-package+xml') ?? rootfiles[0];
    opfPath = attr(rootfile, 'full-path');
    const opfFile = opfPath ? zip.file(opfPath) : null;
    if (!opfFile) return { ok: false, reason: 'corrupt', detail: 'This EPUB’s package file (OPF) is missing.' };
    opf = parseOpf(await opfFile.async('string'), opfPath, fileName);
  } catch (e) {
    return { ok: false, reason: 'corrupt', detail: `This EPUB’s package file couldn’t be read (${(e as Error).message}).` };
  }
  if (opf.spine.length === 0) return { ok: false, reason: 'corrupt', detail: 'This EPUB has no readable content documents.' };

  const warnings: string[] = [];
  const spinePaths = new Set(opf.spine.map((s) => s.path));

  // TOC: EPUB3 nav first, then NCX.
  let entries: TocEntry[] = [];
  try {
    if (opf.navItem && zip.file(opf.navItem.path)) {
      entries = flattenToc(parseNav(await zip.file(opf.navItem.path)!.async('string'), opf.navItem.path), spinePaths);
    }
    if (entries.length < 2 && opf.ncxItem && zip.file(opf.ncxItem.path)) {
      entries = flattenToc(parseNcx(await zip.file(opf.ncxItem.path)!.async('string'), opf.ncxItem.path), spinePaths);
    }
  } catch {
    entries = [];
  }
  const useToc = entries.length >= 2;
  if (!useToc) warnings.push('No usable table of contents was found, so each file in the book became a section; please check them.');

  // Anchors per document.
  const anchorsByDoc = new Map<string, Map<string, number[]>>();
  const startsByDoc = new Map<string, number[]>();
  entries.forEach((e, i) => {
    if (e.anchor) {
      const m = anchorsByDoc.get(e.path) ?? new Map<string, number[]>();
      m.set(e.anchor, [...(m.get(e.anchor) ?? []), i]);
      anchorsByDoc.set(e.path, m);
    } else {
      startsByDoc.set(e.path, [...(startsByDoc.get(e.path) ?? []), i]);
    }
  });

  const images: Images = { ids: new Map() };
  const drafts: SectionDraft[] = [];
  let current: SectionDraft = { title: 'Front matter', blocks: [], kind: 'front' };
  const seenEntries = new Set<number>();

  for (const [docIndex, doc] of opf.spine.entries()) {
    const file = zip.file(doc.path);
    if (!file) continue;
    const root = parseHtml(await file.async('string'), { blockTextElements: { script: true, style: true, noscript: true } });
    const body = root.querySelector('body') ?? root;
    const anchors = useToc ? (anchorsByDoc.get(doc.path) ?? new Map<string, number[]>()) : new Map<string, number[]>();
    const conv = new DocConverter(doc.path, anchors, images, zip);
    conv.convert(body);

    let items: Item[] = conv.items;
    if (useToc) {
      // Entries for the whole file, plus anchors that weren't found, start at the top of the file.
      const atStart = [...(startsByDoc.get(doc.path) ?? [])];
      for (const [id, idx] of anchors) if (!conv.found.has(id)) atStart.push(...idx);
      if (atStart.length) items = [{ type: 'marker', entries: atStart.sort((a, b) => a - b) }, ...items];
    } else {
      drafts.push(current);
      const title = firstHeadingText(body) || root.querySelector('title')?.text.trim() || `Section ${docIndex + 1}`;
      current = { title, blocks: [] };
    }

    for (const item of items) {
      if (item.type !== 'marker') {
        current.blocks.push(item);
        continue;
      }
      for (const idx of item.entries) {
        if (seenEntries.has(idx)) continue;
        seenEntries.add(idx);
        drafts.push(current);
        current = { title: entries[idx].title || '', blocks: [] };
      }
    }
  }
  drafts.push(current);

  // Untitled TOC entries: fall back to their first heading.
  for (const d of drafts) {
    if (!d.title) {
      const h = d.blocks.find((b) => b.type === 'h');
      d.title = h && 'html' in h ? htmlToText(h.html) : 'Untitled';
    }
  }

  const sections = buildSections(drafts, opf.metadata.title);

  // Image bytes: only images actually referenced by kept sections.
  const used = new Set<string>();
  for (const s of sections) for (const b of s.blocks) if (b.type === 'img') used.add(b.imageId);
  const parsedImages: ParsedImage[] = [];
  for (const [path, id] of images.ids) {
    if (!used.has(id)) continue;
    const f = zip.file(path);
    if (!f) continue;
    parsedImages.push({ id, mediaType: mediaTypeFor(path, opf.byPath.get(path)?.mediaType), bytes: await f.async('uint8array') });
  }

  let cover: ParsedImage | undefined;
  if (opf.coverItem) {
    const f = zip.file(opf.coverItem.path);
    if (f) {
      cover = {
        id: images.ids.get(opf.coverItem.path) ?? stableId('img', opf.coverItem.path),
        mediaType: mediaTypeFor(opf.coverItem.path, opf.coverItem.mediaType),
        bytes: await f.async('uint8array'),
      };
    }
  }

  if (!sections.some((s) => s.kind === 'chapter')) warnings.push('No chapters were recognised; please check the sections.');

  return {
    ok: true,
    book: { format: 'EPUB', metadata: opf.metadata, sections, ...(cover ? { cover } : {}), images: parsedImages, warnings },
  };
}
