import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiRequest,
  createPinComment,
  createProject,
  createReviewPin,
  createWorkspace,
  deleteProject,
  deleteWorkspace,
  getWorkspace,
  listProjects,
  listWorkspaces,
  loginAccount,
  registerAccount,
  resendVerification,
  updateProject,
  updateWorkspace,
  verifyEmail,
} from './index';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
});

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('normalizes the URL, sends JSON headers and always includes cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/example', { baseUrl: 'http://api.test///', method: 'POST', body: '{}' })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/example');
    expect(init.credentials).toBe('include');
    expect(init.headers.get('Accept')).toContain('application/problem+json');
    expect(init.headers.get('Content-Type')).toBe('application/json');
  });

  it('preserves caller headers and does not overwrite explicit content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('x', { baseUrl: 'http://api.test', headers: { 'Content-Type': 'text/plain', 'X-Trace': '1' }, body: 'raw' });
    expect(fetchMock.mock.calls[0][1].headers.get('Content-Type')).toBe('text/plain');
    expect(fetchMock.mock.calls[0][1].headers.get('X-Trace')).toBe('1');
  });

  it('returns undefined for no-content responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiRequest('session', { baseUrl: 'http://api.test' })).resolves.toBeUndefined();
  });

  it('maps API problem details and field errors to ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'BAD_INPUT', detail: 'Bad request', retryAfterSeconds: 42, fieldErrors: [{ field: 'email', code: 'invalid', message: 'Invalid' }] }, 400)));
    await expect(apiRequest('x', { baseUrl: 'http://api.test' })).rejects.toMatchObject({
      name: 'ApiError', status: 400, code: 'BAD_INPUT', message: 'Bad request', retryAfterSeconds: 42, fieldErrors: [{ field: 'email' }],
    });
  });

  it('uses title and status fallback when a problem has no detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ title: 'Unavailable' }, 503)));
    await expect(apiRequest('x', { baseUrl: 'http://api.test' })).rejects.toMatchObject({ code: 'HTTP_ERROR', message: 'Unavailable' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('plain text', { status: 500 })));
    await expect(apiRequest('x', { baseUrl: 'http://api.test' })).rejects.toMatchObject({ message: 'Żądanie nie powiodło się (HTTP 500).' });
  });

  it('reports invalid successful and malformed JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { headers: { 'content-type': 'application/json' } })));
    await expect(apiRequest('x', { baseUrl: 'http://api.test' })).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    await expect(apiRequest('x', { baseUrl: 'http://api.test' })).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });

  it('wraps network failures but leaves abort errors untouched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(apiRequest('x', { baseUrl: 'http://api.test' })).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    const abort = new Error('cancelled'); abort.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(apiRequest('x', { baseUrl: 'http://api.test' })).rejects.toBe(abort);
  });

  it('captures ApiError metadata and cause', () => {
    const cause = new Error('root');
    const error = new ApiError(422, 'INVALID', 'invalid', { fieldErrors: [], requestId: 'request-1' }, cause);
    expect(error.requestId).toBe('request-1');
    expect(error.fieldErrors).toEqual([]);
    expect(error.cause).toBe(cause);
    expect(new ApiError(400, 'x', 'x', { fieldErrors: null as never }).fieldErrors).toEqual([]);
  });
});

describe('auth and review API operations', () => {
  it('gets a CSRF token before registration, login and verification operations', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(json({ email: 'a@example.com', expiresAt: 'later', resendAvailableAt: 'soon' }, 202))
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(json({ id: '1', email: 'a@example.com', expiresAt: 'later' }))
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(json({ email: 'a@example.com', expiresAt: 'later', resendAvailableAt: 'soon' }, 202))
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(json({ id: '1', email: 'a@example.com', expiresAt: 'later' }));
    vi.stubGlobal('fetch', fetchMock);
    await registerAccount({ email: 'a@example.com', password: 'secret' });
    await loginAccount({ email: 'a@example.com', password: 'secret' });
    await resendVerification('a@example.com');
    await verifyEmail('a@example.com', '012345');
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/csrf');
    expect(fetchMock.mock.calls[1][1].headers.get('X-XSRF-TOKEN')).toBe('csrf-token');
    expect(fetchMock.mock.calls[2][0]).toContain('/auth/csrf');
    expect(fetchMock.mock.calls[3][1].headers.get('X-XSRF-TOKEN')).toBe('csrf-token');
    expect(fetchMock.mock.calls[5][0]).toContain('/auth/verification/resend');
    expect(fetchMock.mock.calls[5][1].headers.get('X-XSRF-TOKEN')).toBe('csrf-token');
    expect(fetchMock.mock.calls[7][0]).toContain('/auth/verification/verify');
    expect(JSON.parse(fetchMock.mock.calls[7][1].body)).toEqual({ email: 'a@example.com', code: '012345' });
  });

  it('encodes IDs and sends review pin/comment payloads', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ id: 'pin-created' }))
      .mockResolvedValueOnce(json({ id: 'comment-created' }));
    vi.stubGlobal('fetch', fetchMock);
    await createReviewPin('review/id', { xPercent: 20, yPercent: 30, body: 'Note' });
    await createPinComment('pin id', { body: 'Reply' });
    expect(fetchMock.mock.calls[0][0]).toContain('reviews/review%2Fid/pins');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ xPercent: 20, yPercent: 30, body: 'Note' });
    expect(fetchMock.mock.calls[1][0]).toContain('pins/pin%20id/comments');
  });
});

describe('dashboard API operations', () => {
  const csrf = () => json({ token: 'csrf-token' });

  it('lists and reads workspaces and projects', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json([{ id: 'ws-1' }]))
      .mockResolvedValueOnce(json({ id: 'ws-1' }))
      .mockResolvedValueOnce(json([{ id: 'p-1' }]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listWorkspaces()).resolves.toEqual([{ id: 'ws-1' }]);
    await expect(getWorkspace('ws/1')).resolves.toEqual({ id: 'ws-1' });
    await expect(listProjects('ws 1')).resolves.toEqual([{ id: 'p-1' }]);

    expect(fetchMock.mock.calls[0][0]).toContain('/workspaces');
    expect(fetchMock.mock.calls[1][0]).toContain('/workspaces/ws%2F1');
    expect(fetchMock.mock.calls[2][0]).toContain('/workspaces/ws%201/projects');
  });

  it('sends CSRF-protected workspace and project mutations', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json({ id: 'ws-1' }, 201))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json({ id: 'ws-1' }))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json({ id: 'p-1' }, 201))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json({ id: 'p-1' }))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await createWorkspace({ name: 'Studio' });
    await updateWorkspace('ws-1', { name: 'Nowe' });
    await deleteWorkspace('ws-1');
    await createProject('ws-1', { name: 'Projekt', tone: 'sage' });
    await updateProject('p-1', { status: 'CLOSED' });
    await deleteProject('p-1');

    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: 'Studio' });
    expect(fetchMock.mock.calls[3][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[5][1].method).toBe('DELETE');
    expect(JSON.parse(fetchMock.mock.calls[7][1].body)).toEqual({ name: 'Projekt', tone: 'sage' });
    expect(JSON.parse(fetchMock.mock.calls[9][1].body)).toEqual({ status: 'CLOSED' });
    expect(fetchMock.mock.calls.every((call, index) => index % 2 === 1 || call[0].includes('/auth/csrf'))).toBe(true);
  });
});
