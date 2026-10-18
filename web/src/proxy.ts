import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

// Optimistic check only: no session cookie means "go sign in". The real check (valid session
// and still on the allow list) happens in requireAccount() on every page and action.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except sign-in, the private page, auth endpoints and static files.
  matcher: ['/((?!sign-in|private|api/auth|\\.well-known/workflow/|_next/static|_next/image|icon\\.svg|favicon\\.ico).*)'],
};
