import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getMessages } from '@markerit/i18n';
import type { CommentDto, DiscussionDto, DiscussionPinDto } from '@markerit/api-client';
import { DiscussionPanel } from './discussion-panel';

const messages = getMessages('pl');
const locale = 'pl' as const;

const pins: DiscussionPinDto[] = [
  {
    id: 'pin-1',
    assetId: 'asset-1',
    xPercent: 20,
    yPercent: 30,
    status: 'OPEN',
    authorId: 'user-2',
    authorName: 'Jan Nowak',
    authorInitials: 'JN',
    createdAt: '2026-11-10T10:00:00Z',
    resolvedBy: null,
    resolvedByName: null,
    resolvedAt: null,
    commentCount: 2,
  },
  {
    id: 'pin-2',
    assetId: 'asset-1',
    xPercent: 70,
    yPercent: 50,
    status: 'RESOLVED',
    authorId: 'user-1',
    authorName: 'Anna Kowalska',
    authorInitials: 'AK',
    createdAt: '2026-11-10T10:30:00Z',
    resolvedBy: 'user-2',
    resolvedByName: 'Jan Nowak',
    resolvedAt: '2026-11-10T13:00:00Z',
    commentCount: 1,
  },
];

const comments: CommentDto[] = [
  {
    id: 'comment-1',
    pinId: 'pin-1',
    parentCommentId: null,
    authorId: 'user-2',
    authorName: 'Jan Nowak',
    authorInitials: 'JN',
    body: 'Proszę poprawić margines.',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    editedAt: null,
    deleted: false,
    attachments: [],
  },
  {
    id: 'comment-2',
    pinId: 'pin-2',
    parentCommentId: null,
    authorId: 'user-1',
    authorName: 'Anna Kowalska',
    authorInitials: 'AK',
    body: 'To już poprawione.',
    createdAt: '2026-11-10T10:30:00Z',
    updatedAt: '2026-11-10T10:40:00Z',
    editedAt: '2026-11-10T10:40:00Z',
    deleted: false,
    attachments: [
      {
        id: 'attachment-1',
        projectId: 'project-1',
        purpose: 'ATTACHMENT',
        contentType: 'image/png',
        originalName: 'notatka.png',
        sizeBytes: 100,
        width: 40,
        height: 40,
        url: 'assets/attachment-1/content',
        createdAt: '2026-11-10T10:30:00Z',
      },
    ],
  },
  {
    id: 'comment-3',
    pinId: 'pin-1',
    parentCommentId: 'comment-1',
    authorId: 'user-2',
    authorName: 'Jan Nowak',
    authorInitials: 'JN',
    body: 'Dziękuję!',
    createdAt: '2026-11-10T11:00:00Z',
    updatedAt: '2026-11-10T11:00:00Z',
    editedAt: null,
    deleted: false,
    attachments: [],
  },
];

const discussion: DiscussionDto = {
  reviewId: 'review-1',
  versionId: 'version-2',
  pins,
  comments,
  reviews: [
    {
      id: 'review-decision-1',
      reviewId: 'review-1',
      versionId: 'version-2',
      kind: 'REVIEW',
      decision: 'APPROVED',
      note: 'Wszystko wygląda dobrze.',
      authorId: 'user-2',
      authorName: 'Jan Nowak',
      authorInitials: 'JN',
      createdAt: '2026-11-10T12:00:00Z',
    },
  ],
};

function renderPanel(overrides: Partial<Parameters<typeof DiscussionPanel>[0]> = {}) {
  const handlers = {
    onRetry: vi.fn(),
    onHoverPin: vi.fn(),
    onSelectPin: vi.fn(),
    onFocusPin: vi.fn(),
    onReply: vi.fn().mockResolvedValue(null),
    onEditComment: vi.fn().mockResolvedValue(null),
    onDeleteComment: vi.fn().mockResolvedValue(null),
    onTogglePinStatus: vi.fn().mockResolvedValue(null),
    onDeletePin: vi.fn().mockResolvedValue(null),
  };
  const view = render(
    <DiscussionPanel
      messages={messages}
      locale={locale}
      discussion={discussion}
      loading={false}
      error={null}
      isClosed={false}
      currentUserId="user-1"
      canModerate={false}
      highlightedPinId={null}
      onRetry={handlers.onRetry}
      onHoverPin={handlers.onHoverPin}
      onSelectPin={handlers.onSelectPin}
      onFocusPin={handlers.onFocusPin}
      onReply={handlers.onReply}
      onEditComment={handlers.onEditComment}
      onDeleteComment={handlers.onDeleteComment}
      onTogglePinStatus={handlers.onTogglePinStatus}
      onDeletePin={handlers.onDeletePin}
      {...overrides}
    />,
  );
  return { ...handlers, unmount: view.unmount };
}

