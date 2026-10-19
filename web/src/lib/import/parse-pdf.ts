// Text-based PDF parser: pdf.js text items -> lines -> (headers/footers removed) -> paragraphs
// and chapter sections found from headings.
import { buildSections, escapeHtml, normalizeTitle, type SectionDraft } from './sections';
import type { Block, ParseResult } from './types';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfJs> | undefined;

/** Load pdf.js once, with its worker running in this thread (no worker file). */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= (async () => {
    // Importing the worker module registers globalThis.pdfjsWorker, which pdf.js then uses
    // in-process instead of spawning a worker.
    // @ts-expect-error -- the worker bundle ships without type declarations
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    return import('pdfjs-dist/legacy/build/pdf.mjs');
  })();
  return pdfjsPromise;
}

export type PdfLine = {
  text: string;
  x: number;
  y: number;
  size: number;
  page: number;
  pageBottom: number;
  pageHeight: number;
};

export type RawItem = { str: string; x: number; y: number; width: number; size: number };

// --- Drop caps -----------------------------------------------------------------------------

const DROP_CAP_RE = /^[“"‘']?\p{Lu}$/u;
/** Letters that are also words, so "I" + "jolted" needs a space but "I" + "t was" doesn't. */
const WORD_LETTERS = new Set(['A', 'I', 'O']);

/** How often each lowercased word appears in the book, to tell "A warm" from "An old". */
export function wordCounts(strs: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of strs) for (const w of s.toLowerCase().match(/\p{L}+/gu) ?? []) counts.set(w, (counts.get(w) ?? 0) + 1);
  return counts;
}

/**
 * Fold a chapter's big first letter back into its paragraph. Left alone it groups with the
 * line it sits beside, and that big-font line reads as a chapter heading ("Y repeating the…").
 */
