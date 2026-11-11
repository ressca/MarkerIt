'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  MessageSquare,
  Pencil,
  Reply,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CommentDto,
  DiscussionDto,
  DiscussionPinDto,
  DiscussionReviewDto,
} from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Textarea,
} from '@markerit/ui';
import { cn } from 'cn';
import { assetContentUrl } from '../../../../../lib/assets';
import { formatDateTime } from '../../../../../lib/format';
import { reviewDecisionLabel } from '../../../../../lib/project-labels';
import type { RealtimeStatus } from '../../../../../lib/realtime';
import {
  buildDiscussionFeed,
  commentDepth,
  commentsById,
  pinNumberMap,
} from '../discussion-utils';
import { CommentComposer } from './comment-composer';

export interface DiscussionPanelProps {
  messages: TranslationMessages;
  locale: 'pl' | 'en';
  discussion: DiscussionDto | null;
  loading: boolean;
  error: string | null;
  isClosed: boolean;
  currentUserId: string;
  canModerate: boolean;
  highlightedPinId: string | null;
  realtimeStatus?: RealtimeStatus;
  onRetry: () => void;
  /** Restarts the realtime connection after the automatic retry cap. */
  onRetryRealtime?: () => void;
  onHoverPin: (pinId: string | null) => void;
  onSelectPin: (pinId: string) => void;
  /** Scrolls to the matching canvas marker when a comment is clicked. */
  onFocusPin: (pinId: string) => void;
  onReply: (
    pinId: string,
    parentCommentId: string | null,
    body: string,
    files: File[],
  ) => Promise<string | null>;
  onEditComment: (comment: CommentDto, body: string) => Promise<string | null>;
  onDeleteComment: (comment: CommentDto) => Promise<string | null>;
  onTogglePinStatus: (pin: DiscussionPinDto) => Promise<string | null>;
  onDeletePin: (pin: DiscussionPinDto) => Promise<string | null>;
}

type ConfirmTarget =
  | { kind: 'pin'; pin: DiscussionPinDto }
  | { kind: 'comment'; comment: CommentDto };

function realtimeLabel(status: RealtimeStatus | undefined, messages: TranslationMessages): string | null {
  switch (status) {
    case 'connected':
      return messages.project.realtimeConnected;
    case 'connecting':
      return messages.project.realtimeConnecting;
    case 'disconnected':
      return messages.project.realtimeReconnecting;
    case 'error':
    case 'unavailable':
      return messages.project.realtimeUnavailable;
    default:
      return null;
  }
}

/**
 * Chronological discussion feed. Comments from every pin are interleaved with
 * review decisions, while each comment keeps its pin label and can highlight
 * (or scroll to) the matching canvas marker.
 */
