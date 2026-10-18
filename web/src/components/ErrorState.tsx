import Link from 'next/link';
import Tuft, { type TuftPose } from './Tuft';

/** Tuft explaining that something went wrong, with a way out. */
export default function ErrorState({ title, message, pose = 'worry', action }: { title: string; message: string; pose?: TuftPose; action?: React.ReactNode }) {
  return (
    <main className="page page-narrow">
      <div className="card card-lg center stack" style={{ alignItems: 'center', marginTop: 40 }}>
        <Tuft pose={pose} size={120} />
        <h1>{title}</h1>
        <p className="muted" style={{ maxWidth: 460 }}>{message}</p>
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          {action}
          <Link href="/" className="btn btn-secondary">Back to the library</Link>
        </div>
      </div>
    </main>
  );
}
