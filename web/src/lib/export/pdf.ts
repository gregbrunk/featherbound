import type { Block } from '../import/types';
import { editionNote, type ExportBook } from './gather';
import { escapeXml, toXhtml } from './xhtml';

// PDF: the book laid out as print HTML (6 × 9 inch pages, the reader's fonts) and printed by
// headless Chrome. On Vercel that's @sparticuz/chromium; locally it's the installed Chrome.

const dataUri = (img: { bytes: Uint8Array; type: string }) => `data:${img.type};base64,${Buffer.from(img.bytes).toString('base64')}`;

function blocksHtml(blocks: Block[], images: ExportBook['images']) {
  return blocks.map((b) => {
    if (b.type === 'hr') return '<p class="break">⁂</p>';
    if (b.type === 'img') {
      const img = images.get(b.imageId);
      return img ? `<figure><img src="${dataUri(img)}" alt="${escapeXml(b.alt)}"/></figure>` : '';
    }
    if (b.type === 'h') return `<h3>${toXhtml(b.html)}</h3>`;
    if (b.type === 'quote') return `<blockquote>${toXhtml(b.html)}</blockquote>`;
    return `<p>${toXhtml(b.html)}</p>`;
  }).join('\n');
}

export function printHtml(book: ExportBook) {
  const chapters = book.chapters.map((c) => `
<section class="chapter">
  <h1>${escapeXml(c.title)}</h1>
  ${c.subtitle ? `<p class="subtitle">${escapeXml(c.subtitle)}</p>` : ''}
  <div class="flourish">✦ ❦ ✦</div>
  ${c.recap ? `<p class="recap"><em>The story so far…</em> ${toXhtml(c.recap)}</p>` : ''}
  ${blocksHtml(c.blocks, book.images)}
</section>`).join('\n');

  return `<!doctype html>
<html lang="${escapeXml(book.language || 'en')}"><head><meta charset="utf-8"/>
<title>${escapeXml(book.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=block" rel="stylesheet"/>
<style>
@page { size: 6in 9in; margin: 0.75in 0.65in 0.85in; }
@page :first { margin: 0; }
html { font-family: 'Literata', Georgia, serif; font-size: 11pt; line-height: 1.5; color: #231b2e; }
body { margin: 0; }
.cover { width: 6in; height: 9in; display: flex; align-items: center; justify-content: center; break-after: page; overflow: hidden; }
.cover img { width: 100%; height: 100%; object-fit: contain; }
.title-page { height: 7.2in; display: flex; flex-direction: column; justify-content: center; text-align: center; break-after: page; }
.title-page h1 { font-family: 'Fraunces', serif; font-size: 28pt; line-height: 1.15; margin: 0 0 12pt; }
.title-page .author { font-size: 13pt; margin: 0 0 36pt; }
.title-page p { text-indent: 0; text-align: center; }
.title-page .note { font-size: 9pt; color: #6d6479; margin: 0 0 4pt; }
.chapter { break-before: page; }
.chapter h1 { font-family: 'Fraunces', serif; font-size: 18pt; text-align: center; margin: 0.6in 0 4pt; line-height: 1.2; }
.subtitle { text-align: center; font-style: italic; color: #6d6479; margin: 0 0 6pt; }
.flourish { text-align: center; color: #d4a23a; margin: 6pt 0 18pt; letter-spacing: 6pt; }
p { margin: 0; text-indent: 1.4em; orphans: 2; widows: 2; text-align: justify; hyphens: auto; }
.flourish + p, .recap + p, .break + p, h3 + p, figure + p { text-indent: 0; }
h3 { text-align: center; font-size: 11pt; margin: 12pt 0 8pt; break-after: avoid; }
blockquote { margin: 8pt 1.5em; font-style: italic; }
.recap { text-indent: 0; margin: 0 0 14pt; padding: 8pt 10pt; border-left: 3pt solid #d4a23a; background: #fbf6ea; font-size: 10pt; text-align: left; }
.break { text-align: center; text-indent: 0; margin: 8pt 0; color: #6d6479; }
figure { margin: 10pt 0; text-align: center; break-inside: avoid; }
figure img { max-width: 100%; max-height: 6.5in; }
</style></head>
<body>
${book.cover ? `<div class="cover"><img src="${dataUri(book.cover)}" alt=""/></div>` : ''}
<div class="title-page">
  <h1>${escapeXml(book.title)}</h1>
  ${book.author ? `<p class="author">${escapeXml(book.author)}</p>` : ''}
  <p class="note">${escapeXml(editionNote(book))}</p>
  ${book.edition ? '<p class="note">A gentler edition for family reading, adapted from the original. Plot and outcomes are unchanged.</p>' : ''}
</div>
${chapters}
</body></html>`;
}

async function launch() {
  const puppeteer = await import('puppeteer-core');
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    });
  }
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
}

export async function buildPdf(book: ExportBook): Promise<Uint8Array> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(printHtml(book), { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    const pdf = await page.pdf({
      width: '6in',
      height: '9in',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;text-align:center;font-family:Georgia,serif;font-size:8pt;color:#8a8194;"><span class="pageNumber"></span></div>',
      timeout: 240_000,
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
