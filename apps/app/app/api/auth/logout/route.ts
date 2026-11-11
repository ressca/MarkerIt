import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const apiBaseUrl = process.env.AUTH_API_INTERNAL_URL ?? 'http://localhost:8080/api/v1';

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('markerit_session')?.value;

  if (sessionToken) {
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: { Cookie: `markerit_session=${encodeURIComponent(sessionToken)}` },
        cache: 'no-store',
      });
    } catch {
      // Ignore network errors on revoking remote session
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('markerit_session', '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
  });
  return response;
}
