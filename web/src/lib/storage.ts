import { createHash } from 'node:crypto';
import { del, get, head, put } from '@vercel/blob';

// Every file lives in the private Blob store under accounts/<userId>/…, and is only served
// through our own auth-checked routes. Chapter text is content-addressed (sha256), so an
// unchanged chapter is stored once no matter how many versions point at it.

export const accountPrefix = (userId: string) => `accounts/${userId}/`;

export const paths = {
  upload: (userId: string, name: string) => `${accountPrefix(userId)}uploads/${name}`,
  text: (userId: string, hash: string) => `${accountPrefix(userId)}text/${hash}.json`,
  bookFile: (userId: string, bookId: string, name: string) => `${accountPrefix(userId)}books/${bookId}/${name}`,
};

export function ownsPath(userId: string, pathname: string) {
  return pathname.startsWith(accountPrefix(userId)) && !pathname.includes('..');
}

export async function readBlob(pathname: string): Promise<Uint8Array> {
  const res = await get(pathname, { access: 'private' });
  if (!res || res.statusCode !== 200) throw new Error(`Blob not found: ${pathname}`);
  return new Uint8Array(await new Response(res.stream).arrayBuffer());
}

export async function readJson<T>(pathname: string): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await readBlob(pathname))) as T;
}

/** Stream a private blob back to the browser (after the caller has checked ownership). */
export async function blobResponse(pathname: string, init: { contentType?: string; download?: string; cache?: string } = {}) {
  const res = await get(pathname, { access: 'private' });
  if (!res || res.statusCode !== 200) return new Response('Not found', { status: 404 });
  const headers = new Headers({
    'Content-Type': init.contentType ?? res.blob.contentType ?? 'application/octet-stream',
    'Cache-Control': init.cache ?? 'private, max-age=3600',
  });
  if (init.download) headers.set('Content-Disposition', `attachment; filename="${init.download.replace(/"/g, '')}"`);
  return new Response(res.stream, { headers });
}

export async function writeFile(pathname: string, body: Uint8Array | string, contentType: string) {
  await put(pathname, Buffer.from(body), { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: true });
}

/** Store JSON by content hash and return its pathname. Skips the upload if it already exists. */
export async function writeContentAddressed(userId: string, value: unknown) {
  const json = JSON.stringify(value);
  const hash = createHash('sha256').update(json).digest('hex');
  const pathname = paths.text(userId, hash);
  try {
    await head(pathname);
    return pathname;
  } catch {
    await put(pathname, json, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    return pathname;
  }
}

export async function deletePaths(pathnames: string[]) {
  if (pathnames.length) await del(pathnames);
}
