import { describe, expect, it } from 'vitest';
import type { CommentDto, DiscussionDto, PinDto } from '@markerit/api-client';
import type { ReviewRealtimeEvent } from '../../../../lib/realtime';
import {
  applyCommentMutation,
  applyDiscussionEvent,
  applyPinMutation,
  buildDiscussionFeed,
  commentDepth,
  commentsById,
  markCommentDeleted,
  pinNumberMap,
  removePin,
} from './discussion-utils';

const comment = (overrides: Partial<CommentDto> = {}): CommentDto => ({
  id: 'comment-1',
  pinId: 'pin-1',
  parentCommentId: null,
  authorId: 'user-1',
  authorName: 'Anna Kowalska',
  authorInitials: 'AK',
  body: 'First note',
  createdAt: '2026-11-11T10:00:00Z',
  updatedAt: '2026-11-11T10:00:00Z',
  editedAt: null,
  deleted: false,
  attachments: [],
  ...overrides,
});

const discussion = (): DiscussionDto => ({
  reviewId: 'review-1',
  versionId: 'version-1',
  pins: [
    {
      id: 'pin-1',
      assetId: 'asset-1',
      xPercent: 20,
      yPercent: 30,
      status: 'OPEN',
      authorId: 'user-1',
      authorName: 'Anna Kowalska',
      authorInitials: 'AK',
      createdAt: '2026-11-11T10:00:00Z',
      resolvedBy: null,
      resolvedByName: null,
      resolvedAt: null,
      commentCount: 1,
    },
  ],
  comments: [comment()],
  reviews: [
    {
      id: 'review-decision-1',
      reviewId: 'review-1',
      versionId: 'version-1',
      kind: 'REVIEW',
      decision: 'APPROVED',
      note: 'Looks good',
      authorId: 'user-2',
      authorName: 'Jan Nowak',
      authorInitials: 'JN',
      createdAt: '2026-11-11T11:00:00Z',
    },
  ],
});

const pinPayload = (overrides: Partial<PinDto> = {}): PinDto => ({
  id: 'pin-2',
  reviewVersionId: 'version-1',
  assetId: 'asset-1',
  xPercent: 60,
  yPercent: 40,
  status: 'OPEN',
  authorId: 'user-1',
  authorName: 'Anna Kowalska',
  authorInitials: 'AK',
  createdAt: '2026-11-11T12:00:00Z',
  resolvedBy: null,
  resolvedByName: null,
  resolvedAt: null,
  comments: [comment({ id: 'comment-2', pinId: 'pin-2', createdAt: '2026-11-11T12:00:00Z' })],
  ...overrides,
});

const event = (overrides: Partial<ReviewRealtimeEvent> = {}): ReviewRealtimeEvent => ({
  type: 'PIN_CREATED',
  reviewId: 'review-1',
  versionId: 'version-1',
  pinId: 'pin-2',
  payloadType: 'PIN',
  occurredAt: '2026-11-11T12:00:00Z',
  ...overrides,
});

describe('discussion feed helpers', () => {
  it('merges comments and review decisions chronologically', () => {
    const feed = buildDiscussionFeed(discussion());
    expect(feed.map((item) => item.kind)).toEqual(['comment', 'review']);
    expect(feed[1].kind === 'review' && feed[1].review.decision).toBe('APPROVED');
  });

  it('numbers pins and resolves reply depth safely', () => {
    const current = discussion();
    current.comments.push(
      comment({ id: 'comment-3', parentCommentId: 'comment-1', createdAt: '2026-11-11T10:01:00Z' }),
      comment({ id: 'comment-4', parentCommentId: 'comment-3', createdAt: '2026-11-11T10:02:00Z' }),
      comment({ id: 'comment-5', parentCommentId: 'missing', createdAt: '2026-11-11T10:03:00Z' }),
    );
    const byId = commentsById(current.comments);
    expect(pinNumberMap(current).get('pin-1')).toBe(1);
    expect(commentDepth(current.comments[0], byId)).toBe(0);
    expect(commentDepth(current.comments[1], byId)).toBe(1);
    expect(commentDepth(current.comments[2], byId)).toBe(2);
    expect(commentDepth(current.comments[3], byId)).toBe(0);
  });
});

