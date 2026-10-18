'use client';

import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import Tuft from '@/components/Tuft';
import { startImport } from '../books/actions';

const KINDLE = /\.(mobi|azw3?|kfx|prc)$/i;
const OK = /\.(epub|pdf)$/i;

export default function AddBook({ uploadPrefix }: { uploadPrefix: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (file: File) => {
    setError(null);
    if (KINDLE.test(file.name)) return setError('Kindle files aren’t supported yet. If the book is DRM-free, download it as an EPUB instead.');
    if (!OK.test(file.name)) return setError('Featherbound reads EPUB and PDF files.');
    setProgress(0);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._ -]/g, '_');
      const blob = await upload(`${uploadPrefix}${safe}`, file, {
        access: 'private',
        handleUploadUrl: '/api/upload',
        multipart: file.size > 20 * 1024 * 1024,
        onUploadProgress: (e) => setProgress(Math.round(e.percentage)),
      });
      const { bookId } = await startImport({ pathname: blob.pathname, fileName: file.name, size: file.size });
      router.push(`/books/${bookId}/review`);
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? `Upload failed: ${e.message}` : 'Upload failed. Please try again.');
    }
  };

  return (
    <main className="page page-narrow">
      <div className="stack-lg">
        <div className="stack-sm">
          <h1>Add a book</h1>
          <p className="muted">Upload a DRM-free ebook you own. I’ll read it, find its cover and series, and get it ready for your shelf.</p>
        </div>

        {progress !== null ? (
          <div className="card card-lg center stack" style={{ alignItems: 'center' }}>
            <Tuft pose="read" size={120} />
            <h2>{progress < 100 ? 'Uploading…' : 'Opening the book…'}</h2>
            <div className="progress-bar" style={{ width: 280 }}><i style={{ width: `${progress}%` }} /></div>
            <p className="small faint">{progress}%</p>
          </div>
        ) : (
          <div
            className={`dropzone ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) void go(f); }}
            onClick={() => input.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          >
            <Tuft pose={over ? 'cheer' : 'hello'} size={110} />
            <h2>Drop your book here</h2>
            <p className="muted">or click to choose a file</p>
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              <span className="chip">EPUB</span><span className="chip">PDF</span>
              <span className="chip chip-plain">Coming later: MOBI · AZW3 · DOCX · TXT</span>
            </div>
            <input ref={input} type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" hidden onChange={(e) => e.target.files?.[0] && void go(e.target.files[0])} />
          </div>
        )}

        {error && (
          <div className="card row" style={{ gap: 14, flexWrap: 'wrap' }} role="alert">
            <Tuft pose="worry" size={60} />
            <p style={{ flex: 1, minWidth: 220 }}>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setError(null)}><Icon name="x" size={14} /> OK</button>
          </div>
        )}
      </div>
    </main>
  );
}
