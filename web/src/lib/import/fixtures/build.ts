// Test fixture builders: small EPUBs (jszip) and PDFs (pdf-lib) generated in memory.
import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/** 1x1 transparent PNG. */
export const PNG_1PX = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
);

export async function zipEpub(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'uint8array' });
}

const xhtml = (title: string, body: string) =>
  `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title><link rel="stylesheet" href="style.css"/></head><body>${body}</body></html>`;

/** EPUB3 with nav TOC, mid-file anchors, front/back matter, inline formatting, an image and calibre series. */
export async function buildEpub3(opts: { metadataExtra?: string } = {}): Promise<Uint8Array> {
  const metadataExtra =
    opts.metadataExtra ??
    `<meta name="calibre:series" content="Orchard Cycle"/><meta name="calibre:series_index" content="2"/>`;
  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="uid">urn:uuid:1234</dc:identifier>
    <dc:identifier>urn:isbn:978-0-306-40615-7</dc:identifier>
    <dc:title>The Glass Orchard</dc:title>
    <dc:creator id="a1">Ada Quill</dc:creator>
    <meta refines="#a1" property="role" scheme="marc:relators">aut</meta>
    <dc:creator id="a2">Bo Painter</dc:creator>
    <meta refines="#a2" property="role" scheme="marc:relators">ill</meta>
    <dc:description>&lt;p&gt;A &lt;b&gt;tale&lt;/b&gt; of glass &amp;amp; fruit.&lt;/p&gt;</dc:description>
    <dc:language>en-GB</dc:language>
    <dc:publisher>Feather Press</dc:publisher>
    <dc:subject>Fantasy</dc:subject>
    <dc:subject>Orchards</dc:subject>
    ${metadataExtra}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover-img" href="images/cover.png" media-type="image/png" properties="cover-image"/>
    <item id="fig1" href="images/fig%201.png" media-type="image/png"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="copyright" href="text/copyright.xhtml" media-type="application/xhtml+xml"/>
    <item id="prologue" href="text/prologue.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapters" href="text/chapters.xhtml" media-type="application/xhtml+xml"/>
    <item id="back" href="text/back.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="cover"/><itemref idref="copyright"/><itemref idref="prologue"/>
    <itemref idref="chapters"/><itemref idref="back"/>
  </spine>
</package>`;
  const nav = xhtml(
    'Contents',
    `<nav epub:type="landmarks"><ol><li><a href="text/prologue.xhtml">Start</a></li></ol></nav>
<nav epub:type="toc"><h1>Contents</h1><ol>
  <li><a href="text/copyright.xhtml">Copyright</a></li>
  <li><a href="text/prologue.xhtml">Prologue</a></li>
  <li><a href="text/chapters.xhtml#ch1">Chapter 1: The Seed</a></li>
  <li><a href="text/chapters.xhtml#ch2">Chapter 2: The Frost</a>
    <ol><li><a href="text/chapters.xhtml#ch2-s1">A subsection</a></li></ol></li>
  <li><a href="text/back.xhtml">Acknowledgments</a></li>
  <li><a href="text/back.xhtml#about">About the Author</a></li>
</ol></nav>`,
  );
  const chapters = xhtml(
    'Chapters',
    `<section id="ch1"><h1>Chapter 1:<br/> The Seed</h1>
<p class="first">The <i>orchard</i> was made of <b>glass</b> &amp; light, and <span class="sc">nobody</span> knew&#8212;why.</p>
<p>   </p>
<p><a href="#n1"><sup>1</sup></a>Second   paragraph
   spans lines.</p>
<div class="figure"><img src="../images/fig%201.png" alt="A glass tree"/></div>
<div>A leaf div with <em>emphasis</em><br/>and a break.</div>
<blockquote><p>A quoted line.</p></blockquote>
<hr/>
<h4>A small heading</h4>
<p>End of chapter one.</p></section>
<section><h1 id="ch2">Chapter 2: The Frost</h1>
<p>Frost came early.</p>
<h2 id="ch2-s1">A subsection</h2>
<p>Still chapter two.</p></section>`,
  );
  return zipEpub({
    'OEBPS/content.opf': opf,
    'OEBPS/nav.xhtml': nav,
    'OEBPS/images/cover.png': PNG_1PX,
    'OEBPS/images/fig 1.png': PNG_1PX,
    'OEBPS/cover.xhtml': xhtml('Cover', `<div><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="images/cover.png"/></svg></div>`),
    'OEBPS/text/copyright.xhtml': xhtml('Copyright', `<h1>Copyright</h1><p>Copyright © 2026 Ada Quill. All rights reserved.</p>`),
    'OEBPS/text/prologue.xhtml': xhtml('Prologue', `<h1>Prologue</h1><p>Before the orchard, there was sand.</p>`),
    'OEBPS/text/chapters.xhtml': chapters,
    'OEBPS/text/back.xhtml': xhtml(
      'Back',
      `<h1>Acknowledgments</h1><p>Thanks to everyone.</p><h1 id="about">About the Author</h1><p>Ada Quill lives in a greenhouse.</p>`,
    ),
  });
}

/** EPUB2 with an NCX whose top level is a single "Book One" entry (so the next level is used). */
export async function buildEpub2(): Promise<Uint8Array> {
  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="uid" opf:scheme="ISBN">0306406152</dc:identifier>
    <dc:title>Old River</dc:title>
    <dc:creator opf:role="aut" opf:file-as="Stone, Mara">Mara Stone</dc:creator>
    <dc:creator opf:role="aut">Lee Stone</dc:creator>
    <dc:language>en</dc:language>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="cover-image" href="cover.png" media-type="image/png"/>
    <item id="c1" href="c1.html" media-type="application/xhtml+xml"/>
    <item id="c2" href="c2.html" media-type="application/xhtml+xml"/>
    <item id="c3" href="c3.html" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="c1"/><itemref idref="c2"/><itemref idref="c3"/></spine>
</package>`;
  const ncx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head/><docTitle><text>Old River</text></docTitle>
<navMap>
  <navPoint id="b1" playOrder="1"><navLabel><text>Book One</text></navLabel><content src="c1.html"/>
    <navPoint id="n1" playOrder="2"><navLabel><text>One</text></navLabel><content src="c1.html"/></navPoint>
    <navPoint id="n2" playOrder="3"><navLabel><text>Two</text></navLabel><content src="c2.html"/></navPoint>
    <navPoint id="n3" playOrder="4"><navLabel><text>Three</text></navLabel><content src="c3.html#start"/></navPoint>
  </navPoint>
</navMap></ncx>`;
  return zipEpub({
    'OEBPS/content.opf': opf,
    'OEBPS/toc.ncx': ncx,
    'OEBPS/cover.png': PNG_1PX,
    'OEBPS/c1.html': xhtml('1', `<h2>One</h2><p>The river was old.</p>`),
    'OEBPS/c2.html': xhtml('2', `<h2>Two</h2><p>The river was <strong>wide</strong>.</p>`),
    'OEBPS/c3.html': xhtml('3', `<p>Preamble in file three.</p><h2 id="start">Three</h2><p>The river ended.</p>`),
  });
}

export async function buildEncryptedEpub(algorithm: string, uri: string): Promise<Uint8Array> {
  const base = await JSZip.loadAsync(await buildEpub2());
  base.file(
    'META-INF/encryption.xml',
    `<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData><enc:EncryptionMethod Algorithm="${algorithm}"/><enc:CipherData><enc:CipherReference URI="${uri}"/></enc:CipherData></enc:EncryptedData>
</encryption>`,
  );
  return base.generateAsync({ type: 'uint8array' });
}

// --- PDF -------------------------------------------------------------------------------------

const BODY = 11;
const LEADING = 14;

/**
 * A 5-page text PDF: a title page, then two chapters with a running header on every
 * content page, page numbers in the footer, and a word hyphenated across a line break.
 */
export async function buildPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('The Test Book');
  pdf.setAuthor('Jane Doe & John Roe');
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  let pageNo = 0;

  const newPage = (withChrome: boolean) => {
    const page = pdf.addPage([612, 792]);
    pageNo++;
    if (withChrome) {
      page.drawText('THE TEST BOOK', { x: 250, y: 760, size: 9, font });
      page.drawText(String(pageNo), { x: 300, y: 30, size: 9, font });
    }
    return page;
  };

  // Title page.
  const title = newPage(false);
  title.drawText('The Test Book', { x: 200, y: 600, size: 28, font: bold });
  title.drawText('by Jane Doe and John Roe', { x: 220, y: 560, size: 14, font });
  title.drawText('Copyright 2026. All rights reserved. Printed nowhere at all.', { x: 72, y: 200, size: 9, font });

  // Paragraphs: arrays of pre-wrapped lines; first line indented.
  const filler = (n: number, seed: string) =>
    Array.from({ length: n }, (_, i) => `${seed} line ${i + 1} of the story goes on with several more words here`);
  const write = (page: ReturnType<typeof newPage>, paras: string[][], startY: number) => {
    let y = startY;
    for (const lines of paras) {
      lines.forEach((line, i) => {
        page.drawText(line, { x: i === 0 ? 92 : 72, y, size: BODY, font });
        y -= LEADING;
      });
    }
    return y;
  };

  const p2 = newPage(true);
  p2.drawText('Chapter One', { x: 72, y: 660, size: 20, font: bold });
  write(
    p2,
    [
      ['It was a quiet morning when the story began and', 'nothing at all seemed out of the ordinary.'],
      ['Then something truly extra-', 'ordinary happened in the small town by the sea,', 'and everyone came out to look at it together.'],
      filler(12, 'Chapter one'),
    ],
    620,
  );
  const p3 = newPage(true);
  write(p3, [filler(14, 'Continuing'), ['The first chapter ends right here at last.']], 700);

  const p4 = newPage(true);
  p4.drawText('Chapter Two', { x: 72, y: 660, size: 20, font: bold });
  write(p4, [['The second chapter opens with rain falling on', 'every roof in town.'], filler(14, 'Chapter two')], 620);
  const p5 = newPage(true);
  write(p5, [filler(14, 'Still raining'), ['And that was the end.']], 700);

  return pdf.save();
}

/** A PDF with pages but (almost) no text, like a scan. */
export async function buildScannedPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const page = pdf.addPage([612, 792]);
    page.drawRectangle({ x: 50, y: 50, width: 500, height: 680 });
    page.drawText(String(i + 1), { x: 300, y: 30, size: 9, font });
  }
  return pdf.save();
}

/** Shaped like Ready Player One: a few top-level "Levels", each holding numbered chapters. */
export async function buildNestedLevelsEpub(): Promise<Uint8Array> {
  const files = ['l1', 'c1', 'c2', 'l2', 'c3', 'c4', 'l3', 'c5', 'c6', 'end'];
  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">x</dc:identifier><dc:title>Quest Game</dc:title><dc:creator>A. Writer</dc:creator><dc:language>en</dc:language></metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${files.map((f) => `<item id="${f}" href="${f}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine>${files.map((f) => `<itemref idref="${f}"/>`).join('')}</spine>
</package>`;
  const li = (f: string, t: string, kids = '') => `<li><a href="${f}.xhtml">${t}</a>${kids}</li>`;
  const nav = `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>
<nav epub:type="toc"><ol>
  ${li('l1', 'Level One', `<ol>${li('c1', '0001')}${li('c2', '0002')}</ol>`)}
  ${li('l2', 'Level Two', `<ol>${li('c3', '0003')}${li('c4', '0004')}</ol>`)}
  ${li('l3', 'Level Three', `<ol>${li('c5', '0005')}${li('c6', '0006')}</ol>`)}
  ${li('end', 'Endgame')}
</ol></nav></body></html>`;
  const body: Record<string, string> = {};
  for (const f of files) {
    const n = f.replace(/\D/g, '');
    body[`OEBPS/${f}.xhtml`] = f.startsWith('c')
      ? xhtml(f, `<h2>000${n}</h2><p>Chapter ${n} begins here and goes on for a while.</p>`)
      : xhtml(f, `<h1>${f}</h1><p>${f === 'end' ? 'The game ended.' : 'An epigraph for this level.'}</p>`);
  }
  return zipEpub({ 'OEBPS/content.opf': opf, 'OEBPS/nav.xhtml': nav, ...body });
}
