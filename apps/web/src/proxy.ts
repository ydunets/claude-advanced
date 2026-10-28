import { NextResponse, type NextRequest } from 'next/server';
import { ROUTES } from './lib/routes';
import { ACCESS_TOKEN_COOKIE } from './lib/session';

// Optimistic check on the cookie only; the home page still treats a token the
// API rejects as signed out.
export function proxy(request: NextRequest): NextResponse {
  if (request.cookies.has(ACCESS_TOKEN_COOKIE)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL(ROUTES.LOGIN, request.url));
}

// A literal, not ROUTES.HOME: Next.js reads the matcher statically and ignores
// variables, which would run this proxy on every route, /login included.
export const config = {
  matcher: '/',
};
