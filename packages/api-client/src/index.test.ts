import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiRequest,
  closeReview,
  createPinComment,
  createProject,
  createReview,
  createReviewVersion,
  createVersionPin,
  createWorkspace,
  deleteComment,
  deletePin,
  deleteProject,
  deleteProjectAsset,
  deleteReview,
  deleteWorkspace,
  getProject,
  getReview,
  getReviewDiscussion,
  getWorkspace,
  listProjectAssets,
  listProjectReviews,
  listProjects,
  listReviewPins,
  listWorkspaceMembers,
  listWorkspaces,
  loginAccount,
  logoutAccount,
  registerAccount,
  resendVerification,
  submitReviewApproval,
  updateComment,
  updatePin,
  updateProject,
  updateReview,
  updateWorkspace,
  uploadProjectAsset,
  uploadProjectAttachment,
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

  it('logs out with a CSRF-protected POST', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(logoutAccount()).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[0][0]).toContain('/auth/csrf');
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/logout');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(fetchMock.mock.calls[1][1].headers.get('X-XSRF-TOKEN')).toBe('csrf-token');
  });

  it('encodes IDs and sends CSRF-protected pin comment payloads', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(json({ id: 'comment-created' }));
    vi.stubGlobal('fetch', fetchMock);
    await createPinComment('pin id', {
      body: 'Reply',
      parentCommentId: 'parent-1',
      attachmentAssetIds: ['asset-1'],
    });
    expect(fetchMock.mock.calls[1][0]).toContain('pins/pin%20id/comments');
    expect(fetchMock.mock.calls[1][1].headers.get('X-XSRF-TOKEN')).toBe('csrf-token');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      body: 'Reply',
      parentCommentId: 'parent-1',
      attachmentAssetIds: ['asset-1'],
    });
  });

  it('reads discussions and version pins', async () => {
    const discussion = { reviewId: 'r-1', versionId: 'v-1', pins: [], comments: [], reviews: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(discussion))
      .mockResolvedValueOnce(json([{ id: 'pin-1' }]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getReviewDiscussion('r/1', 'v 1')).resolves.toEqual(discussion);
    await expect(listReviewPins('r-1', 'v-1')).resolves.toEqual([{ id: 'pin-1' }]);

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/reviews/r%2F1/versions/v%201/discussion',
    );
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
    expect(fetchMock.mock.calls[1][0]).toContain('/reviews/r-1/versions/v-1/pins');
  });

  it('creates, updates and deletes pins and comments with CSRF', async () => {
    const pin = {
      id: 'pin-1',
      reviewVersionId: 'v-1',
      assetId: 'asset-1',
      xPercent: 12.5,
      yPercent: 30,
      status: 'OPEN',
      authorId: 'u-1',
      authorName: 'Anna',
      authorInitials: 'AK',
      createdAt: 'now',
      resolvedBy: null,
      resolvedByName: null,
      resolvedAt: null,
      comments: [],
    };
    const comment = {
      id: 'comment-1',
      pinId: 'pin-1',
      parentCommentId: null,
      authorId: 'u-1',
      authorName: 'Anna',
      authorInitials: 'AK',
      body: 'Updated',
      createdAt: 'now',
      updatedAt: 'now',
      editedAt: 'now',
      deleted: false,
      attachments: [],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(json(pin, 201))
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(json({ ...pin, status: 'RESOLVED' }))
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(json(comment))
      .mockResolvedValueOnce(json({ token: 'csrf-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await createVersionPin('r-1', 'v-1', {
      xPercent: 12.5,
      yPercent: 30,
      body: 'Note',
      attachmentAssetIds: ['asset-2'],
    });
    await updatePin('pin/1', { status: 'RESOLVED' });
    await deletePin('pin 1');
    await updateComment('comment/1', { body: 'Updated' });
    await deleteComment('comment 1');

    expect(fetchMock.mock.calls[1][0]).toContain('/reviews/r-1/versions/v-1/pins');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      xPercent: 12.5,
      yPercent: 30,
      body: 'Note',
      attachmentAssetIds: ['asset-2'],
    });
    expect(fetchMock.mock.calls[3][0]).toContain('/pins/pin%2F1');
    expect(fetchMock.mock.calls[3][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ status: 'RESOLVED' });
    expect(fetchMock.mock.calls[5][0]).toContain('/pins/pin%201');
    expect(fetchMock.mock.calls[5][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[7][0]).toContain('/comments/comment%2F1');
    expect(fetchMock.mock.calls[7][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[7][1].body)).toEqual({ body: 'Updated' });
    expect(fetchMock.mock.calls[9][0]).toContain('/comments/comment%201');
    expect(fetchMock.mock.calls[9][1].method).toBe('DELETE');
    expect(
      fetchMock.mock.calls.every(
        (call, index) => index % 2 === 1 || call[0].includes('/auth/csrf'),
      ),
    ).toBe(true);
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

describe('project review API operations', () => {
  const csrf = () => json({ token: 'csrf-token' });
  const project = {
    id: 'p-1',
    workspaceId: 'ws-1',
    name: 'Projekt',
    description: null,
    status: 'ACTIVE',
    tone: 'sage',
    createdBy: 'u-1',
    createdByName: 'Anna',
    createdAt: '2026-11-11T10:00:00Z',
    updatedAt: '2026-11-11T10:00:00Z',
    openComments: 0,
    members: [],
  };

  it('reads a project, its assets, members and review summaries', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(project))
      .mockResolvedValueOnce(json([{ id: 'asset-1' }]))
      .mockResolvedValueOnce(json([{ id: 'member-1' }]))
      .mockResolvedValueOnce(json([{ id: 'review-1' }]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getProject('p/1')).resolves.toEqual(project);
    await expect(listProjectAssets('p 1')).resolves.toEqual([{ id: 'asset-1' }]);
    await expect(listWorkspaceMembers('ws/1')).resolves.toEqual([{ id: 'member-1' }]);
    await expect(listProjectReviews('p-1')).resolves.toEqual([{ id: 'review-1' }]);

    expect(fetchMock.mock.calls[0][0]).toContain('/projects/p%2F1');
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
    expect(fetchMock.mock.calls[1][0]).toContain('/projects/p%201/assets');
    expect(fetchMock.mock.calls[2][0]).toContain('/workspaces/ws%2F1/members');
    expect(fetchMock.mock.calls[3][0]).toContain('/projects/p-1/reviews');
  });

  it('uploads review images and attachments as CSRF-protected multipart', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json({ id: 'asset-1', url: 'assets/asset-1/content' }, 201))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json({ id: 'asset-2', url: 'assets/asset-2/content' }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['png'], 'shot.png', { type: 'image/png' });

    await expect(uploadProjectAsset('p-1', file)).resolves.toMatchObject({ id: 'asset-1' });
    await expect(uploadProjectAttachment('p-1', file)).resolves.toMatchObject({ id: 'asset-2' });

    const [, uploadInit] = fetchMock.mock.calls[1];
    expect(fetchMock.mock.calls[1][0]).toContain('/projects/p-1/assets');
    expect(uploadInit.headers.get('X-XSRF-TOKEN')).toBe('csrf-token');
    expect(uploadInit.headers.has('Content-Type')).toBe(false);
    expect(uploadInit.body).toBeInstanceOf(FormData);
    expect((uploadInit.body as FormData).get('file')).toBe(file);
    expect(fetchMock.mock.calls[3][0]).toContain('/projects/p-1/attachments');
  });

  it('deletes an unreferenced project asset with CSRF', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteProjectAsset('asset/1')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1][0]).toContain('/assets/asset%2F1');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[1][1].headers.get('X-XSRF-TOKEN')).toBe('csrf-token');
  });

  it('creates, reads and updates review threads with CSRF', async () => {
    const review = { summary: { id: 'r-1', title: 'Wątek' }, reviewers: [], versions: [], approvals: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json(review, 201))
      .mockResolvedValueOnce(json(review))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json({ ...review, summary: { ...review.summary, title: 'Nowy' } }));
    vi.stubGlobal('fetch', fetchMock);

    const input = {
      title: 'Wątek',
      description: 'Opis',
      assetId: 'asset-1',
      reviewerIds: ['u-2'],
    };
    await expect(createReview('p-1', input)).resolves.toEqual(review);
    await expect(getReview('r/1')).resolves.toEqual(review);
    await expect(updateReview('r-1', { title: 'Nowy', reviewerIds: [] })).resolves.toMatchObject({
      summary: { title: 'Nowy' },
    });

    expect(fetchMock.mock.calls[1][0]).toContain('/projects/p-1/reviews');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(input);
    expect(fetchMock.mock.calls[2][0]).toContain('/reviews/r%2F1');
    expect(fetchMock.mock.calls[4][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[4][1].headers.get('X-XSRF-TOKEN')).toBe('csrf-token');
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({ title: 'Nowy', reviewerIds: [] });
  });

  it('adds versions, submits decisions, closes and deletes threads', async () => {
    const version = { id: 'v-2', versionNumber: 2, createdAt: 'now', createdByName: 'Anna' };
    const approval = { userId: 'u-2', decision: 'APPROVED', versionId: 'v-2' };
    const review = { summary: { id: 'r-1' }, reviewers: [], versions: [version], approvals: [approval] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json(version, 201))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json(approval, 201))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(json(review))
      .mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await createReviewVersion('r-1', { assetId: 'asset-2', note: 'Poprawki' });
    await submitReviewApproval('r-1', { decision: 'APPROVED', versionId: 'v-2', note: 'OK' });
    await closeReview('r-1');
    await deleteReview('r-1');

    expect(fetchMock.mock.calls[1][0]).toContain('/reviews/r-1/versions');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ assetId: 'asset-2', note: 'Poprawki' });
    expect(fetchMock.mock.calls[3][0]).toContain('/reviews/r-1/approvals');
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
      decision: 'APPROVED',
      versionId: 'v-2',
      note: 'OK',
    });
    expect(fetchMock.mock.calls[5][0]).toContain('/reviews/r-1/close');
    expect(fetchMock.mock.calls[5][1].method).toBe('POST');
    expect(fetchMock.mock.calls[7][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls.every((call, index) => index % 2 === 1 || call[0].includes('/auth/csrf'))).toBe(true);
  });
});
