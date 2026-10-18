import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';
import { HANDOFF_COOKIE, allowedWhileLocked, decodeLock } from '@/lib/handoff';

// Optimistic check only: no session cookie means "go sign in". The real check (valid session
// and still on the allow list) happens in requireAccount() on every page and action.
// Hand-off mode is enforced here: a locked device can only reach its one edition's reader.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  const lock = decodeLock(request.cookies.get(HANDOFF_COOKIE)?.value);
  if (lock && !allowedWhileLocked(request.nextUrl.pathname, lock)) {
    if (request.nextUrl.pathname.startsWith('/api/')) return new Response('Locked', { status: 403 });
    return NextResponse.redirect(new URL(`/read/edition/${lock.editionId}`, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except sign-in, the private page, auth endpoints and static files.
  matcher: ['/((?!sign-in|private|api/auth|api/cron|\\.well-known/workflow/|_next/static|_next/image|icon\\.png|apple-icon\\.png|icons/|manifest\\.webmanifest|favicon\\.ico).*)'],
};
