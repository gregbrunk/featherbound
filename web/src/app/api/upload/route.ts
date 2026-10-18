import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getAccount } from '@/lib/session';
import { ownsPath } from '@/lib/storage';

// Issues a short-lived token so the browser can upload a book file straight to the private
// Blob store. Only signed-in, allowed accounts get a token, and only for their own folder.
export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!ownsPath(account.userId, pathname) || !pathname.includes('/uploads/')) throw new Error('Bad upload path');
        return {
          allowedContentTypes: [
            'application/epub+zip',
            'application/pdf',
            'application/octet-stream',
            'application/x-mobipocket-ebook',
            'application/vnd.amazon.ebook',
          ],
          maximumSizeInBytes: 200 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed' }, { status: 400 });
  }
}
