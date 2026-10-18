// Cover lookup from Open Library (one of the catalogs Calibre uses). Google Books needs an API
// key for reliable quota, so it can be added later as a second source.

export type CoverCandidate = { source: 'openlibrary'; url: string; label: string };

const UA = 'Featherbound/1.0 (private family library; https://featherbound.ink)';

export async function findCovers(title: string, author: string, isbn?: string): Promise<CoverCandidate[]> {
  const out: CoverCandidate[] = [];
  const seen = new Set<string>();
  const add = (url: string, label: string) => {
    if (!seen.has(url)) {
      seen.add(url);
      out.push({ source: 'openlibrary', url, label });
    }
  };
  try {
    if (isbn) {
      const isbnUrl = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;
      const res = await fetch(isbnUrl, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
      if (res.ok) add(isbnUrl.replace('?default=false', ''), 'Matches this edition’s ISBN');
    }
    const q = new URLSearchParams({ title, author, fields: 'key,title,author_name,cover_i,language,edition_count', limit: '8' });
    const res = await fetch(`https://openlibrary.org/search.json?${q}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = (await res.json()) as { docs: { cover_i?: number; title: string; language?: string[]; edition_count?: number }[] };
      const docs = data.docs
        .filter((d) => d.cover_i)
        .sort((a, b) => Number(b.language?.includes('eng') ?? false) - Number(a.language?.includes('eng') ?? false) || (b.edition_count ?? 0) - (a.edition_count ?? 0));
      for (const d of docs.slice(0, 4)) add(`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`, d.title);
    }
  } catch {
    // Cover lookup is best-effort; the book still imports with a generated cover.
  }
  return out;
}

export async function downloadImage(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok || !contentType.startsWith('image/')) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > 1000 ? { bytes, contentType } : null; // Open Library's 1×1 placeholder
  } catch {
    return null;
  }
}

const PALETTES: [string, string][] = [
  ['#3f6b4a', '#1d3326'], ['#7a2433', '#3d0f1a'], ['#2f5fb3', '#14244f'], ['#e3a33b', '#a2541d'],
  ['#5a2d7a', '#1e0d2e'], ['#2aa69a', '#0f4f53'], ['#4a3a7a', '#1c1438'], ['#8a6a2b', '#3a2a0d'],
];

/** A stable generated cover for books without art. */
export function fallbackCover(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [from, to] = PALETTES[h % PALETTES.length];
  return { from, to, emblem: 'feather', ink: '#F6E3AE' };
}
