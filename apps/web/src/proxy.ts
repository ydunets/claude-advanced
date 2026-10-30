import { NextResponse, type NextRequest } from 'next/server';
import { ROUTES } from './lib/routes';
import { ACCESS_TOKEN_COOKIE } from './lib/session';

// Optimistic check on the cookie only; each page still treats a token the API
// rejects as signed out.
export function proxy(request: NextRequest): NextResponse {
  if (request.cookies.has(ACCESS_TOKEN_COOKIE)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL(ROUTES.LOGIN, request.url));
}

// Literals, not ROUTES: Next.js reads the matcher statically and ignores
// variables, which would run this proxy on every route, /login included.
// `/meetings/:id` matches one segment only, so the upload Route Handler stays
// outside: the proxy buffers request bodies and truncates them at 10 MB.
export const config = {
  matcher: ['/', '/meetings/:id'],
};
