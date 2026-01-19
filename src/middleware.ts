import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'merchant_auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /merchant routes (except login)
  if (pathname.startsWith('/merchant') && !pathname.startsWith('/merchant/login')) {
    const authCookie = request.cookies.get(AUTH_COOKIE);

    if (authCookie?.value !== 'authenticated') {
      return NextResponse.redirect(new URL('/merchant/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/merchant/:path*'],
};
