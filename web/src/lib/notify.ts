import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { getDb } from '@/db';
import { accountSettings, books, editions, user } from '@/db/schema';

// Emails from Tuft when a background run needs the parent or has finished. Sent with Resend
// (Vercel Marketplace). Never throws: a missing key, a turned-off preference or a send error
// just means no email, and the run carries on.

export type NoticeKind = 'samples-ready' | 'ready' | 'paused-cap' | 'failed';

const appUrl = () => (process.env.BETTER_AUTH_URL ?? 'https://featherbound.ink').replace(/\/$/, '');
// Until featherbound.ink is verified in Resend, its shared test sender only reaches the
// Resend account's own address. Set EMAIL_FROM once the domain is verified.
const from = () => process.env.EMAIL_FROM ?? 'Featherbound <onboarding@resend.dev>';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function noticeEmail(kind: NoticeKind, d: { title: string; edition: string; editionId: string; detail?: string }) {
  const base = appUrl();
  const map = {
    'samples-ready': { subject: `Sample chapters of ${d.title} are ready`, line: `Your sample chapters of <em>${esc(d.title)}</em> (${esc(d.edition)}) are ready for you to read.`, cta: 'Review samples', href: `${base}/editions/${d.editionId}/samples` },
    ready: { subject: `${d.title} is ready to read`, line: `<em>${esc(d.title)}</em> (${esc(d.edition)}) is finished and ready to read.`, cta: 'Start reading', href: `${base}/read/edition/${d.editionId}` },
    'paused-cap': { subject: `${d.title} paused at your cost cap`, line: `I paused <em>${esc(d.title)}</em> (${esc(d.edition)}) because the next chapters would go past your cost cap.`, cta: 'Decide what to do', href: `${base}/editions/${d.editionId}/progress` },
    failed: { subject: `I got stuck on ${d.title}`, line: `Something went wrong with <em>${esc(d.title)}</em> (${esc(d.edition)})${d.detail ? `: ${esc(d.detail)}` : ''}. Finished chapters are kept, and trying again picks up where I left off.`, cta: 'See what happened', href: `${base}/editions/${d.editionId}/progress` },
  }[kind];
  const html = `<!doctype html><html><body style="margin:0;background:#fbf4e4;font-family:Georgia,serif;color:#2b2140">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font:800 20px system-ui,sans-serif;color:#4b2e83;margin:0 0 18px">Featherbound</p>
<div style="background:#fffdf7;border-radius:18px;padding:24px;box-shadow:0 1px 0 #e6dcc4">
<p style="font-size:17px;line-height:1.55;margin:0 0 20px">${map.line}</p>
<a href="${map.href}" style="display:inline-block;background:#4b2e83;color:#fff;text-decoration:none;font:800 15px system-ui,sans-serif;padding:12px 20px;border-radius:999px">${map.cta}</a>
</div>
<p style="font:13px system-ui,sans-serif;color:#716a80;margin:18px 4px 0">You get these because email notices are on in Featherbound’s Settings → Usage &amp; costs.</p>
</div></body></html>`;
  const text = `${map.line.replace(/<[^>]+>/g, '')}\n\n${map.cta}: ${map.href}\n\nTurn these off in Settings → Usage & costs.`;
  return { subject: map.subject, html, text };
}

export async function notify(editionId: string, kind: NoticeKind, detail?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'no key' };
  try {
    const db = getDb();
    const [row] = await db
      .select({ email: user.email, on: accountSettings.emailNotices, title: books.title, edition: editions.name })
      .from(editions)
      .innerJoin(user, eq(user.id, editions.userId))
      .innerJoin(books, eq(books.id, editions.bookId))
      .leftJoin(accountSettings, eq(accountSettings.userId, editions.userId))
      .where(eq(editions.id, editionId))
      .limit(1);
    if (!row?.email || row.on === false) return { sent: false, reason: 'off' };
    const msg = noticeEmail(kind, { title: row.title, edition: row.edition, editionId, detail });
    const { error } = await new Resend(key).emails.send({ from: from(), to: row.email, subject: msg.subject, html: msg.html, text: msg.text });
    return error ? { sent: false, reason: error.message } : { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
