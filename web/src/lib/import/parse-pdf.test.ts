import { describe, expect, it } from 'vitest';
import { buildPdf, buildScannedPdf } from './fixtures/build';
import { parsePdf } from './parse-pdf';
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
