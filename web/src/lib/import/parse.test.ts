import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildEpub2, buildPdf } from './fixtures/build';
import { parseBook } from './parse';

const KINDLE = "Kindle files aren't supported yet. Export a DRM-free EPUB instead.";

describe('parseBook', () => {
  it('dispatches EPUBs by magic bytes, whatever the extension', async () => {
    const r = await parseBook(await buildEpub2(), 'download.bin');
    expect(r.ok && r.book.format).toBe('EPUB');
  });

  it('dispatches PDFs by magic bytes', async () => {
    const r = await parseBook(await buildPdf(), 'book');
    expect(r.ok && r.book.format).toBe('PDF');
  });

  it('rejects Kindle files by extension and by header', async () => {
    expect(await parseBook(new Uint8Array(100), 'book.azw3')).toEqual({ ok: false, reason: 'unsupported', detail: KINDLE });
    const mobi = new Uint8Array(100);
    mobi.set(new TextEncoder().encode('BOOKMOBI'), 60);
    expect(await parseBook(mobi, 'book')).toEqual({ ok: false, reason: 'unsupported', detail: KINDLE });
  });

  it('rejects unknown files as unsupported', async () => {
    expect(await parseBook(new TextEncoder().encode('just some text'), 'notes.txt')).toMatchObject({ ok: false, reason: 'unsupported' });
    const zip = new JSZip();
    zip.file('word/document.xml', '<x/>');
    expect(await parseBook(await zip.generateAsync({ type: 'uint8array' }), 'doc.docx')).toMatchObject({ ok: false, reason: 'unsupported' });
  });

  it('reports damaged EPUB/PDF files as corrupt', async () => {
    expect(await parseBook(new TextEncoder().encode('garbage'), 'book.epub')).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(await parseBook(new Uint8Array(0), 'book.pdf')).toMatchObject({ ok: false, reason: 'corrupt' });
  });
});
