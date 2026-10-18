import { getBook, getSection } from '@/lib/library';
import { getAccount } from '@/lib/session';
import { blobResponse } from '@/lib/storage';

// Chapter text is immutable (content-addressed), so the browser can cache it for a long time.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const account = await getAccount();
  if (!account) return new Response('Unauthorized', { status: 401 });
  const { id, sid } = await params;
  const book = await getBook(account.userId, id);
  const section = book && (await getSection(account.userId, book.id, sid));
  if (!section) return new Response('Not found', { status: 404 });
  return blobResponse(section.textPath, { contentType: 'application/json', cache: 'private, max-age=31536000, immutable' });
}