export function mergeDropCaps(items: RawItem[], words: Map<string, number>): RawItem[] {
  const sizes = items.map((i) => i.size).sort((a, b) => a - b);
  const typical = sizes[Math.floor(sizes.length / 2)] ?? 0;
  const caps = items.filter((i) => DROP_CAP_RE.test(i.str.trim()) && i.size >= typical * 2);
  if (!caps.length) return items;
  const out = items.filter((i) => !caps.includes(i)).map((i) => ({ ...i }));
  for (const cap of caps) {
    const top = cap.y + cap.size * 0.8;
    const near = out.filter((i) => i.size < cap.size / 1.5 && i.x > cap.x && i.y <= top && i.y >= cap.y - i.size * 0.5);
    // The first item of each line beside the cap (later items on the line stay where they are).
    const beside = near.filter((i) => i.x < cap.x + cap.width * 2.5 && !near.some((o) => o !== i && Math.abs(o.y - i.y) < 1 && o.x < i.x));
    if (!beside.length) {
      out.push(cap); // not a drop cap after all
      continue;
    }
    const firstY = Math.max(...beside.map((i) => i.y));
    const first = beside.filter((i) => i.y === firstY).sort((a, b) => a.x - b.x)[0];
    const letter = cap.str.trim();
    const bare = letter.replace(/^[“"‘']/, '');
    const word = first.str.trimStart().match(/^\p{L}+/u)?.[0] ?? '';
    const joined = !WORD_LETTERS.has(bare) || !word || (words.get((bare + word).toLowerCase()) ?? 0) > (words.get(word.toLowerCase()) ?? 0);
    first.str = `${letter}${joined ? '' : ' '}${first.str.trimStart()}`;
    // The lines beside the cap are pushed right by it; put them back on the margin so they
    // don't read as indented new paragraphs.
    for (const i of beside) {
      i.width += i.x - cap.x;
      i.x = cap.x;
    }
  }
  return out;
}

/** Group a page's text items into lines (top to bottom, left to right). */
function itemsToLines(items: RawItem[], page: number, pageBottom: number, pageHeight: number): PdfLine[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: RawItem[][] = [];
  for (const it of sorted) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(g[0].y - it.y) <= Math.max(g[0].size, it.size) * 0.4) g.push(it);
    else groups.push([it]);
  }
  return groups.map((g) => {
    g.sort((a, b) => a.x - b.x);
    let text = '';
    let prev: RawItem | undefined;
    for (const it of g) {
      if (prev) {
        const gap = it.x - (prev.x + prev.width);
        if (gap > Math.min(prev.size, it.size) * 0.12 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
      }
      text += it.str;
      prev = it;
    }
    const size = g.reduce((m, i) => (i.str.trim().length > 0 ? Math.max(m, i.size) : m), 0);
    return { text: text.replace(/\s+/g, ' ').trim(), x: g[0].x, y: g[0].y, size, page, pageBottom, pageHeight };
  });
}

// --- Running headers / footers ------------------------------------------------------------

const MARGIN = 0.08;
const PAGE_NUMBER_RE = /^(?:page\s*)?(?:\d{1,4}|[ivxlcdm]{1,7})(?:\s*(?:of|\/)\s*\d{1,4})?$/i;

function inMargin(l: PdfLine): boolean {
  const rel = (l.y - l.pageBottom) / l.pageHeight;
  return rel > 1 - MARGIN || rel < MARGIN;
}

function headerKey(text: string): string {
  return text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

/** Remove page numbers and text in the top/bottom margins that repeats across pages. */
export function removeHeadersFooters(lines: PdfLine[], pageCount: number): PdfLine[] {
  const pagesByKey = new Map<string, Set<number>>();
  for (const l of lines) {
    if (!inMargin(l)) continue;
    const k = headerKey(l.text);
    const set = pagesByKey.get(k) ?? new Set<number>();
    set.add(l.page);
    pagesByKey.set(k, set);
  }
  const threshold = pageCount <= 3 ? 2 : Math.max(3, Math.min(6, Math.ceil(pageCount * 0.1)));
  return lines.filter((l) => {
    if (!inMargin(l)) return true;
    const bare = l.text.replace(/[\s\-–—|•·.]+/g, ' ').trim();
    if (PAGE_NUMBER_RE.test(bare)) return false;
    return (pagesByKey.get(headerKey(l.text))?.size ?? 0) < threshold;
  });
}

// --- Paragraphs and chapters ---------------------------------------------------------------

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0] ?? 0;
  let bestCount = 0;
  for (const [v, c] of counts) if (c > bestCount || (c === bestCount && v < best)) [best, bestCount] = [v, c];
  return best;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const LABEL_RE = /^(?:chapter|book|part|prologue|epilogue|interlude)\b/i;
const NUMBER_RE = /^(?:\d{1,3}|[IVXLCDM]{1,7})\.?$/;
/** A label with only a number, waiting for its title: "Chapter 52", "Part IV". */
const BARE_LABEL_RE = /^(?:chapter|book|part)\s+(?:\d{1,3}|[IVXLCDM]{1,7}|[a-z]+)\.?$/i;

/** The title page often drops the subtitle: "BEWARE OF CHICKEN" for "Beware of Chicken: A Xianxia…". */
function isBookTitle(text: string, bookTitle: string) {
  const t = normalizeTitle(text);
  const full = normalizeTitle(bookTitle);
  return t === full || (t.length >= 4 && full.startsWith(`${t} `));
}

/** Turn cleaned lines into section drafts (one per detected heading). */
export function linesToDrafts(lines: PdfLine[], bookTitle: string): { drafts: SectionDraft[]; headings: number } {
  // Body font size: the size covering the most characters.
  const charsBySize = new Map<number, number>();
  for (const l of lines) {
    const s = Math.round(l.size * 2) / 2;
    charsBySize.set(s, (charsBySize.get(s) ?? 0) + l.text.length);
  }
  let body = 10;
  let most = -1;
  for (const [s, c] of charsBySize) if (c > most) [body, most] = [s, c];
  const isBodySize = (l: PdfLine) => Math.abs(l.size - body) <= body * 0.1;
  const isBig = (l: PdfLine) => l.size >= body * 1.25;

  // Typical line spacing and per-page left margin of body text.
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1];
    const b = lines[i];
    if (a.page === b.page && isBodySize(a) && isBodySize(b)) {
      const g = a.y - b.y;
      if (g > 0 && g < body * 3) gaps.push(g);
    }
  }
  const spacing = median(gaps) || body * 1.2;
  const leftByPage = new Map<number, number>();
  const xsByPage = new Map<number, number[]>();
  for (const l of lines) if (isBodySize(l)) xsByPage.set(l.page, [...(xsByPage.get(l.page) ?? []), Math.round(l.x)]);
  for (const [p, xs] of xsByPage) leftByPage.set(p, mode(xs));
  const globalLeft = mode([...xsByPage.values()].flat());
  const leftOf = (l: PdfLine) => leftByPage.get(l.page) ?? globalLeft;

  const gapBefore = (i: number) => {
    const prev = lines[i - 1];
    if (!prev || prev.page !== lines[i].page) return Infinity;
    return prev.y - lines[i].y;
  };
  const startsBlock = (i: number) => gapBefore(i) > spacing * 1.4 || (i > 0 && isBig(lines[i - 1]) !== isBig(lines[i]));
  const endsBlock = (i: number) => i + 1 >= lines.length || startsBlock(i + 1);
  const indented = (l: PdfLine) => l.x > leftOf(l) + body * 0.8;

  let titlePage = -1; // page detected as the book's title page (big text there isn't a heading)
  const isHeadingStart = (i: number): 'label' | 'number' | 'big' | null => {
    const l = lines[i];
    if (l.text.length > 80) return null;
    const blockStart = startsBlock(i) || i === 0 || lines[i - 1].page !== l.page;
    if (!blockStart) return null;
    if (LABEL_RE.test(l.text) && /^[A-Z]/.test(l.text) && l.text.length <= 60 && (endsBlock(i) || isBig(l) || isBig(lines[i + 1]))) return 'label';
    if (NUMBER_RE.test(l.text) && i + 1 < lines.length && lines[i + 1].text.length <= 80 && lines[i + 1].page === l.page) return 'number';
    if (isBig(l) && /\p{L}/u.test(l.text) && l.page !== titlePage) return 'big';
    return null;
  };

  const drafts: SectionDraft[] = [];
  let current: SectionDraft = { title: 'Front matter', blocks: [], kind: 'front' };
  let para = '';
  let headings = 0;
  const flush = () => {
    const t = para.replace(/\s+/g, ' ').trim();
    if (t) current.blocks.push({ type: 'p', html: escapeHtml(t) } satisfies Block);
    para = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const heading = isHeadingStart(i);
    if (heading) {
      flush();
      // Gather a title line that follows the label/number, and wrapped big-font lines.
      let title = l.text.replace(/\.$/, '');
      let j = i + 1;
      while (j < lines.length && j - i < 3 && lines[j].page === l.page && lines[j].text.length <= 80) {
        const next = lines[j];
        const titleLike = isBig(next) || ((heading === 'label' || heading === 'number') && j === i + 1 && endsBlock(j) && !/[.!?,;]$/.test(next.text));
        const sameSize = Math.abs(next.size - l.size) <= l.size * 0.1;
        if (!titleLike || (heading === 'big' && !sameSize) || (LABEL_RE.test(next.text) && j > i + 1)) break;
        title = j === i + 1 && heading !== 'big' ? `${title}${heading === 'number' ? '.' : ':'} ${next.text}` : `${title} ${next.text}`;
        j++;
      }
      if (headings > 0 && heading === 'big' && !current.blocks.length && BARE_LABEL_RE.test(current.title)) {
        // "CHAPTER 52" at the foot of one page, its title at the top of the next.
        current.title = `${current.title}: ${title}`;
        i = j - 1;
        continue;
      }
      drafts.push(current);
      if (heading === 'big' && headings === 0 && isBookTitle(l.text, bookTitle)) {
        // The book's own title on its title page.
        current = { title: 'Title page', blocks: [], kind: 'front' };
        titlePage = l.page;
      } else {
        current = { title, blocks: [] };
        headings++;
      }
      i = j - 1;
      continue;
    }
    const prev = lines[i - 1];
    const newPara = !para || !prev || (prev.page === l.page ? startsBlock(i) || indented(l) : indented(l));
    if (newPara) {
      flush();
      para = l.text;
    } else if (/\p{L}-$/u.test(para) && /^\p{Ll}/u.test(l.text)) {
      para = para.slice(0, -1) + l.text; // de-hyphenate a word split across lines
    } else {
      para += ` ${l.text}`;
    }
  }
  flush();
  drafts.push(current);

  if (headings === 0) {
    // No chapters found: the whole text is one chapter.
    const all = drafts.flatMap((d) => d.blocks);
    return { drafts: [{ title: bookTitle, blocks: all, kind: 'chapter' }], headings };
  }
  return { drafts, headings };
}

