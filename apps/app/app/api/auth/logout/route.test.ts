import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

afterEach(() => vi.unstubAllGlobals());

describe('logout route', () => {
  it('clears the session cookie without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ success: true });
    const cookie = response.cookies.get('markerit_session');
    expect(cookie?.value).toBe('');
    expect(cookie?.maxAge).toBe(0);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe('/');
  });
});
