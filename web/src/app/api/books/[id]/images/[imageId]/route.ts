import { getBook } from '@/lib/library';
import { getAccount } from '@/lib/session';
import { blobResponse, paths } from '@/lib/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const account = await getAccount();
  if (!account) return new Response('Unauthorized', { status: 401 });
  const { id, imageId } = await params;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(imageId)) return new Response('Not found', { status: 404 });
  const book = await getBook(account.userId, id);
  if (!book) return new Response('Not found', { status: 404 });
  return blobResponse(paths.bookFile(account.userId, book.id, `images/${imageId}`), { cache: 'private, max-age=31536000, immutable' });
}
