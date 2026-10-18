import JSZip from 'jszip';
import type { Block } from '../import/types';
import { editionNote, type ExportBook } from './gather';
import { escapeXml, toXhtml } from './xhtml';

// EPUB 3 with an EPUB 2 table of contents (toc.ncx) as well, which older Kobo firmware reads.
// The mimetype file comes first and uncompressed, as the spec requires.

const CSS = `
body { font-family: serif; line-height: 1.55; margin: 0 5%; }
h1 { font-size: 1.5em; text-align: center; margin: 2em 0 0.3em; line-height: 1.25; }
.subtitle { text-align: center; font-style: italic; opacity: 0.7; margin: 0 0 1.6em; }
p { margin: 0; text-indent: 1.2em; }
p.first, h1 + p, .subtitle + p, .recap + p, .break + p { text-indent: 0; }
h2, h3 { text-align: center; font-size: 1.1em; margin: 1.2em 0 0.6em; }
blockquote { margin: 0.8em 1.5em; font-style: italic; }
.recap { margin: 0 0 1.5em; padding: 0.6em 0.9em; border-left: 3px solid #d4a23a; font-style: normal; background: #fbf6ea; }
.break { text-align: center; margin: 0.8em 0; }
figure { margin: 1em 0; text-align: center; }
img { max-width: 100%; height: auto; }
.title-page { text-align: center; margin-top: 30%; }
.title-page h1 { font-size: 2em; margin-top: 0; }
.title-page .author { font-size: 1.15em; margin: 0.6em 0 2.4em; text-indent: 0; }
.title-page .note { font-size: 0.85em; opacity: 0.75; text-indent: 0; }
.cover { text-align: center; margin: 0; padding: 0; }
.cover img { max-height: 100%; }
`.trim();

const page = (title: string, lang: string, body: string, bodyClass = '') => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}">
<head><meta charset="utf-8"/><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${body}
</body>
</html>`;

function blocksXhtml(blocks: Block[], images: ExportBook['images']) {
  return blocks.map((b) => {
    if (b.type === 'hr') return '<p class="break">* * *</p>';
    if (b.type === 'img') {
      const img = images.get(b.imageId);
      return img ? `<figure><img src="images/${img.id}.${img.ext}" alt="${escapeXml(b.alt)}"/></figure>` : '';
    }
    if (b.type === 'h') return `<h${Math.min(3, b.level + 1)}>${toXhtml(b.html)}</h${Math.min(3, b.level + 1)}>`;
    if (b.type === 'quote') return `<blockquote><p>${toXhtml(b.html)}</p></blockquote>`;
    return `<p>${toXhtml(b.html)}</p>`;
  }).filter(Boolean).join('\n');
}

export async function buildEpub(book: ExportBook): Promise<Uint8Array> {
  const zip = new JSZip();
  const lang = escapeXml(book.language || 'en');
  const uid = `urn:featherbound:${book.id}`;
  const fullTitle = book.edition ? `${book.title} (${book.edition.name})` : book.title;
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

  const o = zip.folder('OEBPS')!;
  o.file('styles.css', CSS);
  const manifest: string[] = [
    '<item id="css" href="styles.css" media-type="text/css"/>',
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
  ];
  const spine: string[] = [];

  if (book.cover) {
    o.file(`images/cover.${book.cover.ext}`, book.cover.bytes);
    manifest.push(`<item id="cover-image" href="images/cover.${book.cover.ext}" media-type="${book.cover.type}" properties="cover-image"/>`);
    o.file('cover.xhtml', page('Cover', lang, `<div class="cover"><img src="images/cover.${book.cover.ext}" alt="${escapeXml(book.title)}"/></div>`));
    manifest.push('<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="cover" linear="yes"/>');
  }

  o.file('title.xhtml', page(book.title, lang, `<div class="title-page">
<h1>${escapeXml(book.title)}</h1>
${book.author ? `<p class="author">${escapeXml(book.author)}</p>` : ''}
<p class="note">${escapeXml(editionNote(book))}</p>
${book.edition ? '<p class="note">A gentler edition for family reading, adapted from the original. Plot and outcomes are unchanged.</p>' : ''}
</div>`));
  manifest.push('<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>');
  spine.push('<itemref idref="title"/>');

  for (const img of book.images.values()) {
    o.file(`images/${img.id}.${img.ext}`, img.bytes);
    manifest.push(`<item id="img-${escapeXml(img.id)}" href="images/${escapeXml(img.id)}.${img.ext}" media-type="${img.type}"/>`);
  }

  book.chapters.forEach((c, i) => {
    const name = `chapter-${String(i + 1).padStart(3, '0')}.xhtml`;
    const body = [
      `<section epub:type="chapter"><h1>${escapeXml(c.title)}</h1>`,
      c.subtitle ? `<p class="subtitle">${escapeXml(c.subtitle)}</p>` : '',
      c.recap ? `<p class="recap"><em>The story so far…</em> ${toXhtml(c.recap)}</p>` : '',
      blocksXhtml(c.blocks, book.images),
      '</section>',
    ].join('\n');
    o.file(name, page(c.title, lang, body));
    manifest.push(`<item id="ch${i + 1}" href="${name}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="ch${i + 1}"/>`);
  });

  const toc = book.chapters.map((c, i) => ({ href: `chapter-${String(i + 1).padStart(3, '0')}.xhtml`, title: c.title }));
  o.file('nav.xhtml', page('Contents', lang, `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>
${toc.map((t) => `<li><a href="${t.href}">${escapeXml(t.title)}</a></li>`).join('\n')}
</ol></nav>`));
  o.file('toc.ncx', `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${escapeXml(uid)}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
<docTitle><text>${escapeXml(fullTitle)}</text></docTitle>
<navMap>
${toc.map((t, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeXml(t.title)}</text></navLabel><content src="${t.href}"/></navPoint>`).join('\n')}
</navMap>
</ncx>`);

  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  o.file('content.opf', `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="${lang}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">${escapeXml(uid)}</dc:identifier>
<dc:title>${escapeXml(fullTitle)}</dc:title>
${book.author ? `<dc:creator>${escapeXml(book.author)}</dc:creator>` : ''}
<dc:language>${lang}</dc:language>
<dc:description>${escapeXml(editionNote(book))}</dc:description>
<meta property="dcterms:modified">${modified}</meta>
${book.cover ? '<meta name="cover" content="cover-image"/>' : ''}
</metadata>
<manifest>
${manifest.join('\n')}
</manifest>
<spine toc="ncx">
${spine.join('\n')}
</spine>
</package>`);

  return zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}
