// Entry point for book import: detect the file format and dispatch to the right parser.
import { parseEpub } from './parse-epub';
import { parsePdf } from './parse-pdf';
import type { ParseResult } from './types';

const KINDLE_DETAIL = "Kindle files aren't supported yet. Export a DRM-free EPUB instead.";
const KINDLE_EXT = /\.(?:mobi|azw|azw3|azw4|kfx|kfx-zip|prc|tpz)$/i;

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, Math.min(end, bytes.length)));
}

type Detected = 'zip' | 'pdf' | 'kindle' | null;

function sniff(bytes: Uint8Array): Detected {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'zip';
  if (ascii(bytes, 0, 1024).includes('%PDF-')) return 'pdf';
  const palmType = ascii(bytes, 60, 68);
  if (palmType === 'BOOKMOBI' || palmType === 'TEXtREAd' || palmType.startsWith('TPZ')) return 'kindle';
  if (ascii(bytes, 0, 4) === 'CONT' || ascii(bytes, 1, 7) === 'DRMION' || ascii(bytes, 0, 3) === 'TPZ') return 'kindle';
  return null;
}

/** Parse an uploaded book file (EPUB or text-based PDF) into sections, metadata and images. */
export async function parseBook(bytes: Uint8Array, fileName: string): Promise<ParseResult> {
  const ext = (fileName.match(/\.[^./\\]+$/)?.[0] ?? '').toLowerCase();
  try {
    if (bytes.length === 0) return { ok: false, reason: 'corrupt', detail: 'The file is empty.' };
    const kind = sniff(bytes);
    if (kind === 'kindle' || KINDLE_EXT.test(fileName)) return { ok: false, reason: 'unsupported', detail: KINDLE_DETAIL };
    if (kind === 'pdf') return await parsePdf(bytes, fileName);
    if (kind === 'zip') {
      if (ext === '.epub') return await parseEpub(bytes, fileName);
      // Any other zip: treat it as an EPUB only if it looks like one.
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(bytes).catch(() => null);
      if (zip?.file('META-INF/container.xml')) return await parseEpub(bytes, fileName);
      return { ok: false, reason: 'unsupported', detail: 'This file isn’t a book format Featherbound can read. Upload an EPUB or a PDF.' };
    }
    if (ext === '.epub' || ext === '.pdf') {
      return { ok: false, reason: 'corrupt', detail: `This ${ext.slice(1).toUpperCase()} file is damaged and couldn’t be opened.` };
    }
    return { ok: false, reason: 'unsupported', detail: 'This file isn’t a book format Featherbound can read. Upload an EPUB or a PDF.' };
  } catch (e) {
    return { ok: false, reason: 'corrupt', detail: `The file couldn’t be read (${(e as Error).message}).` };
  }
}
