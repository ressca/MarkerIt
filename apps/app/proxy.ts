import { NextRequest, NextResponse } from 'next/server';

const sessionCookieName = 'markerit_session';
const apiBaseUrl = process.env.AUTH_API_INTERNAL_URL ?? 'http://localhost:8080/api/v1';
const authPaths = new Set(['/login', '/register']);

export async function proxy(request: NextRequest) {
  const isAuthPage = authPaths.has(request.nextUrl.pathname);
  const sessionToken = request.cookies.get(sessionCookieName)?.value;

  if (!sessionToken) {
    return isAuthPage ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const sessionResponse = await fetch(`${apiBaseUrl}/auth/session`, {
      method: 'GET',
      headers: { Cookie: `${sessionCookieName}=${encodeURIComponent(sessionToken)}` },
      cache: 'no-store',
    });

    if (sessionResponse.status === 204) {
      return isAuthPage ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
    }
    if (sessionResponse.status === 401) {
      return isAuthPage ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ code: 'AUTH_SERVICE_UNAVAILABLE' }, { status: 503 });
  } catch {
    return NextResponse.json({ code: 'AUTH_SERVICE_UNAVAILABLE' }, { status: 503 });
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
