import { NextResponse } from 'next/server';

/**
 * Clears the local session cookie. The API logout is performed by
 * `logoutAccount()` from the browser so it can send the CSRF token; calling
 * the API from this route would not have access to the user's CSRF cookie.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('markerit_session', '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
  });
  return response;
}
