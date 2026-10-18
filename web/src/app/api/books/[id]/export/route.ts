import { buildEpub } from '@/lib/export/epub';
import { deliver } from '@/lib/export/deliver';
import { gatherOriginal } from '@/lib/export/gather';
import { buildPdf } from '@/lib/export/pdf';
import { getAccount } from '@/lib/session';

// Building a long PDF in headless Chrome can take a while.
export const maxDuration = 300;

/** The original book rebuilt from its stored chapters, as EPUB or PDF: /api/books/<id>/export?format=pdf */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await getAccount();
  if (!account) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  const format = new URL(req.url).searchParams.get('format') === 'pdf' ? 'pdf' : 'epub';
  const book = await gatherOriginal(account.userId, id);
  if (!book) return new Response('Not found', { status: 404 });
  const bytes = format === 'pdf' ? await buildPdf(book) : await buildEpub(book);
  return deliver(account.userId, bytes, book.fileBase, format, new URL(req.url).searchParams.get('inline') === '1');
}
