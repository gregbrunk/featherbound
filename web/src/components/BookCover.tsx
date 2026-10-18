'use client';

import { useState } from 'react';
// Fallback art when a book has no cover image.
export type CoverSpec = { from: string; to: string; emblem: string; ink?: string };

// Real cover art when we have it; a stylized stand-in cover when we don't (or it fails to load).

const EMBLEMS: Record<string, React.ReactNode> = {
  feather: (
    <>
      <path d="M38 6C22 6 12 18 12 34M38 6c0 14-10 22-26 28M8 40l4-6M20 22h10" />
    </>
  ),
  ring: (
    <>
      <circle cx="24" cy="25" r="13" strokeWidth="4.5" />
      <path d="M16 18 a10 10 0 0 1 8 -4" strokeWidth="2" opacity="0.7" />
    </>
  ),
  mountain: (
    <>
      <path d="M4 40 L19 14 L27 26 L33 18 L44 40 Z" strokeLinejoin="round" />
      <path d="M21 40 v-7 a3 3 0 0 1 6 0 v7" />
      <circle cx="37" cy="9" r="4" />
    </>
  ),
  tower: (
    <>
      <path d="M17 42 L19 14 L24 8 L29 14 L31 42 Z" strokeLinejoin="round" />
      <path d="M22 22 h4 M22 30 h4" />
      <path d="M8 42 h32" />
    </>
  ),
  crown: (
    <>
      <path d="M8 34 L10 16 L18 25 L24 12 L30 25 L38 16 L40 34 Z" strokeLinejoin="round" />
      <path d="M8 40 h32" />
    </>
  ),
  bolt: <path d="M28 4 L12 27 h11 L19 44 L36 20 h-11 Z" strokeLinejoin="round" />,
  serpent: (
    <>
      <path d="M10 38 C10 26 38 30 38 18 C38 10 28 8 24 13" />
      <circle cx="24" cy="14" r="1.6" fill="currentColor" />
      <path d="M22 13 l-4 -2" />
    </>
  ),
  stag: (
    <>
      <path d="M24 42 v-14 M24 28 C16 26 14 18 14 10 M24 28 C32 26 34 18 34 10 M14 16 l-5 -3 M34 16 l5 -3 M16 22 l-5 0 M32 22 l5 0" />
      <circle cx="24" cy="31" r="4" />
    </>
  ),
  chicken: (
    <>
      <path d="M12 30 C12 20 20 14 28 16 C34 17 36 24 34 30 C32 36 26 38 20 38 C15 38 12 35 12 30 Z" />
      <path d="M28 16 C26 10 30 8 32 12 C33 8 37 9 35 14" />
      <path d="M35 21 l5 2 l-5 2" />
      <path d="M20 38 v5 M26 38 v5" />
    </>
  ),
  egg: (
    <>
      <path d="M24 6 C14 6 10 22 10 29 C10 37 16 43 24 43 C32 43 38 37 38 29 C38 22 34 6 24 6 Z" />
      <path d="M16 20 C20 22 22 18 26 22 C28 24 31 22 33 24" strokeWidth="2" />
    </>
  ),
  trident: (
    <>
      <path d="M24 44 V10 M14 18 V8 M34 18 V8 M14 18 C14 24 34 24 34 18" />
      <path d="M24 4 l-3 6 h6 Z" fill="currentColor" />
    </>
  ),
  planet: (
    <>
      <circle cx="24" cy="24" r="10" />
      <ellipse cx="24" cy="24" rx="20" ry="6" transform="rotate(-20 24 24)" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="40" cy="38" r="1.5" fill="currentColor" />
    </>
  ),
  visor: (
    <>
      <rect x="6" y="16" width="36" height="16" rx="8" />
      <circle cx="17" cy="24" r="4" />
      <circle cx="31" cy="24" r="4" />
      <path d="M6 24 H2 M42 24 h4" />
    </>
  ),
  sword: (
    <>
      <path d="M24 4 L28 10 V32 H20 V10 Z" strokeLinejoin="round" />
      <path d="M14 32 H34 M24 32 V42" />
      <circle cx="24" cy="44" r="2" />
    </>
  ),
  fish: (
    <>
      <path d="M8 24 C16 12 32 12 38 24 C32 36 16 36 8 24 Z" />
      <path d="M38 24 L46 16 V32 Z" strokeLinejoin="round" />
      <circle cx="16" cy="22" r="1.6" fill="currentColor" />
      <path d="M24 4 v6 a4 4 0 0 1 -4 4" />
    </>
  ),
  house: (
    <>
      <path d="M12 26 L24 14 L36 26 V40 H12 Z" strokeLinejoin="round" />
      <path d="M21 40 v-8 h6 v8" />
      <path d="M4 10 C14 4 34 4 44 10 M8 4 C18 0 30 0 40 4" strokeWidth="2" opacity="0.7" />
    </>
  ),
};

type Props = {
  cover: CoverSpec;
  title: string;
  author: string;
  image?: string;
  ribbon?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

const SIZES = {
  sm: { title: '13px', author: '7.5px' },
  md: { title: '17px', author: '9.5px' },
  lg: { title: '24px', author: '11px' },
  xl: { title: '30px', author: '13px' },
};

export default function BookCover({ cover, title, author, image, ribbon, size = 'md', className = '' }: Props) {
  const s = SIZES[size];
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <div className={`cover cover-photo ${className}`} style={{ background: cover.to }} aria-hidden="true">
        {/* Covers come from our own auth-checked file routes, so next/image optimization is not used. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" loading="lazy" onError={() => setFailed(true)} />
        {ribbon && <div className="cover-ribbon">{ribbon}</div>}
      </div>
    );
  }
  return (
    <div
      className={`cover ${className}`}
      style={{
        background: `radial-gradient(120% 80% at 30% 15%, ${cover.from} 0%, ${cover.to} 100%)`,
        ['--cover-title-size' as string]: s.title,
        ['--cover-author-size' as string]: s.author,
      }}
      aria-hidden="true"
    >
      <div className="cover-frame" />
      {ribbon && <div className="cover-ribbon">{ribbon}</div>}
      <div className="cover-inner">
        {title && <div className="cover-title">{title}</div>}
        <div className="cover-emblem" style={{ color: cover.ink ?? '#fff' }}>
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            {EMBLEMS[cover.emblem]}
          </svg>
        </div>
        {author && <div className="cover-author">{author}</div>}
      </div>
    </div>
  );
}
