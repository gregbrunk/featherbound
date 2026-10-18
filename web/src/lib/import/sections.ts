// Shared helpers for the book parsers: HTML escaping, word counts, stable ids, and the
// front/back-matter heuristics used to classify sections by title.
import { createHash } from 'node:crypto';
import type { Block, ParsedSection, SectionKind } from './types';

/** Escape text for the safe inline-HTML subset used in Blocks. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

/** Decode the entities our own escapeHtml produces (plus numeric ones). */
export function unescapeHtml(html: string): string {
  return html.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Plain text of a block's inline HTML (<br> becomes a space). */
export function htmlToText(html: string): string {
  return unescapeHtml(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

export function blockText(block: Block): string {
  return 'html' in block ? htmlToText(block.html) : '';
}

const WORD_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

export function countWords(text: string): number {
  return text.match(WORD_RE)?.length ?? 0;
}

export function countBlockWords(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) n += countWords(blockText(b));
  return n;
}

/** Stable short id, e.g. for images (hash of the path inside the book). */
export function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha1').update(value).digest('hex').slice(0, 16)}`;
}

/** Lowercase, strip punctuation and collapse whitespace, for comparing titles. */
export function normalizeTitle(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Drop a section's leading heading (or pair of headings) if it repeats the section title. */
export function stripDuplicateHeading(title: string, blocks: Block[]): Block[] {
  const want = normalizeTitle(title);
  if (!want) return blocks;
  const first = blocks[0];
  if (first?.type !== 'h') return blocks;
  const t1 = normalizeTitle(blockText(first));
  if (t1 === want) return blocks.slice(1);
  const second = blocks[1];
  if (second?.type === 'h' && normalizeTitle(`${blockText(first)} ${blockText(second)}`) === want) {
    return blocks.slice(2);
  }
  return blocks;
}

// --- Front/back matter heuristics -------------------------------------------------------

/** Titles that are always story content. */
const CHAPTER_RE =
  /^(?:prologue|epilogue|interlude|part|book|chapter|ch\.|act|canto)\b|^\d{1,3}(?:[.:)\s]|$)|^[IVXLCDM]+(?:[.:)\s]|$)|^(?:one|two|three|four|five|six|seven|eight|nine|ten)$/i;

/** Titles that look like front or back matter; position in the book decides which. */
const MATTER_RE = new RegExp(
  [
    // front
    'cover', 'title\\s*page', 'half[\\s-]*title', 'copyright', 'dedication', 'contents',
    'table of contents', 'toc$', 'epigraph', 'maps?\\b', 'also by', 'praise', 'foreword',
    'preface', 'introduction', 'frontispiece', 'imprint', 'colophon', 'front matter',
    'about this (?:e?book|edition)', 'list of (?:illustrations|maps|figures)', 'cast of characters',
    // back
    'acknowledge?ments?', 'about the authors?', 'about the publisher', 'about the illustrator',
    'excerpt', 'preview', 'sneak peek', 'newsletter', 'more (?:books )?(?:from|by)',
    'other (?:books|titles) by', 'books by', 'coming soon', 'also available', 'read more',
    'reading group', 'discussion questions', 'book club', 'bonus', 'index$', 'glossary',
    'bibliography', 'back matter', 'sign up', 'join our', 'connect with', 'a note from the publisher',
  ].map((p) => `^(?:${p})`).join('|'),
  'i',
);

/** Project Gutenberg boilerplate (header, licence, end marker), anywhere in the title. */
const GUTENBERG_RE = /project gutenberg|gutenberg(?:™|tm)? licen[cs]e|\*\*\*\s*(?:start|end) of/i;

export type SectionDraft = {
  title: string;
  blocks: Block[];
  /** Forces the kind (e.g. content before the first TOC entry is front matter). */
  kind?: SectionKind;
};

type Category = 'chapter' | 'matter' | 'unknown';

function categorize(draft: SectionDraft, bookTitle: string): Category {
  const title = draft.title.trim().replace(/^[\s"'“‘(\[]+/, '');
  const firstHeading = draft.blocks.find((b) => b.type === 'h');
  const headingText = firstHeading ? blockText(firstHeading) : '';
  if (GUTENBERG_RE.test(title) || GUTENBERG_RE.test(headingText)) return 'matter';
  if (MATTER_RE.test(title)) return 'matter';
  if (CHAPTER_RE.test(title)) return 'chapter';
  // A section titled exactly like the book is a title page / half-title.
  if (bookTitle && normalizeTitle(title) === normalizeTitle(bookTitle)) return 'matter';
  return 'unknown';
}

/** True if a title looks like front or back matter (used e.g. by tests and the PDF parser). */
export function looksLikeMatter(title: string): boolean {
  return categorize({ title, blocks: [] }, '') === 'matter';
}

const PG_START_RE = /\*{3}\s*start of (?:the|this) project gutenberg/i;
const PG_END_RE = /\*{3}\s*end of (?:the|this) project gutenberg/i;

/**
 * Project Gutenberg books wrap the text in "*** START OF ... ***" / "*** END OF ... ***"
 * markers, often inside the first or last chapter's file. Split those boilerplate parts off
 * into their own front/back sections, and treat everything after the end marker as back matter.
 */
function splitGutenberg(drafts: SectionDraft[]): SectionDraft[] {
  const out: SectionDraft[] = [];
  let ended = false;
  for (const d of drafts) {
    if (ended) {
      out.push({ ...d, kind: 'back' });
      continue;
    }
    let blocks = d.blocks;
    const start = blocks.findIndex((b) => PG_START_RE.test(blockText(b)));
    if (start >= 0 && d.kind !== 'front') {
      out.push({ title: 'Project Gutenberg header', blocks: blocks.slice(0, start + 1), kind: 'front' });
      blocks = blocks.slice(start + 1);
    }
    const end = blocks.findIndex((b) => PG_END_RE.test(blockText(b)));
    if (end >= 0) {
      ended = true;
      out.push({ ...d, blocks: blocks.slice(0, end) });
      out.push({ title: 'Project Gutenberg licence', blocks: blocks.slice(end), kind: 'back' });
    } else {
      out.push({ ...d, blocks });
    }
  }
  return out;
}

/**
 * Classify drafts into front matter / chapters / back matter and build ParsedSections.
 * Matter titles before the first chapter are front matter, after it back matter.
 * Leading heading duplicates of the title are stripped; empty sections are dropped
 * (except part/book title pages, which are kept as chapters).
 */
export function buildSections(drafts: SectionDraft[], bookTitle: string): ParsedSection[] {
  const prepared = splitGutenberg(drafts)
    .map((d) => ({ ...d, title: d.title.replace(/\s+/g, ' ').trim() || 'Untitled', blocks: stripDuplicateHeading(d.title, d.blocks) }))
    .filter((d) => d.blocks.length > 0 || /^(?:part|book)\b/i.test(d.title));
  const cats = prepared.map((d) => (d.kind ? null : categorize(d, bookTitle)));
  let seenChapter = false;
  return prepared.map((d, i) => {
    let kind: SectionKind;
    if (d.kind) kind = d.kind;
    else if (cats[i] === 'matter') kind = seenChapter ? 'back' : 'front';
    else kind = 'chapter';
    if (kind === 'chapter') seenChapter = true;
    return {
      title: d.title,
      kind,
      include: kind === 'chapter',
      blocks: d.blocks,
      words: countBlockWords(d.blocks),
    };
  });
}
