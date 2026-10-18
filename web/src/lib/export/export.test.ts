import JSZip from 'jszip';
import { XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import { buildEpub } from './epub';
import type { ExportBook } from './gather';
import { printHtml } from './pdf';
import { sniffImage, toXhtml } from './xhtml';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const book: ExportBook = {
  id: 'ed-1.0.0',
  title: 'The Wonderful Wizard of Oz',
  author: 'L. Frank Baum',
  language: 'en',
  edition: { name: 'Age 7 · Read-aloud', version: '1.0.0', versionName: 'Softer Winds' },
  cover: { id: 'cover', bytes: PNG, type: 'image/png', ext: 'png' },
  chapters: [
    { title: 'The Day the Wind Came Calling', subtitle: 'Chapter I The Cyclone', blocks: [{ type: 'p', html: 'Dorothy &amp; Toto &nbsp;lived on the <em>great</em> prairie.' }, { type: 'img', imageId: 'img_1', alt: 'The house' }, { type: 'hr' }] },
    { title: 'Bump!', recap: 'A cyclone carried Dorothy away.', blocks: [{ type: 'p', html: 'Unbalanced <strong>bold <em>and</strong> italic<br>line' }] },
  ],
  images: new Map([['img_1', { id: 'img_1', bytes: PNG, type: 'image/png', ext: 'png' }]]),
  fileBase: 'Oz',
};

describe('xhtml', () => {
  it('decodes HTML entities and re-escapes for XML', () => {
    expect(toXhtml('Tom &amp; Jerry&nbsp;&mdash; <em>ok</em>')).toBe('Tom &amp; Jerry — <em>ok</em>');
  });
  it('balances and normalises tags, dropping anything else', () => {
    expect(toXhtml('<b>a <i>b</b> c<br> <span>d</span></em>')).toBe('<strong>a <em>b</em></strong><em> c<br/> d</em>');
  });
  it('recognises image types', () => {
    expect(sniffImage(PNG)?.ext).toBe('png');
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff]))?.ext).toBe('jpg');
    expect(sniffImage(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('EPUB export', () => {
  it('builds a valid package: mimetype first and stored, well-formed XML everywhere', async () => {
    const bytes = await buildEpub(book);
    // The mimetype entry is the first file and uncompressed, so its name sits at a fixed offset.
    expect(new TextDecoder().decode(bytes.slice(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(bytes.slice(38, 58))).toBe('application/epub+zip');

    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files);
    for (const n of ['META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/nav.xhtml', 'OEBPS/toc.ncx', 'OEBPS/title.xhtml', 'OEBPS/chapter-001.xhtml', 'OEBPS/chapter-002.xhtml', 'OEBPS/images/img_1.png', 'OEBPS/images/cover.png']) {
      expect(names).toContain(n);
    }
    for (const n of names.filter((x) => /\.(xhtml|opf|ncx|xml)$/.test(x))) {
      const xml = await zip.file(n)!.async('string');
      expect(XMLValidator.validate(xml), n).toBe(true);
    }
    const title = await zip.file('OEBPS/title.xhtml')!.async('string');
    expect(title).toContain('Age 7 · Read-aloud · v1.0.0 “Softer Winds” · Featherbound');
    const ch2 = await zip.file('OEBPS/chapter-002.xhtml')!.async('string');
    expect(ch2).toContain('The story so far…');
  });
});

describe('PDF print HTML', () => {
  it('has a title page note, chapter breaks and embedded pictures', () => {
    const html = printHtml(book);
    expect(html).toContain('Softer Winds');
    expect(html.match(/class="chapter"/g)).toHaveLength(2);
    expect(html).toContain('data:image/png;base64,');
  });
});
