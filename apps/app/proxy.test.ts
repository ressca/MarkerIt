import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

afterEach(() => vi.unstubAllGlobals());

function request(path: string, token?: string) {
  const value = new NextRequest(`http://localhost:3000${path}`);
  if (token) value.cookies.set('markerit_session', token);
  return value;
}

describe('route authentication proxy', () => {
  it('lets anonymous users open login and registration pages', async () => {
    expect((await proxy(request('/login'))).status).toBe(200);
    expect((await proxy(request('/register'))).status).toBe(200);
  });

  it('redirects anonymous users to login for protected paths', async () => {
    const response = await proxy(request('/projects'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('checks a session and allows an authenticated route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await proxy(request('/', 'valid.token'))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/v1/auth/session', expect.objectContaining({
      method: 'GET', cache: 'no-store', headers: { Cookie: 'markerit_session=valid.token' },
    }));
  });

  it('sends authenticated users away from auth pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const response = await proxy(request('/login', 'valid.token'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('redirects expired sessions and surfaces API/network outages as 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    expect((await proxy(request('/private', 'expired'))).headers.get('location')).toBe('http://localhost:3000/login');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    expect(await (await proxy(request('/private', 'token'))).json()).toEqual({ code: 'AUTH_SERVICE_UNAVAILABLE' });
    expect((await proxy(request('/private', 'token'))).status).toBe(503);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await proxy(request('/private', 'token'))).status).toBe(503);
  });

  it('matches user routes but excludes static assets', async () => {
    const { config } = await import('./proxy');
    expect(config.matcher).toEqual(['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)']);
  });
});
