import { decodeHTML } from 'entities';

// Chapter text is stored as a tiny HTML subset (<em>, <strong>, <br>). EPUB needs strict
// XHTML, and model output can arrive with unbalanced tags or HTML-only entities, so every
// paragraph is rebuilt: text decoded then re-escaped, tags normalised and balanced.

export const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toXhtml(html: string) {
  const out: string[] = [];
  const open: string[] = [];
  for (const part of html.split(/(<[^>]*>)/g)) {
    if (!part) continue;
    const tag = /^<\s*(\/?)\s*(em|strong|i|b|br)\b[^>]*>$/i.exec(part);
    if (!part.startsWith('<') || !part.endsWith('>')) {
      out.push(escapeXml(decodeHTML(part)));
      continue;
    }
    if (!tag) continue; // any other tag is dropped
    const closing = tag[1] === '/';
    const name = { i: 'em', b: 'strong' }[tag[2].toLowerCase()] ?? tag[2].toLowerCase();
    if (name === 'br') { out.push('<br/>'); continue; }
    if (!closing) { open.push(name); out.push(`<${name}>`); continue; }
    const at = open.lastIndexOf(name);
    if (at < 0) continue; // a closer with no opener
    // Close anything opened inside it first, so nesting stays valid.
    for (let k = open.length - 1; k >= at; k--) out.push(`</${open[k]}>`);
    open.splice(at, 1);
    for (let k = at; k < open.length; k++) out.push(`<${open[k]}>`);
  }
  for (let k = open.length - 1; k >= 0; k--) out.push(`</${open[k]}>`);
  return out.join('');
}

/** Work out an image's type from its first bytes. */
export function sniffImage(bytes: Uint8Array): { type: string; ext: string } | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8) return { type: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: 'image/png', ext: 'png' };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { type: 'image/gif', ext: 'gif' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return { type: 'image/webp', ext: 'webp' };
  const head = new TextDecoder().decode(b.slice(0, 200)).trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return { type: 'image/svg+xml', ext: 'svg' };
  return null;
}

/** A safe file name for downloads. */
export const fileName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Book';
