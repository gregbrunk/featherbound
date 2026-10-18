'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import Tuft from './Tuft';
import Icon from './Icon';

const NAV = [
  { href: '/', label: 'Library', icon: 'book', match: (p: string) => p === '/' || p.startsWith('/books') || p.startsWith('/series') },
  { href: '/add', label: 'Add a book', icon: 'plus', match: (p: string) => p.startsWith('/add') },
  { href: '/settings', label: 'Settings', icon: 'gear', match: (p: string) => p.startsWith('/settings') },
];

// The shell is static so it prerenders; the account menu and page content stream in.
export default function AppShell({ account, children }: { account: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="Featherbound home">
            <Tuft size={40} still />
            <span className="brand-name">Featherbound</span>
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={n.match(pathname) ? 'active' : ''}>{n.label}</Link>
            ))}
          </nav>
          <div className="spacer" />
          {account}
        </div>
      </header>
      {children}
      <nav className="bottom-nav" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={n.match(pathname) ? 'active' : ''}>
            <Icon name={n.icon} size={22} />
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