describe('DiscussionPanel', () => {
  it('renders comments from all pins and review decisions chronologically', () => {
    renderPanel();

    const feed = screen.getByTestId('discussion-feed');
    const items = Array.from(feed.children);
    expect(items.map((item) => (item as HTMLElement).dataset.testid)).toEqual([
      'comment-comment-1',
      'comment-comment-2',
      'comment-comment-3',
      'review-item-review-decision-1',
    ]);
    expect(screen.getByText('Proszę poprawić margines.')).toBeInTheDocument();
    expect(screen.getByText('Dziękuję!')).toBeInTheDocument();
    expect(screen.getByText('Odpowiedź dla: Jan Nowak')).toBeInTheDocument();
    expect(screen.getByText(messages.project.commentEdited)).toBeInTheDocument();

    const review = screen.getByTestId('review-item-review-decision-1');
    expect(within(review).getByText(messages.project.discussionReviewKind)).toBeInTheDocument();
    expect(within(review).getByText('Zatwierdzono')).toBeInTheDocument();
    expect(within(review).getByText('Wszystko wygląda dobrze.')).toBeInTheDocument();

    expect(screen.getAllByTestId('pin-chip-pin-1')[0]).toHaveTextContent('Pinezka #1');
    expect(screen.getAllByTestId('pin-chip-pin-2')[0]).toHaveTextContent('Pinezka #2');
    expect(screen.getByText('Otwarte pinezki: 1 · rozwiązane: 1')).toBeInTheDocument();
    expect(screen.getByText('Elementy w tej wersji: 4')).toBeInTheDocument();
  });

  it('links comment hover and pin selection to the canvas', async () => {
    const user = userEvent.setup();
    const handlers = renderPanel();

    await user.hover(screen.getByTestId('comment-comment-2'));
    expect(handlers.onHoverPin).toHaveBeenCalledWith('pin-2');

    await user.click(screen.getByText('To już poprawione.'));
    expect(handlers.onFocusPin).toHaveBeenCalledWith('pin-2');

    await user.click(screen.getAllByTestId('pin-chip-pin-1')[0]);
    expect(handlers.onSelectPin).toHaveBeenCalledWith('pin-1');
  });

  it('renders attachment thumbnails with accessible names', () => {
    renderPanel();
    const image = screen.getByRole('img', { name: 'notatka.png' });
    expect(image).toHaveAttribute('src', '/api/assets/attachment-1/content');
    expect(image.closest('a')).toHaveAttribute('href', '/api/assets/attachment-1/content');
    expect(image.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('submits a reply with attachments', async () => {
    const user = userEvent.setup();
    const handlers = renderPanel();

    await user.click(
      within(screen.getByTestId('comment-comment-1')).getByRole('button', {
        name: messages.project.replyAction,
      }),
    );
    const form = screen.getByTestId('reply-form-comment-1');
    await user.type(within(form).getByLabelText(messages.project.replyFormLabel), 'Nowa odpowiedź');
    const file = new File(['png'], 'detal.png', { type: 'image/png' });
    await user.upload(within(form).getByLabelText(messages.project.attachmentsLabel), file);
    await user.click(
      within(form).getByRole('button', { name: messages.project.replySubmit }),
    );

    await waitFor(() =>
      expect(handlers.onReply).toHaveBeenCalledWith('pin-1', 'comment-1', 'Nowa odpowiedź', [file]),
    );
    expect(screen.queryByTestId('reply-form-comment-1')).not.toBeInTheDocument();
  });

  it('edits and deletes the current user comment', async () => {
    const user = userEvent.setup();
    const handlers = renderPanel();
    const card = screen.getByTestId('comment-comment-2');

    await user.click(
      within(card).getByRole('button', {
        name: messages.project.editCommentFor.replace('{name}', 'Anna Kowalska'),
      }),
    );
    const editForm = screen.getByTestId('edit-form-comment-2');
    const textarea = within(editForm).getByLabelText(messages.project.editCommentLabel);
    await user.clear(textarea);
    await user.type(textarea, 'Poprawiona treść');
    await user.click(
      within(editForm).getByRole('button', { name: messages.project.saveComment }),
    );

    await waitFor(() =>
      expect(handlers.onEditComment).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'comment-2' }),
        'Poprawiona treść',
      ),
    );
    expect(screen.queryByTestId('edit-form-comment-2')).not.toBeInTheDocument();

    await user.click(
      within(card).getByRole('button', {
        name: messages.project.deleteCommentFor.replace('{name}', 'Anna Kowalska'),
      }),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(messages.project.deleteCommentDescription),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: messages.project.delete }));
    await waitFor(() =>
      expect(handlers.onDeleteComment).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'comment-2' }),
      ),
    );
  });

  it('resolves and deletes pins according to permissions', async () => {
    const user = userEvent.setup();
    const handlers = renderPanel();

    await user.click(screen.getByRole('button', { name: messages.project.resolvePin }));
    await waitFor(() =>
      expect(handlers.onTogglePinStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pin-1', status: 'OPEN' }),
      ),
    );

    // Pin #1 belongs to another user and the current user is not an admin.
    const deletePinName = messages.project.deletePinFor.replace('{number}', '2');
    expect(screen.queryByRole('button', { name: deletePinName })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: deletePinName }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(messages.project.deletePinDescription)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: messages.project.delete }));
    await waitFor(() =>
      expect(handlers.onDeletePin).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pin-2' }),
      ),
    );
  });

  it('hides the delete-pin action for other users without moderation rights', () => {
    renderPanel();
    const deleteButtons = screen.getAllByRole('button', {
      name: /Usuń pinezkę #/,
    });
    expect(deleteButtons).toHaveLength(1);
    expect(deleteButtons[0]).toHaveAccessibleName(
      messages.project.deletePinFor.replace('{number}', '2'),
    );
    expect(deleteButtons[0].closest('[data-pin-id]')).toHaveAttribute('data-pin-id', 'pin-2');
  });

  it('disables replies in a closed review but keeps edit and delete available', () => {
    renderPanel({ isClosed: true });

    expect(screen.getByTestId('discussion-closed')).toHaveTextContent(
      messages.project.discussionClosedNotice,
    );
    for (const button of screen.getAllByRole('button', { name: messages.project.replyAction })) {
      expect(button).toBeDisabled();
    }
    expect(
      screen.getByRole('button', {
        name: messages.project.editCommentFor.replace('{name}', 'Anna Kowalska'),
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name: messages.project.deleteCommentFor.replace('{name}', 'Anna Kowalska'),
      }),
    ).toBeEnabled();
  });

  it('shows a loading skeleton', () => {
    const handlers = renderPanel({ discussion: null, loading: true });
    expect(screen.getByTestId('discussion-loading')).toBeInTheDocument();
    expect(handlers.onRetry).not.toHaveBeenCalled();
    handlers.unmount();
  });

  it('shows an error with a retry action', async () => {
    const user = userEvent.setup();
    const handlers = renderPanel({
      discussion: null,
      loading: false,
      error: 'Nie udało się wczytać dyskusji.',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się wczytać dyskusji.');
    await user.click(screen.getByRole('button', { name: messages.project.retry }));
    expect(handlers.onRetry).toHaveBeenCalled();
  });

  it('shows an empty feed and distinct realtime states', () => {
    renderPanel({
      discussion: { ...discussion, pins: [], comments: [], reviews: [] },
      realtimeStatus: 'connecting',
    });
    expect(screen.getByTestId('discussion-empty')).toHaveTextContent(
      messages.project.discussionEmptyTitle,
    );
    expect(screen.getByTestId('realtime-status')).toHaveTextContent(
      messages.project.realtimeConnecting,
    );
  });

  it('offers a manual retry when live updates are unavailable', async () => {
    const user = userEvent.setup();
    const onRetryRealtime = vi.fn();
    renderPanel({ realtimeStatus: 'unavailable', onRetryRealtime });

    expect(screen.getByTestId('realtime-status')).toHaveTextContent(
      messages.project.realtimeUnavailable,
    );
    await user.click(screen.getByRole('button', { name: messages.project.retry }));
    expect(onRetryRealtime).toHaveBeenCalled();
  });
});