// --- Entry point -----------------------------------------------------------------------------

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
}

function usableTitle(t: unknown): string | undefined {
  if (typeof t !== 'string') return undefined;
  const s = t.replace(/\s+/g, ' ').trim();
  if (!s || /^(?:untitled|document\d*|microsoft word\b.*)$/i.test(s) || /\.(?:docx?|pdf|indd|rtf|odt)$/i.test(s)) return undefined;
  return s;
}

export async function parsePdf(bytes: Uint8Array, fileName: string): Promise<ParseResult> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: bytes.slice(), // pdf.js takes ownership of (and detaches) the buffer
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (e) {
    await task.destroy().catch(() => {});
    const name = (e as Error)?.name;
    if (name === 'PasswordException') {
      return { ok: false, reason: 'drm', detail: 'This PDF is password-protected, so it can’t be imported. Remove the password and try again.' };
    }
    return { ok: false, reason: 'corrupt', detail: 'This PDF is damaged and couldn’t be opened.' };
  }

  try {
    const pages: { items: RawItem[]; bottom: number; height: number }[] = [];
    let chars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const [, y0, , y1] = page.view;
      const content = await page.getTextContent();
      const items: RawItem[] = [];
      for (const it of content.items) {
        if (!('str' in it) || !it.str) continue;
        const t = it.transform as number[];
        const size = Math.hypot(t[2], t[3]) || it.height || 10;
        items.push({ str: it.str, x: t[4], y: t[5], width: it.width, size });
        chars += it.str.replace(/\s/g, '').length;
      }
      pages.push({ items, bottom: Math.min(y0, y1), height: Math.abs(y1 - y0) || 792 });
      page.cleanup();
    }
    const words = wordCounts(pages.flatMap((pg) => pg.items.map((i) => i.str)));
    const lines = pages.flatMap((pg, k) => itemsToLines(mergeDropCaps(pg.items, words), k + 1, pg.bottom, pg.height));

    if (doc.numPages === 0) return { ok: false, reason: 'corrupt', detail: 'This PDF has no pages.' };
    if (chars / doc.numPages < 50) {
      return {
        ok: false,
        reason: 'scanned',
        detail: 'This PDF looks like scanned pages (there’s almost no text in it). Scanned books aren’t supported yet; try an EPUB or a text-based PDF.',
      };
    }

    const { info } = (await doc.getMetadata().catch(() => ({ info: {} }))) as { info: Record<string, unknown> };
    const title = usableTitle(info?.Title) ?? titleFromFileName(fileName);
    const author = typeof info?.Author === 'string' ? info.Author.trim() : '';
    const authors = author ? author.split(/\s*(?:;|&|\band\b)\s*/i).map((a) => a.trim()).filter(Boolean) : [];

    const cleaned = removeHeadersFooters(lines, doc.numPages);
    const { drafts, headings } = linesToDrafts(cleaned, title);
    const sections = buildSections(drafts, title);
    const warnings = ['Chapter breaks were found from headings; please check them.'];
    if (headings === 0) warnings.push('No chapter headings were found, so the whole book is one section.');

    return {
      ok: true,
      book: { format: 'PDF', metadata: { title, authors, subjects: [] }, sections, images: [], warnings },
    };
  } catch (e) {
    return { ok: false, reason: 'corrupt', detail: `This PDF couldn’t be read (${(e as Error).message}).` };
  } finally {
    await task.destroy();
  }
}
