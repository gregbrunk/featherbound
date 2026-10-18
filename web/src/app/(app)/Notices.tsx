import Link from 'next/link';
import Icon from '@/components/Icon';
import Tuft, { type TuftPose } from '@/components/Tuft';

export type Notice = { id: string; bookTitle: string; name: string; notice: 'samples-ready' | 'paused-cap' | 'ready' | 'failed' };

const COPY: Record<Notice['notice'], { pose: TuftPose; text: (n: Notice) => string; action: string; href: (id: string) => string }> = {
  'samples-ready': { pose: 'read', text: (n) => `Your sample chapters of ${n.bookTitle} (${n.name}) are ready.`, action: 'Review samples', href: (id) => `/editions/${id}/samples` },
  'paused-cap': { pose: 'worry', text: (n) => `I paused ${n.bookTitle} (${n.name}) at your cost cap.`, action: 'Decide', href: (id) => `/editions/${id}/progress` },
  ready: { pose: 'cheer', text: (n) => `${n.bookTitle} (${n.name}) is ready to read!`, action: 'Start reading', href: (id) => `/read/edition/${id}` },
  failed: { pose: 'worry', text: (n) => `I got stuck on ${n.bookTitle} (${n.name}).`, action: 'See what happened', href: (id) => `/editions/${id}/progress` },
};

/** Notes from Tuft at the top of the library. Each clears when its edition is opened. */
export default function Notices({ items }: { items: Notice[] }) {
  if (!items.length) return null;
  return (
    <section className="notices" aria-label="Updates">
      {items.map((n) => {
        const c = COPY[n.notice];
        return (
          <div key={n.id} className="card card-tinted notice-row">
            <Tuft pose={c.pose} size={44} />
            <p style={{ flex: 1, minWidth: 0 }}>{c.text(n)}</p>
            <Link href={c.href(n.id)} className="btn btn-primary btn-sm">{c.action} <Icon name="right" size={14} /></Link>
          </div>
        );
      })}
    </section>
  );
}
