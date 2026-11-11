import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));

import { GET } from './route';

function context(assetId: string) {
  return { params: Promise.resolve({ assetId }) };
}

function sessionCookie(token = 'session-token') {
  return { get: (name: string) => (name === 'markerit_session' ? { value: token } : undefined) };
}

describe('authenticated asset content route', () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('forwards the session cookie and streams asset headers', async () => {
    cookiesMock.mockResolvedValue(sessionCookie());
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('image-bytes', {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': '11',
          'cache-control': 'private, immutable',
          etag: '"abc"',
          'content-disposition': 'inline; filename="shot.png"',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('http://app.test/api/assets/a%2Fb/content'), context('a/b'));

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/assets/a%2Fb/content',
      expect.objectContaining({
        headers: { Cookie: 'markerit_session=session-token' },
        cache: 'no-store',
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('etag')).toBe('"abc"');
    expect(response.headers.get('vary')).toBe('Cookie');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    await expect(response.arrayBuffer()).resolves.toBeInstanceOf(ArrayBuffer);
  });

  it('omits the cookie header when the user is not signed in', async () => {
    cookiesMock.mockResolvedValue(sessionCookie(''));
    const fetchMock = vi.fn().mockResolvedValue(new Response('x', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await GET(new Request('http://app.test/api/assets/a/content'), context('a'));

    expect(fetchMock.mock.calls[0][1].headers).toEqual({});
  });

  it('passes through API errors and reports unavailable storage', async () => {
    cookiesMock.mockResolvedValue(sessionCookie());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(
      GET(new Request('http://app.test/api/assets/a/content'), context('a')),
    ).resolves.toMatchObject({ status: 404 });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(
      GET(new Request('http://app.test/api/assets/a/content'), context('a')),
    ).resolves.toMatchObject({ status: 503 });
  });
});
