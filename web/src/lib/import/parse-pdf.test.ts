import { describe, expect, it } from 'vitest';
import { buildPdf, buildScannedPdf } from './fixtures/build';
import { mergeDropCaps, parsePdf, wordCounts, type RawItem } from './parse-pdf';
import { blockText } from './sections';
import type { ParsedBook, ParseResult } from './types';

function book(r: ParseResult): ParsedBook {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}: ${r.detail}`);
  return r.book;
}

describe('parsePdf', () => {
  it('reads metadata from the info dictionary', async () => {
    const b = book(await parsePdf(await buildPdf(), 'test-book.pdf'));
    expect(b.format).toBe('PDF');
    expect(b.metadata.title).toBe('The Test Book');
    expect(b.metadata.authors).toEqual(['Jane Doe', 'John Roe']);
    expect(b.warnings).toContain('Chapter breaks were found from headings; please check them.');
  });

  it('finds both chapters and treats the title page as front matter', async () => {
    const b = book(await parsePdf(await buildPdf(), 'test-book.pdf'));
    expect(b.sections.map((s) => [s.title, s.kind, s.include])).toEqual([
      ['Title page', 'front', false],
      ['Chapter One', 'chapter', true],
      ['Chapter Two', 'chapter', true],
    ]);
  });

  it('removes running headers and page numbers', async () => {
    const b = book(await parsePdf(await buildPdf(), 'test-book.pdf'));
    const text = b.sections.flatMap((s) => s.blocks.map(blockText)).join('\n');
    expect(text).not.toContain('THE TEST BOOK');
    for (const s of b.sections) {
      for (const block of s.blocks) expect(blockText(block)).not.toMatch(/^\d+$|\s\d$/);
    }
  });

  it('rebuilds paragraphs and de-hyphenates line-break splits', async () => {
    const b = book(await parsePdf(await buildPdf(), 'test-book.pdf'));
    const ch1 = b.sections[1].blocks.map(blockText);
    expect(ch1[0]).toBe('It was a quiet morning when the story began and nothing at all seemed out of the ordinary.');
    expect(ch1[1]).toBe('Then something truly extraordinary happened in the small town by the sea, and everyone came out to look at it together.');
    // A paragraph continues across the page break unless the next page starts with an indent.
    expect(ch1[ch1.length - 1]).toBe('The first chapter ends right here at last.');
    expect(b.sections[2].blocks[0]).toEqual({ type: 'p', html: 'The second chapter opens with rain falling on every roof in town.' });
  });

  it('reports scanned PDFs', async () => {
    expect(await parsePdf(await buildScannedPdf(), 'scan.pdf')).toMatchObject({ ok: false, reason: 'scanned' });
  });

  it('reports corrupt PDFs', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\nthis is not really a pdf');
    expect(await parsePdf(bytes, 'bad.pdf')).toMatchObject({ ok: false, reason: 'corrupt' });
  });
});

describe('mergeDropCaps', () => {
  // A two-line drop cap, laid out like the Beware of Chicken PDF: the cap sits on the second
  // line's baseline and pushes the first two lines right.
  const page = (cap: string, first: string, rest: RawItem[] = []): RawItem[] => [
    { str: 'CHAPTER 1', x: 250, y: 625, width: 108, size: 19 },
    { str: cap, x: 81, y: 476, width: 30, size: 44.5 },
    { str: first, x: 115, y: 495, width: 360, size: 15 },
    { str: 'repeating the request.', x: 115, y: 476.7, width: 400, size: 15 },
    { str: 'trick was not being played.', x: 77, y: 458, width: 220, size: 15 },
    ...rest,
  ];
  const words = wordCounts(['It was here. It is there, an old man and an owl.', 'I jolted, a warm wind, you and you.']);

  it('joins the letter to the first line, not the line beside it', () => {
    const out = mergeDropCaps(page('Y', 'ou wish to leave?'), words);
    expect(out.map((i) => i.str)).toEqual(['CHAPTER 1', 'You wish to leave?', 'repeating the request.', 'trick was not being played.']);
    expect(out.find((i) => i.str.startsWith('You'))!.x).toBe(81);
    expect(out.find((i) => i.str.startsWith('repeating'))!.x).toBe(81);
  });

  it('spaces letters that are words only when the book says so', () => {
    const first = (cap: string, line: string) => mergeDropCaps(page(cap, line), words).find((i) => i.y === 495)!.str;
    expect(first('I', 't was the fourth day')).toBe('It was the fourth day');
    expect(first('I', 'jolted awake')).toBe('I jolted awake');
    expect(first('A', 'n old man sat')).toBe('An old man sat');
    expect(first('A', 'warm wind blew')).toBe('A warm wind blew');
  });

  it('leaves later items on the first line in place', () => {
    const out = mergeDropCaps(page('B', 'i De knew', [{ str: 'his Great', x: 128, y: 495, width: 60, size: 15 }]), words);
    expect(out.find((i) => i.str === 'his Great')!.x).toBe(128);
  });

  it('leaves a big letter with no text beside it alone', () => {
    const items: RawItem[] = [{ str: 'A', x: 300, y: 400, width: 30, size: 60 }, { str: 'Body text', x: 77, y: 300, width: 100, size: 15 }];
    expect(mergeDropCaps(items, words)).toEqual(items);
  });
});
