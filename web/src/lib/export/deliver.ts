import { issueSignedToken, presignUrl, put } from '@vercel/blob';
import { accountPrefix } from '../storage';
import { fileName } from './xhtml';

// Function responses top out at 4.5 MB on Vercel, so bigger exports are written to the
// private Blob store and handed over through a short-lived signed link instead.
const DIRECT_LIMIT = 4 * 1024 * 1024;

/** `inline` opens a PDF in the browser (to read or print) instead of downloading it. */
export async function deliver(userId: string, bytes: Uint8Array, base: string, ext: 'epub' | 'pdf', inline = false) {
  const type = ext === 'epub' ? 'application/epub+zip' : 'application/pdf';
  const name = `${fileName(base)}.${ext}`;
  if (bytes.byteLength <= DIRECT_LIMIT) {
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': type,
        'Content-Disposition': `${inline && ext === 'pdf' ? 'inline' : 'attachment'}; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  }
  const pathname = `${accountPrefix(userId)}exports/${crypto.randomUUID()}/${name}`;
  await put(pathname, Buffer.from(bytes), { access: 'private', contentType: type, addRandomSuffix: false });
  const validUntil = Date.now() + 10 * 60 * 1000;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
  const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil });
  return Response.redirect(presignedUrl, 303);
}
