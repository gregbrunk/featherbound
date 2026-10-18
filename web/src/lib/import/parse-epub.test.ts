import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildEncryptedEpub, buildEpub2, buildEpub3, zipEpub } from './fixtures/build';
import { parseEpub } from './parse-epub';
import { blockText } from './sections';
import type { ParsedBook, ParseResult } from './types';

function book(r: ParseResult): ParsedBook {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}: ${r.detail}`);
  return r.book;
}

describe('parseEpub: EPUB3 with nav', () => {
  it('reads metadata, series, ISBN and cover', async () => {
    const b = book(await parseEpub(await buildEpub3(), 'orchard.epub'));
    expect(b.format).toBe('EPUB');
    expect(b.metadata).toMatchObject({
      title: 'The Glass Orchard',
      authors: ['Ada Quill'], // the illustrator is not an author
      description: 'A tale of glass & fruit.',
      language: 'en-GB',
      publisher: 'Feather Press',
      isbn: '9780306406157',
      series: { name: 'Orchard Cycle', position: 2 },
      subjects: ['Fantasy', 'Orchards'],
    });
    expect(b.cover?.mediaType).toBe('image/png');
    expect(b.cover?.bytes.length).toBeGreaterThan(0);
  });

  it('splits sections at TOC entries, including a mid-file anchor', async () => {
    const b = book(await parseEpub(await buildEpub3(), 'orchard.epub'));
    expect(b.sections.map((s) => [s.title, s.kind, s.include])).toEqual([
      ['Front matter', 'front', false],
      ['Copyright', 'front', false],
      ['Prologue', 'chapter', true],
      ['Chapter 1: The Seed', 'chapter', true],
      ['Chapter 2: The Frost', 'chapter', true],
      ['Acknowledgments', 'back', false],
      ['About the Author', 'back', false],
    ]);
    const ch2 = b.sections[4];
    expect(ch2.blocks.map(blockText)).toEqual(['Frost came early.', 'A subsection', 'Still chapter two.']);
    expect(ch2.words).toBe(8);
  });

  it('converts XHTML to safe blocks', async () => {
    const b = book(await parseEpub(await buildEpub3(), 'orchard.epub'));
    const ch1 = b.sections.find((s) => s.title === 'Chapter 1: The Seed')!;
    const fig = b.images.find((i) => i.id !== b.cover?.id)!;
    expect(ch1.blocks).toEqual([
      { type: 'p', html: 'The <em>orchard</em> was made of <strong>glass</strong> &amp; light, and nobody knew—why.' },
      { type: 'p', html: 'Second paragraph spans lines.' },
      { type: 'img', imageId: fig.id, alt: 'A glass tree' },
      { type: 'p', html: 'A leaf div with <em>emphasis</em><br>and a break.' },
      { type: 'quote', html: 'A quoted line.' },
      { type: 'hr' },
      { type: 'h', level: 3, html: 'A small heading' },
      { type: 'p', html: 'End of chapter one.' },
    ]);
    expect(fig.mediaType).toBe('image/png');
    expect(fig.id).toMatch(/^img_[0-9a-f]{16}$/);
    // Ids are stable across parses.
    const again = book(await parseEpub(await buildEpub3(), 'orchard.epub'));
    expect(again.images.map((i) => i.id).sort()).toEqual(b.images.map((i) => i.id).sort());
  });

  it('reads an EPUB3 belongs-to-collection series', async () => {
    const bytes = await buildEpub3({
      metadataExtra: `<meta property="belongs-to-collection" id="c1">Glass Saga</meta><meta refines="#c1" property="collection-type">series</meta><meta refines="#c1" property="group-position">3</meta>`,
    });
    expect(book(await parseEpub(bytes, 'x.epub')).metadata.series).toEqual({ name: 'Glass Saga', position: 3 });
  });
});

describe('parseEpub: EPUB2 with NCX', () => {
  it('uses the NCX, descending past a single top-level entry', async () => {
    const b = book(await parseEpub(await buildEpub2(), 'river.epub'));
    expect(b.metadata).toMatchObject({ title: 'Old River', authors: ['Mara Stone', 'Lee Stone'], isbn: '0306406152' });
    expect(b.cover?.mediaType).toBe('image/png');
    expect(b.sections.map((s) => s.title)).toEqual(['One', 'Two', 'Three']);
    expect(b.sections.every((s) => s.kind === 'chapter' && s.include)).toBe(true);
    // Content before the "#start" anchor in file three belongs to the previous section.
    expect(b.sections[1].blocks.map(blockText)).toEqual(['The river was wide.', 'Preamble in file three.']);
    expect(b.sections[2].blocks.map(blockText)).toEqual(['The river ended.']);
  });

  it('falls back to one section per spine document without a TOC', async () => {
    const bytes = await zipEpub({
      'OEBPS/content.opf': `<package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>No Toc</dc:title></metadata>
<manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="a"/><itemref idref="b"/></spine></package>`,
      'OEBPS/a.xhtml': '<html><body><h1>First Light</h1><p>Alpha.</p></body></html>',
      'OEBPS/b.xhtml': '<html><body><h1>Second Light</h1><p>Beta.</p></body></html>',
    });
    const b = book(await parseEpub(bytes, 'no-toc.epub'));
    expect(b.sections.map((s) => [s.title, s.blocks.map(blockText)])).toEqual([
      ['First Light', ['Alpha.']],
      ['Second Light', ['Beta.']],
    ]);
    expect(b.warnings.length).toBeGreaterThan(0);
  });
});

describe('parseEpub: DRM', () => {
  it('rejects AES-encrypted content', async () => {
    const r = await parseEpub(await buildEncryptedEpub('http://www.w3.org/2001/04/xmlenc#aes128-cbc', 'OEBPS/c1.html'), 'drm.epub');
    expect(r).toMatchObject({ ok: false, reason: 'drm' });
  });

  it('rejects books with rights.xml', async () => {
    const bytes = await zipEpub({ 'META-INF/rights.xml': '<rights/>' });
    expect(await parseEpub(bytes, 'adept.epub')).toMatchObject({ ok: false, reason: 'drm' });
  });

  it('accepts font obfuscation only', async () => {
    const r = await parseEpub(await buildEncryptedEpub('http://www.idpf.org/2008/embedding', 'OEBPS/fonts/serif.otf'), 'fonts.epub');
    expect(r.ok).toBe(true);
  });
});

describe('parseEpub: corrupt files', () => {
  it('reports a missing container as corrupt', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('hello.txt', 'hi');
    expect(await parseEpub(await zip.generateAsync({ type: 'uint8array' }), 'x.epub')).toMatchObject({ ok: false, reason: 'corrupt' });
  });
});

describe('parseEpub: The Wonderful Wizard of Oz (Project Gutenberg)', () => {
  const bytes = readFileSync(fileURLToPath(new URL('./fixtures/oz.epub', import.meta.url)));

  it('finds the metadata and 24 chapters', async () => {
    const b = book(await parseEpub(bytes, 'oz.epub'));
    expect(b.metadata.title).toBe('The Wonderful Wizard of Oz');
    expect(b.metadata.authors).toEqual(['L. Frank Baum']);
    expect(b.cover?.mediaType).toBe('image/jpeg');

    const chapters = b.sections.filter((s) => s.include);
    expect(chapters).toHaveLength(24);
    expect(chapters.every((s) => s.kind === 'chapter')).toBe(true);
    expect(chapters[0].title).toContain('Cyclone');
    expect(chapters[23].title).toContain('Home Again');
    const first = chapters[0].blocks[0];
    expect(first.type).toBe('p');
    expect(blockText(first)).toMatch(/^Dorothy lived in the midst/);
    expect(chapters[0].words).toBeGreaterThan(1000);
  });

  it('keeps Project Gutenberg boilerplate out of the chapters', async () => {
    const b = book(await parseEpub(bytes, 'oz.epub'));
    for (const s of b.sections.filter((x) => x.include)) {
      const text = s.blocks.map(blockText).join('\n');
      expect(text).not.toMatch(/project gutenberg/i);
    }
    const licence = b.sections.find((s) => /FULL PROJECT GUTENBERG/i.test(s.title));
    expect(licence).toMatchObject({ kind: 'back', include: false });
  });
});