export function DiscussionPanel({
  messages,
  locale,
  discussion,
  loading,
  error,
  isClosed,
  currentUserId,
  canModerate,
  highlightedPinId,
  realtimeStatus,
  onRetry,
  onRetryRealtime,
  onHoverPin,
  onSelectPin,
  onFocusPin,
  onReply,
  onEditComment,
  onDeleteComment,
  onTogglePinStatus,
  onDeletePin,
}: DiscussionPanelProps) {
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyPinId, setBusyPinId] = useState<string | null>(null);

  const feed = useMemo(() => (discussion ? buildDiscussionFeed(discussion) : []), [discussion]);
  const numbers = useMemo(
    () => (discussion ? pinNumberMap(discussion) : new Map<string, number>()),
    [discussion],
  );
  const commentMap = useMemo(
    () => commentsById(discussion?.comments ?? []),
    [discussion?.comments],
  );
  const firstCommentByPin = useMemo(() => {
    const seen = new Map<string, string>();
    for (const comment of discussion?.comments ?? []) {
      if (!seen.has(comment.pinId)) seen.set(comment.pinId, comment.id);
    }
    return seen;
  }, [discussion?.comments]);
  const pinsById = useMemo(
    () => new Map((discussion?.pins ?? []).map((pin) => [pin.id, pin])),
    [discussion?.pins],
  );

  async function togglePinStatus(pin: DiscussionPinDto) {
    setBusyPinId(pin.id);
    setActionError(null);
    try {
      const result = await onTogglePinStatus(pin);
      if (result) setActionError(result);
    } finally {
      setBusyPinId(null);
    }
  }

  async function confirmDelete() {
    if (!confirm) return;
    const result =
      confirm.kind === 'pin'
        ? await onDeletePin(confirm.pin)
        : await onDeleteComment(confirm.comment);
    if (result) {
      setActionError(result);
      return;
    }
    setConfirm(null);
  }

  const liveLabel = realtimeLabel(realtimeStatus, messages);

  return (
    <section
      aria-labelledby="discussion-heading"
      data-testid="discussion-panel"
      className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div>
          <h2 id="discussion-heading" className="flex items-center gap-1.5 text-sm font-semibold">
            <MessageSquare className="size-4 text-primary" />
            {messages.project.discussionTitle}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {messages.project.discussionCount.replace('{count}', String(feed.length))}
          </p>
        </div>
        {liveLabel && (
          <div className="flex items-center gap-1.5">
            <span
              data-testid="realtime-status"
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px]',
                realtimeStatus === 'connected'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-border bg-muted/40 text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  realtimeStatus === 'connected' ? 'bg-emerald-500' : 'bg-muted-foreground',
                )}
              />
              {liveLabel}
            </span>
            {realtimeStatus === 'unavailable' && onRetryRealtime && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={onRetryRealtime}
                  className="gap-1 text-muted-foreground"
                >
                  <RotateCcw className="size-3" />
                  {messages.project.retry}
                </Button>
              )}
          </div>
        )}
      </header>

      {isClosed && (
        <p
          role="note"
          data-testid="discussion-closed"
          className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          {messages.project.discussionClosedNotice}
        </p>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
        >
          <span>{actionError}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-5 shrink-0 text-destructive hover:bg-destructive/15"
            aria-label={messages.project.close}
            onClick={() => setActionError(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {messages.project.retry}
          </Button>
        </div>
      )}

      {loading && !discussion && (
        <div className="space-y-2" data-testid="discussion-loading">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      )}

      {!loading && !discussion && !error && (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          {messages.project.discussionLoadError}
        </p>
      )}

      {discussion && feed.length === 0 && (
        <div
          data-testid="discussion-empty"
          className="rounded-lg border border-dashed border-border px-3 py-8 text-center"
        >
          <MessageSquare className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">
            {messages.project.discussionEmptyTitle}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {messages.project.discussionEmptyDescription}
          </p>
        </div>
      )}

      {discussion && feed.length > 0 && (
        <ol data-testid="discussion-feed" className="flex flex-col gap-2">
          {feed.map((item) => {
            if (item.kind === 'review') {
              return (
                <ReviewFeedItem
                  key={`review-${item.review.id}`}
                  review={item.review}
                  messages={messages}
                  locale={locale}
                />
              );
            }

            const comment = item.comment;
            const pin = pinsById.get(comment.pinId);
            const number = numbers.get(comment.pinId) ?? 0;
            const depth = commentDepth(comment, commentMap);
            const parent = comment.parentCommentId
              ? commentMap.get(comment.parentCommentId)
              : undefined;
            const isFirstForPin = firstCommentByPin.get(comment.pinId) === comment.id;
            const canEdit = !comment.deleted && comment.authorId === currentUserId;
            const canDelete =
              !comment.deleted && (comment.authorId === currentUserId || canModerate);
            const canDeletePin = Boolean(
              pin && (pin.authorId === currentUserId || canModerate),
            );

            return (
              <li
                key={`comment-${comment.id}`}
                id={`pin-comment-${comment.id}`}
                data-testid={`comment-${comment.id}`}
                data-pin-id={comment.pinId}
                style={{ marginLeft: `${Math.min(depth, 3) * 16}px` }}
                onMouseEnter={() => onHoverPin(comment.pinId)}
                onMouseLeave={() => onHoverPin(null)}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('button,a,input,textarea,label')) {
                    return;
                  }
                  onFocusPin(comment.pinId);
                }}
                className={cn(
                  'rounded-lg border p-2.5 transition-colors',
                  highlightedPinId === comment.pinId
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border bg-background/60',
                  comment.deleted && 'opacity-70',
                )}
              >
                {isFirstForPin && pin && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-border/70 pb-2">
                    <PinChip
                      number={number}
                      pin={pin}
                      messages={messages}
                      highlighted={highlightedPinId === pin.id}
                      onSelect={() => onSelectPin(pin.id)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={busyPinId === pin.id}
                      onClick={() => void togglePinStatus(pin)}
                      className="gap-1"
                    >
                      {pin.status === 'RESOLVED' ? (
                        <RotateCcw className="size-3" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                      {pin.status === 'RESOLVED'
                        ? messages.project.reopenPin
                        : messages.project.resolvePin}
                    </Button>
                    {canDeletePin && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        aria-label={messages.project.deletePinFor.replace(
                          '{number}',
                          String(number),
                        )}
                        onClick={() => setConfirm({ kind: 'pin', pin })}
                        className="gap-1"
                      >
                        <Trash2 className="size-3" />
                        {messages.project.deletePin}
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Avatar size="sm" className="size-7 shrink-0 text-[10px] font-bold">
                    <AvatarFallback>{comment.authorInitials || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{comment.authorName}</span>
                      {!isFirstForPin && (
                        <PinChip
                          number={number}
                          pin={pin}
                          messages={messages}
                          highlighted={highlightedPinId === comment.pinId}
                          onSelect={() => onSelectPin(comment.pinId)}
                          compact
                        />
                      )}
                      <time dateTime={comment.createdAt}>
                        {formatDateTime(comment.createdAt, locale)}
                      </time>
                      {comment.editedAt && !comment.deleted && (
                        <span className="italic">{messages.project.commentEdited}</span>
                      )}
                    </div>
                    {parent && (
                      <p className="text-[11px] text-muted-foreground">
                        {messages.project.replyToLabel.replace('{name}', parent.authorName)}
                      </p>
                    )}
                    {comment.deleted ? (
                      <p className="text-xs italic text-muted-foreground">
                        {messages.project.commentDeleted}
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                        {comment.body}
                      </p>
                    )}

                    {!comment.deleted && comment.attachments.length > 0 && (
                      <ul
                        className="flex flex-wrap gap-1.5"
                        aria-label={messages.project.attachmentsLabel}
                      >
                        {comment.attachments.map((attachment) => (
                          <li key={attachment.id}>
                            <a
                              href={assetContentUrl(attachment.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="block size-16 overflow-hidden rounded-md border border-border bg-muted outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <img
                                src={assetContentUrl(attachment.id)}
                                alt={attachment.originalName}
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}

                    {!comment.deleted && (
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={isClosed || replyToId === comment.id}
                          onClick={() => {
                            setReplyToId(comment.id);
                            setEditingId(null);
                          }}
                          className="gap-1 text-muted-foreground"
                        >
                          <Reply className="size-3" />
                          {messages.project.replyAction}
                        </Button>
                        {canEdit && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            aria-label={messages.project.editCommentFor.replace(
                              '{name}',
                              comment.authorName,
                            )}
                            onClick={() => {
                              setEditingId(comment.id);
                              setReplyToId(null);
                            }}
                            className="gap-1 text-muted-foreground"
                          >
                            <Pencil className="size-3" />
                            {messages.project.editComment}
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            aria-label={messages.project.deleteCommentFor.replace(
                              '{name}',
                              comment.authorName,
                            )}
                            onClick={() => setConfirm({ kind: 'comment', comment })}
                            className="gap-1 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3" />
                            {messages.project.deleteComment}
                          </Button>
                        )}
                      </div>
                    )}

                    {editingId === comment.id && (
                      <EditCommentForm
                        comment={comment}
                        messages={messages}
                        onCancel={() => setEditingId(null)}
                        onSave={async (body) => {
                          const result = await onEditComment(comment, body);
                          if (!result) setEditingId(null);
                          return result;
                        }}
                      />
                    )}

                    {replyToId === comment.id && !isClosed && (
                      <CommentComposer
                        messages={messages}
                        label={messages.project.replyFormLabel}
                        placeholder={messages.project.replyPlaceholder}
                        submitLabel={messages.project.replySubmit}
                        testId={`reply-form-${comment.id}`}
                        onCancel={() => setReplyToId(null)}
                        onDone={() => setReplyToId(null)}
                        onSubmit={(body, files) =>
                          onReply(comment.pinId, comment.id, body, files)
                        }
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {discussion && discussion.pins.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {messages.project.pinsSummary
            .replace('{open}', String(discussion.pins.filter((pin) => pin.status === 'OPEN').length))
            .replace(
              '{resolved}',
              String(discussion.pins.filter((pin) => pin.status === 'RESOLVED').length),
            )}
        </p>
      )}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="sm:max-w-md" closeLabel={messages.project.close}>
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === 'pin'
                ? messages.project.deletePinTitle
                : messages.project.deleteCommentTitle}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === 'pin'
                ? messages.project.deletePinDescription
                : messages.project.deleteCommentDescription}
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <p role="alert" className="text-xs text-destructive">
              {actionError}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(null)}>
              {messages.project.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void confirmDelete()}
            >
              {messages.project.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface PinChipProps {
  number: number;
  pin?: DiscussionPinDto;
  messages: TranslationMessages;
  highlighted: boolean;
  compact?: boolean;
  onSelect: () => void;
}

function PinChip({ number, pin, messages, highlighted, compact, onSelect }: PinChipProps) {
  const resolved = pin?.status === 'RESOLVED';
  return (
    <button
      type="button"
      data-testid={pin ? `pin-chip-${pin.id}` : undefined}
      onClick={onSelect}
      aria-label={messages.project.pinLabel.replace('{number}', String(number))}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
        compact && 'px-1',
        resolved
          ? 'border-border bg-muted text-muted-foreground'
          : 'border-primary/40 bg-primary/10 text-primary',
        highlighted && 'ring-2 ring-primary/40',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-3.5 items-center justify-center rounded-full text-[9px] font-bold',
          resolved ? 'bg-muted-foreground/30 text-foreground' : 'bg-primary text-primary-foreground',
        )}
      >
        {number}
      </span>
      {messages.project.pinLabel.replace('{number}', String(number))}
      <span className="sr-only">{resolved ? messages.project.pinStatusResolved : messages.project.pinStatusOpen}</span>
    </button>
  );
}

function ReviewFeedItem({
  review,
  messages,
  locale,
}: {
  review: DiscussionReviewDto;
  messages: TranslationMessages;
  locale: 'pl' | 'en';
}) {
  const approved = review.decision === 'APPROVED';
  return (
    <li
      data-testid={`review-item-${review.id}`}
      className={cn(
        'rounded-lg border-l-4 border-y border-r border-border bg-muted/20 p-2.5',
        approved ? 'border-l-emerald-500' : 'border-l-amber-500',
      )}
    >
      <div className="flex items-start gap-2">
        <Avatar size="sm" className="size-7 shrink-0 text-[10px] font-bold">
          <AvatarFallback>{review.authorInitials || 'R'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="h-4 px-1.5 text-[10px] uppercase">
              {messages.project.discussionReviewKind}
            </Badge>
            <span className="font-medium text-foreground">{review.authorName}</span>
            <Badge
              variant={approved ? 'default' : 'outline'}
              className={cn(
                'h-4 px-1.5 text-[10px]',
                approved
                  ? 'bg-emerald-600 text-white'
                  : 'border-amber-300 bg-amber-500/20 text-amber-800 dark:border-amber-700 dark:text-amber-200',
              )}
            >
              {reviewDecisionLabel(messages, review.decision)}
            </Badge>
            <time dateTime={review.createdAt}>
              {formatDateTime(review.createdAt, locale)}
            </time>
          </div>
          {review.note && (
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {review.note}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function EditCommentForm({
  comment,
  messages,
  onSave,
  onCancel,
}: {
  comment: CommentDto;
  messages: TranslationMessages;
  onSave: (body: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(comment.body);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setError(messages.project.commentRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await onSave(body.trim());
      if (result) setError(result);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid={`edit-form-${comment.id}`}
      className="space-y-2 rounded-lg border border-border bg-card p-2.5"
    >
      <Textarea
        value={body}
        maxLength={20_000}
        aria-label={messages.project.editCommentLabel}
        onChange={(event) => setBody(event.target.value)}
        className="min-h-16 text-sm"
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {messages.project.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={saving} className="gap-1">
          <Check className="size-3.5" />
          {saving ? messages.project.savingChanges : messages.project.saveComment}
        </Button>
      </div>
    </form>
  );
}
