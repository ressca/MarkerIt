import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const apiBaseUrl = process.env.AUTH_API_INTERNAL_URL ?? 'http://localhost:8080/api/v1';
const forwardedHeaders = [
  'content-type',
  'content-length',
  'cache-control',
  'etag',
  'content-disposition',
];

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await context.params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('markerit_session')?.value;

  const headers: Record<string, string> = {};
  if (sessionToken) {
    headers.Cookie = `markerit_session=${encodeURIComponent(sessionToken)}`;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/assets/${encodeURIComponent(assetId)}/content`,
      { headers, cache: 'no-store' },
    );

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    const responseHeaders = new Headers();
    for (const name of forwardedHeaders) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    // Responses are user-specific (session cookie) and must not be cached
    // across users by shared caches.
    responseHeaders.set('Vary', 'Cookie');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ code: 'ASSET_SERVICE_UNAVAILABLE' }, { status: 503 });
  }
}
