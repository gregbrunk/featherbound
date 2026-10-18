import { getBook } from '@/lib/library';
import { getAccount } from '@/lib/session';
import { blobResponse } from '@/lib/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await getAccount();
  if (!account) return new Response('Unauthorized', { status: 401 });
  const book = await getBook(account.userId, (await params).id);
  if (!book?.coverPath) return new Response('Not found', { status: 404 });
  return blobResponse(book.coverPath, { cache: 'private, max-age=86400' });
}
