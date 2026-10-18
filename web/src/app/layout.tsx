import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Fraunces, Lexend, Literata, Nunito } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], axes: ['SOFT', 'WONK', 'opsz'], variable: '--fb-fraunces', display: 'swap' });
const nunito = Nunito({ subsets: ['latin'], variable: '--fb-nunito', display: 'swap' });
const literata = Literata({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--fb-literata', display: 'swap' });
const lexend = Lexend({ subsets: ['latin'], variable: '--fb-lexend', display: 'swap' });
const atkinson = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], variable: '--fb-atkinson', display: 'swap' });

export const metadata: Metadata = {
  title: 'Featherbound',
  description: 'A private library of softer editions of the books we love.',
};

export const viewport: Viewport = {
  themeColor: '#FBF4E4',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fonts = [fraunces, nunito, literata, lexend, atkinson].map((f) => f.variable).join(' ');
  return (
    <html lang="en" className={fonts}>
      <body>{children}</body>
    </html>
  );
}
