import { getEdition } from '@/lib/analysis';
import type { Block } from '@/lib/import/types';
import { getEditionChapter, getVersion } from '@/lib/runs';
import { getAccount } from '@/lib/session';
import { readJson } from '@/lib/storage';

// One chapter of an edition, as a given version shows it. A version never changes, so the
// response is cacheable once the version number is in the URL.
export async function GET(req: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const account = await getAccount();
  if (!account) return new Response('Unauthorized', { status: 401 });
  const { id, sid } = await params;
  const ed = await getEdition(account.userId, id);
  const params2 = new URL(req.url).searchParams;
  const v = params2.get('v') ?? ed?.currentVersion;
  // raw=1 skips the recap, so block indexes match the stored chapter (the refine screen needs that).
  const raw = params2.get('raw') === '1';
  const version = ed && v ? await getVersion(account.userId, ed.id, v) : null;
  const entry = version?.manifest.find((m) => m.sectionId === sid);
  const chapter = entry && (await getEditionChapter(account.userId, entry.chapterId));
  if (!chapter) return new Response('Not found', { status: 404 });
  const { blocks } = await readJson<{ blocks: Block[] }>(chapter.textPath);
  const out: Block[] = chapter.recap && !raw ? [{ type: 'quote', html: `<em>The story so far…</em> ${chapter.recap}` }, ...blocks] : blocks;
  return Response.json({ title: chapter.kidTitle ?? chapter.title, blocks: out }, { headers: { 'Cache-Control': 'private, max-age=31536000, immutable' } });
}
