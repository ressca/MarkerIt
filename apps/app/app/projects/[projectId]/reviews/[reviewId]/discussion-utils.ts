import type {
  CommentDto,
  DiscussionDto,
  DiscussionPinDto,
  DiscussionReviewDto,
  PinDto,
} from '@markerit/api-client';
import type { ReviewRealtimeEvent } from '../../../../lib/realtime';

export type DiscussionFeedItem =
  | { kind: 'comment'; comment: CommentDto }
  | { kind: 'review'; review: DiscussionReviewDto };

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function byCreatedAt<T extends { createdAt: string; id: string }>(left: T, right: T): number {
  return timestamp(left.createdAt) - timestamp(right.createdAt) || left.id.localeCompare(right.id);
}

/** Merges pin comments and approval decisions into one chronological feed. */
export function buildDiscussionFeed(discussion: DiscussionDto): DiscussionFeedItem[] {
  const comments: DiscussionFeedItem[] = discussion.comments.map((comment) => ({
    kind: 'comment',
    comment,
  }));
  const reviews: DiscussionFeedItem[] = discussion.reviews.map((review) => ({
    kind: 'review',
    review,
  }));
  return [...comments, ...reviews].sort((left, right) =>
    byCreatedAt(left.kind === 'comment' ? left.comment : left.review, right.kind === 'comment' ? right.comment : right.review),
  );
}

/** Stable 1-based pin numbers used by markers and feed labels. */
export function pinNumberMap(discussion: DiscussionDto): Map<string, number> {
  return new Map(discussion.pins.map((pin, index) => [pin.id, index + 1]));
}

export function commentsById(comments: CommentDto[]): Map<string, CommentDto> {
  return new Map(comments.map((comment) => [comment.id, comment]));
}

/** Reply nesting depth, capped defensively to keep corrupted trees renderable. */
export function commentDepth(
  comment: CommentDto,
  comments: Map<string, CommentDto>,
): number {
  let depth = 0;
  let parentId = comment.parentCommentId ?? null;
  while (parentId && depth < 3) {
    const parent = comments.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentCommentId ?? null;
  }
  return depth;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCommentDto(value: unknown): value is CommentDto {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.pinId === 'string' &&
    typeof value.body === 'string' &&
    typeof value.deleted === 'boolean' &&
    Array.isArray(value.attachments)
  );
}

function isPinDto(value: unknown): value is PinDto {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.reviewVersionId === 'string' &&
    typeof value.xPercent === 'number' &&
    typeof value.yPercent === 'number' &&
    typeof value.status === 'string' &&
    Array.isArray(value.comments)
  );
}

function toDiscussionPin(pin: PinDto): DiscussionPinDto {
  return {
    id: pin.id,
    assetId: pin.assetId,
    xPercent: pin.xPercent,
    yPercent: pin.yPercent,
    status: pin.status,
    authorId: pin.authorId,
    authorName: pin.authorName,
    authorInitials: pin.authorInitials,
    createdAt: pin.createdAt,
    resolvedBy: pin.resolvedBy,
    resolvedByName: pin.resolvedByName,
    resolvedAt: pin.resolvedAt,
    commentCount: pin.comments.filter((comment) => !comment.deleted).length,
  };
}

function mergeComments(current: CommentDto[], incoming: CommentDto[]): CommentDto[] {
  const merged = new Map(current.map((comment) => [comment.id, comment]));
  for (const comment of incoming) {
    const existing = merged.get(comment.id);
    // Locally deleted comments are permanent tombstones. A delayed create/edit
    // event (or a reconnect replay) must never resurrect their body.
    if (existing?.deleted && !comment.deleted) {
      continue;
    }
    // A delayed duplicate must not overwrite a newer edit or tombstone.
    if (
      existing &&
      timestamp(comment.updatedAt || comment.createdAt) <
        timestamp(existing.updatedAt || existing.createdAt)
    ) {
      continue;
    }
    merged.set(comment.id, comment);
  }
  return [...merged.values()].sort(byCreatedAt);
}