describe('discussion mutations', () => {
  it('upserts pins and their comments from a mutation response', () => {
    const next = applyPinMutation(discussion(), pinPayload());
    expect(next.pins.map((pin) => pin.id)).toEqual(['pin-1', 'pin-2']);
    expect(next.pins[1].commentCount).toBe(1);
    expect(next.comments.map((item) => item.id)).toEqual(['comment-1', 'comment-2']);

    const updated = applyPinMutation(next, pinPayload({ status: 'RESOLVED' }));
    expect(updated.pins[1].status).toBe('RESOLVED');
  });

  it('ignores pin payloads from another version', () => {
    const current = discussion();
    expect(applyPinMutation(current, pinPayload({ reviewVersionId: 'version-2' }))).toBe(current);
  });

  it('upserts comments, recalculates counts and keeps newest edits', () => {
    const created = applyCommentMutation(
      discussion(),
      comment({
        id: 'comment-2',
        createdAt: '2026-11-11T12:00:00Z',
        updatedAt: '2026-11-11T12:00:00Z',
      }),
    );
    expect(created.pins[0].commentCount).toBe(2);

    const edited = applyCommentMutation(
      created,
      comment({
        id: 'comment-2',
        body: 'Edited',
        createdAt: '2026-11-11T12:00:00Z',
        updatedAt: '2026-11-11T12:05:00Z',
        editedAt: '2026-11-11T12:05:00Z',
      }),
    );
    expect(edited.comments.find((item) => item.id === 'comment-2')?.body).toBe('Edited');

    const stale = applyCommentMutation(
      edited,
      comment({
        id: 'comment-2',
        body: 'Stale',
        createdAt: '2026-11-11T12:00:00Z',
        updatedAt: '2026-11-11T12:01:00Z',
      }),
    );
    expect(stale.comments.find((item) => item.id === 'comment-2')?.body).toBe('Edited');
  });

  it('ignores comments for unknown pins', () => {
    const current = discussion();
    expect(
      applyCommentMutation(current, comment({ id: 'comment-9', pinId: 'missing' })),
    ).toBe(current);
  });

  it('marks deleted comments as tombstones and removes their attachments', () => {
    const current = discussion();
    current.comments[0] = comment({
      attachments: [
        {
          id: 'asset-1',
          projectId: 'project-1',
          purpose: 'ATTACHMENT',
          contentType: 'image/png',
          originalName: 'note.png',
          sizeBytes: 10,
          url: 'assets/asset-1/content',
          createdAt: '2026-11-11T10:00:00Z',
        },
      ],
    });
    const next = markCommentDeleted(current, current.comments[0]);
    expect(next.comments[0].deleted).toBe(true);
    expect(next.comments[0].body).toBe('');
    expect(next.comments[0].attachments).toEqual([]);
    expect(next.pins[0].commentCount).toBe(0);
  });

  it('keeps locally deleted comments tombstoned even if a newer event resurrects them', () => {
    const current = discussion();
    const deleted = markCommentDeleted(current, current.comments[0]);

    const resurrected = applyCommentMutation(
      deleted,
      comment({
        id: 'comment-1',
        body: 'Back from the dead',
        updatedAt: '2026-11-11T13:00:00Z',
        editedAt: '2026-11-11T13:00:00Z',
      }),
    );

    expect(resurrected.comments[0].deleted).toBe(true);
    expect(resurrected.comments[0].body).toBe('');
  });

  it('removes a pin together with its comments', () => {
    const next = removePin(discussion(), 'pin-1');
    expect(next.pins).toEqual([]);
    expect(next.comments).toEqual([]);
  });
});

describe('applyDiscussionEvent', () => {
  it('applies pin create/update/delete events', () => {
    const created = applyDiscussionEvent(discussion(), event({ payload: pinPayload() }));
    expect(created?.pins).toHaveLength(2);

    const updated = applyDiscussionEvent(
      discussion(),
      event({ type: 'PIN_UPDATED', payload: pinPayload({ id: 'pin-1', status: 'RESOLVED', comments: [comment()] }) }),
    );
    expect(updated?.pins[0].status).toBe('RESOLVED');

    const deleted = applyDiscussionEvent(
      discussion(),
      event({ type: 'PIN_DELETED', pinId: 'pin-1', payload: null }),
    );
    expect(deleted?.pins).toEqual([]);
    expect(deleted?.comments).toEqual([]);
  });

  it('applies comment events and falls back for unknown pins', () => {
    const created = applyDiscussionEvent(
      discussion(),
      event({
        type: 'COMMENT_CREATED',
        commentId: 'comment-2',
        payload: comment({ id: 'comment-2', createdAt: '2026-11-11T12:00:00Z' }),
      }),
    );
    expect(created?.comments).toHaveLength(2);

    const deleted = applyDiscussionEvent(
      discussion(),
      event({
        type: 'COMMENT_DELETED',
        commentId: 'comment-1',
        payload: comment({ deleted: true, body: '', attachments: [] }),
      }),
    );
    expect(deleted?.comments[0].deleted).toBe(true);

    expect(
      applyDiscussionEvent(
        discussion(),
        event({
          type: 'COMMENT_CREATED',
          payload: comment({ id: 'comment-9', pinId: 'missing' }),
        }),
      ),
    ).toBeNull();
  });

  it('requests a refetch for review, version and unknown events', () => {
    expect(applyDiscussionEvent(discussion(), event({ type: 'REVIEW_CREATED' }))).toBeNull();
    expect(applyDiscussionEvent(discussion(), event({ type: 'REVIEW_UPDATED' }))).toBeNull();
    expect(applyDiscussionEvent(discussion(), event({ type: 'REVIEW_DELETED' }))).toBeNull();
    expect(applyDiscussionEvent(discussion(), event({ type: 'APPROVAL_CREATED' }))).toBeNull();
    expect(applyDiscussionEvent(discussion(), event({ type: 'VERSION_CREATED' }))).toBeNull();
    expect(applyDiscussionEvent(discussion(), event({ type: 'UNKNOWN_EVENT' }))).toBeNull();
  });

  it('ignores events for another review or version and invalid payloads', () => {
    const current = discussion();
    expect(applyDiscussionEvent(current, event({ reviewId: 'review-2' }))).toBe(current);
    expect(
      applyDiscussionEvent(current, event({ versionId: 'version-2', payload: pinPayload() })),
    ).toBe(current);
    expect(applyDiscussionEvent(current, event({ payload: { nope: true } }))).toBeNull();
    expect(
      applyDiscussionEvent(current, event({ type: 'PIN_DELETED', pinId: null })),
    ).toBeNull();
  });
});
