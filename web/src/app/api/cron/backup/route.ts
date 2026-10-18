import { takeBackup } from '@/lib/backup';

// Vercel Cron calls this nightly (vercel.json) with "Authorization: Bearer $CRON_SECRET".
// Without the secret configured, the endpoint does nothing.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response('Backups are off: set CRON_SECRET', { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const result = await takeBackup();
  return Response.json(result);
}