function upsertPin(current: DiscussionDto, pin: PinDto): DiscussionDto {
  if (pin.reviewVersionId !== current.versionId) return current;
  const pins = [...current.pins];
  const nextPin = toDiscussionPin(pin);
  const index = pins.findIndex((item) => item.id === pin.id);
  if (index >= 0) pins[index] = nextPin;
  else pins.push(nextPin);
  pins.sort(byCreatedAt);
  return {
    ...current,
    pins,
    comments: mergeComments(current.comments, pin.comments),
  };
}

function recountPins(discussion: DiscussionDto): DiscussionDto {
  const counts = new Map<string, number>();
  for (const comment of discussion.comments) {
    if (!comment.deleted) {
      counts.set(comment.pinId, (counts.get(comment.pinId) ?? 0) + 1);
    }
  }
  return {
    ...discussion,
    pins: discussion.pins.map((pin) => ({
      ...pin,
      commentCount: counts.get(pin.id) ?? 0,
    })),
  };
}

function upsertCommentInDiscussion(
  current: DiscussionDto,
  comment: CommentDto,
): DiscussionDto | null {
  if (!current.pins.some((pin) => pin.id === comment.pinId)) return null;
  return recountPins({
    ...current,
    comments: mergeComments(current.comments, [comment]),
  });
}

function removePinFromDiscussion(current: DiscussionDto, pinId: string): DiscussionDto {
  return {
    ...current,
    pins: current.pins.filter((pin) => pin.id !== pinId),
    comments: current.comments.filter((comment) => comment.pinId !== pinId),
  };
}

/** Applies a mutation response (create/reopen/resolve pin) to the feed. */
export function applyPinMutation(current: DiscussionDto, pin: PinDto): DiscussionDto {
  return upsertPin(current, pin);
}

/** Applies a mutation response (create/edit comment) to the feed. */
export function applyCommentMutation(
  current: DiscussionDto,
  comment: CommentDto,
): DiscussionDto {
  return upsertCommentInDiscussion(current, comment) ?? current;
}

/**
 * Produces the same redacted tombstone the API broadcasts after deleting a
 * comment, so the feed updates immediately even before the realtime event.
 */
export function markCommentDeleted(current: DiscussionDto, comment: CommentDto): DiscussionDto {
  return applyCommentMutation(current, {
    ...comment,
    body: '',
    editedAt: null,
    deleted: true,
    // Stamp the local tombstone so any in-flight payload without a timestamp
    // cannot win the `updatedAt` comparison below.
    updatedAt: new Date().toISOString(),
    attachments: [],
  });
}

export function removePin(current: DiscussionDto, pinId: string): DiscussionDto {
  return removePinFromDiscussion(current, pinId);
}

/**
 * Folds a realtime event into the current discussion.
 *
 * Returns `null` when the event cannot be applied locally (review/version
 * changes, unknown payloads, or comments for an unknown pin) so the caller can
 * refetch the discussion as a fallback.
 */
export function applyDiscussionEvent(
  current: DiscussionDto,
  event: ReviewRealtimeEvent,
): DiscussionDto | null {
  if (event.reviewId && event.reviewId !== current.reviewId) return current;

  if (
    event.type === 'REVIEW_CREATED' ||
    event.type === 'REVIEW_UPDATED' ||
    event.type === 'REVIEW_DELETED' ||
    event.type === 'APPROVAL_CREATED' ||
    event.type === 'VERSION_CREATED'
  ) {
    return null;
  }

  // Pin and comment events are version-scoped; another version's changes must
  // not leak into the currently displayed canvas.
  if (event.versionId && event.versionId !== current.versionId) return current;

  switch (event.type) {
    case 'PIN_CREATED':
    case 'PIN_UPDATED':
      return isPinDto(event.payload) ? upsertPin(current, event.payload) : null;
    case 'PIN_DELETED':
      return event.pinId ? removePinFromDiscussion(current, event.pinId) : null;
    case 'COMMENT_CREATED':
    case 'COMMENT_UPDATED':
    case 'COMMENT_DELETED':
      return isCommentDto(event.payload)
        ? upsertCommentInDiscussion(current, event.payload)
        : null;
    default:
      return null;
  }
}
