import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@markerit/api-client';
import type {
  AssetDto,
  CommentDto,
  DiscussionDto,
  ProjectDto,
  ReviewDto,
  WorkspaceMemberDto,
} from '@markerit/api-client';
import type { UserProfile } from '../../../../components/types';
import { ReviewThreadPage } from './review-thread-page';

const api = vi.hoisted(() => ({
  getReview: vi.fn(),
  getProject: vi.fn(),
  listProjectAssets: vi.fn(),
  listWorkspaceMembers: vi.fn(),
  uploadProjectAsset: vi.fn(),
  uploadProjectAttachment: vi.fn(),
  deleteProjectAsset: vi.fn(),
  createReviewVersion: vi.fn(),
  submitReviewApproval: vi.fn(),
  closeReview: vi.fn(),
  updateReview: vi.fn(),
  deleteReview: vi.fn(),
  getReviewDiscussion: vi.fn(),
  createVersionPin: vi.fn(),
  createPinComment: vi.fn(),
  updatePin: vi.fn(),
  deletePin: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const realtime = vi.hoisted(() => ({
  disconnect: vi.fn(),
  retry: vi.fn(),
  createReviewRealtime: vi.fn(),
}));

vi.mock('@markerit/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markerit/api-client')>();
  return { ...actual, ...api };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));

vi.mock('../../../../lib/realtime', () => ({
  createReviewRealtime: realtime.createReviewRealtime,
}));

const author: UserProfile = {
  id: 'user-1',
  email: 'anna@example.com',
  displayName: 'Anna Kowalska',
  initials: 'AK',
};

const reviewerUser: UserProfile = {
  id: 'user-2',
  email: 'jan@example.com',
  displayName: 'Jan Nowak',
  initials: 'JN',
};

const outsider: UserProfile = {
  id: 'user-3',
  email: 'ola@example.com',
  displayName: 'Ola Zielińska',
  initials: 'OZ',
};

const project: ProjectDto = {
  id: 'project-1',
  workspaceId: 'ws-1',
  name: 'Kampania wiosenna',
  description: null,
  status: 'ACTIVE',
  tone: 'sage',
  createdBy: author.id,
  createdByName: author.displayName,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-10T10:00:00Z',
  openComments: 0,
  members: [],
};

const asset: AssetDto = {
  id: 'asset-1',
  projectId: project.id,
  purpose: 'REVIEW_IMAGE',
  contentType: 'image/png',
  originalName: 'baner.png',
  sizeBytes: 1024,
  width: 1200,
  height: 800,
  url: 'assets/asset-1/content',
  createdAt: '2026-11-01T10:00:00Z',
};

const newAsset: AssetDto = { ...asset, id: 'asset-2', originalName: 'wersja-3.png' };

const members: WorkspaceMemberDto[] = [
  { id: author.id, displayName: author.displayName, email: author.email, initials: author.initials, role: 'OWNER' },
  { id: reviewerUser.id, displayName: reviewerUser.displayName, email: reviewerUser.email, initials: reviewerUser.initials, role: 'MEMBER' },
  { id: outsider.id, displayName: outsider.displayName, email: outsider.email, initials: outsider.initials, role: 'MEMBER' },
];

const versions = [
  {
    id: 'version-1',
    versionNumber: 1,
    note: 'Pierwsza wersja.',
    asset,
    createdAt: '2026-11-02T10:00:00Z',
    createdByName: author.displayName,
  },
  {
    id: 'version-2',
    versionNumber: 2,
    note: 'Poprawione marginesy.',
    asset,
    createdAt: '2026-11-09T10:00:00Z',
    createdByName: author.displayName,
  },
];

const emptyDiscussion: DiscussionDto = {
  reviewId: 'review-1',
  versionId: 'version-2',
  pins: [],
  comments: [],
  reviews: [],
};

function makeComment(overrides: Partial<CommentDto> = {}): CommentDto {
  return {
    id: 'comment-1',
    pinId: 'pin-1',
    parentCommentId: null,
    authorId: reviewerUser.id,
    authorName: reviewerUser.displayName,
    authorInitials: reviewerUser.initials,
    body: 'Proszę poprawić margines.',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
    editedAt: null,
    deleted: false,
    attachments: [],
    ...overrides,
  };
}

function makeDiscussion(overrides: Partial<DiscussionDto> = {}): DiscussionDto {
  return {
    reviewId: 'review-1',
    versionId: 'version-2',
    pins: [
      {
        id: 'pin-1',
        assetId: asset.id,
        xPercent: 25,
        yPercent: 40,
        status: 'OPEN',
        authorId: reviewerUser.id,
        authorName: reviewerUser.displayName,
        authorInitials: reviewerUser.initials,
        createdAt: '2026-11-10T10:00:00Z',
        resolvedBy: null,
        resolvedByName: null,
        resolvedAt: null,
        commentCount: 1,
      },
    ],
    comments: [makeComment()],
    reviews: [],
    ...overrides,
  };
}

function makeReview(
  overrides: {
    status?: 'OPEN' | 'CLOSED';
    decision?: 'APPROVED' | 'CHANGES_REQUESTED' | null;
    versionsOverride?: typeof versions;
    createdBy?: UserProfile;
  } = {},
): ReviewDto {
  const status = overrides.status ?? 'OPEN';
  const decision = overrides.decision ?? null;
  const owner = overrides.createdBy ?? author;
  return {
    summary: {
      id: 'review-1',
      projectId: project.id,
      title: 'Baner na stronę główną',
      description: 'Pierwsza propozycja układu.',
      status,
      createdBy: owner.id,
      createdByName: owner.displayName,
      createdAt: '2026-11-02T10:00:00Z',
      updatedAt: '2026-11-09T10:00:00Z',
      closedAt: status === 'CLOSED' ? '2026-11-10T10:00:00Z' : null,
      closedBy: status === 'CLOSED' ? author.id : null,
      closedByName: status === 'CLOSED' ? author.displayName : null,
      latestVersion: (overrides.versionsOverride ?? versions)[(overrides.versionsOverride ?? versions).length - 1],
      reviewerCount: 1,
      approvalSummary: {
        approved: decision === 'APPROVED' ? 1 : 0,
        changesRequested: decision === 'CHANGES_REQUESTED' ? 1 : 0,
        pending: decision === null ? 1 : 0,
        total: 1,
      },
    },
    reviewers: [
      {
        userId: reviewerUser.id,
        displayName: reviewerUser.displayName,
        initials: reviewerUser.initials,
        decision,
        decisionNote: decision ? 'Notatka recenzenta' : null,
        decidedAt: decision ? '2026-11-09T12:00:00Z' : null,
      },
    ],
    versions: overrides.versionsOverride ?? versions,
    approvals: [],
  };
}

function renderThread(
  user: UserProfile,
  review: ReviewDto = makeReview(),
  initialProject: ProjectDto = project,
  loadedDiscussion: DiscussionDto = emptyDiscussion,
) {
  api.getReviewDiscussion.mockResolvedValue(loadedDiscussion);
  return render(
    <ReviewThreadPage
      initialUser={user}
      projectId={project.id}
      reviewId={review.summary.id}
      initialReview={review}
      initialProject={initialProject}
      initialAssets={[asset]}
      initialMembers={members}
    />,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function lastRealtimeOptions() {
  const options = (
    realtime.createReviewRealtime.mock.calls as unknown as Array<
      [
        {
          onEvent: (event: unknown) => void;
          onStatus?: (status: string) => void;
          onError?: (error: Error) => void;
        },
      ]
    >
  ).at(-1)?.[0];
  if (!options) throw new Error('realtime client was not created');
  return options;
}

describe('ReviewThreadPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    api.getReviewDiscussion.mockResolvedValue(emptyDiscussion);
    realtime.createReviewRealtime.mockReturnValue({
      disconnect: realtime.disconnect,
      retry: realtime.retry,
    });
  });

  it('renders the thread header, reviewer decisions and version viewer', async () => {
    renderThread(author);

    expect(screen.getByRole('heading', { name: 'Baner na stronę główną' })).toBeInTheDocument();
    expect(screen.getByText(/Autor: Anna Kowalska/)).toBeInTheDocument();
    expect(screen.getByText('Jan Nowak')).toBeInTheDocument();
    expect(screen.getByText('Oczekuje')).toBeInTheDocument();
    expect(screen.getByText('Poprawione marginesy.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Wersja 2/ })).toHaveAttribute(
      'src',
      '/api/assets/asset-1/content',
    );
    expect(await screen.findByTestId('discussion-panel')).toBeInTheDocument();
    expect(api.getReviewDiscussion).toHaveBeenCalledWith('review-1', 'version-2');
    expect(screen.getByText('Kampania wiosenna').closest('a')).toHaveAttribute(
      'href',
      '/projects/project-1',
    );
  });

  it('switches the version selector to an older version', async () => {
    const testUser = userEvent.setup();
    renderThread(author);

    await testUser.click(screen.getByRole('button', { name: /Wersja 2/ }));
    await testUser.click(await screen.findByRole('menuitem', { name: /Wersja 1/ }));

    expect(await screen.findByText('Pierwsza wersja.')).toBeInTheDocument();
    expect(screen.getByText('Starsza wersja')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Zatwierdź/ })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(api.getReviewDiscussion).toHaveBeenCalledWith('review-1', 'version-1'),
    );
  });

  it('lets an assigned reviewer approve the latest version with a comment', async () => {
    api.submitReviewApproval.mockResolvedValue({});
    api.getReview.mockResolvedValue(makeReview({ decision: 'APPROVED' }));
    const testUser = userEvent.setup();
    renderThread(reviewerUser);

    await testUser.click(screen.getByRole('button', { name: /Zatwierdź/ }));
    expect(
      screen.getByRole('heading', { name: 'Zatwierdź najnowszą wersję' }),
    ).toBeInTheDocument();
    await testUser.type(screen.getByLabelText(/Komentarz/), 'Wszystko wygląda dobrze.');
    await testUser.click(screen.getByRole('button', { name: 'Wyślij decyzję' }));

    await waitFor(() => {
      expect(api.submitReviewApproval).toHaveBeenCalledWith('review-1', {
        decision: 'APPROVED',
        versionId: 'version-2',
        note: 'Wszystko wygląda dobrze.',
      });
    });
    expect(await screen.findByText('Decyzja została zapisana.')).toBeInTheDocument();
    expect(screen.getAllByText('Zatwierdzono').length).toBeGreaterThan(0);
  });

  it('lets a reviewer request changes', async () => {
    api.submitReviewApproval.mockResolvedValue({});
    api.getReview.mockResolvedValue(makeReview({ decision: 'CHANGES_REQUESTED' }));
    const testUser = userEvent.setup();
    renderThread(reviewerUser);

    await testUser.click(screen.getByRole('button', { name: /Poproś o poprawki/ }));
    expect(screen.getByRole('heading', { name: 'Poproś o poprawki' })).toBeInTheDocument();
    await testUser.click(screen.getByRole('button', { name: 'Wyślij decyzję' }));

    await waitFor(() => {
      expect(api.submitReviewApproval).toHaveBeenCalledWith('review-1', {
        decision: 'CHANGES_REQUESTED',
        versionId: 'version-2',
        note: undefined,
      });
    });
  });

  it('disables closing until every reviewer approved and shows the reason', () => {
    renderThread(author);

    const closeButton = screen.getByRole('button', { name: /Zamknij wątek/ });
    expect(closeButton).toBeDisabled();
    expect(screen.getByText(/Oczekujemy na zatwierdzenie:/)).toHaveTextContent('Jan Nowak');
  });

  it('closes the thread when every reviewer approved', async () => {
    api.closeReview.mockResolvedValue(makeReview({ status: 'CLOSED', decision: 'APPROVED' }));
    const testUser = userEvent.setup();
    renderThread(author, makeReview({ decision: 'APPROVED' }));

    const closeButton = screen.getByRole('button', { name: /Zamknij wątek/ });
    expect(closeButton).toBeEnabled();
    await testUser.click(closeButton);

    await waitFor(() => expect(api.closeReview).toHaveBeenCalledWith('review-1'));
    expect(
      await screen.findByText(/Ten wątek jest zamknięty/),
    ).toBeInTheDocument();
  });

  it('deletes the thread after confirmation and returns to the project', async () => {
    api.deleteReview.mockResolvedValue(undefined);
    const testUser = userEvent.setup();
    renderThread(author);

    await testUser.click(screen.getByRole('button', { name: /Usuń wątek/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Wątek, jego wersje i decyzje/)).toBeInTheDocument();
    await testUser.click(within(dialog).getByRole('button', { name: 'Usuń wątek' }));

    await waitFor(() => expect(api.deleteReview).toHaveBeenCalledWith('review-1'));
    expect(navigation.push).toHaveBeenCalledWith('/projects/project-1');
  });

  it('lets the author edit the title, description and reviewers', async () => {
    api.updateReview.mockResolvedValue(makeReview());
    const testUser = userEvent.setup();
    renderThread(author);

    await testUser.click(screen.getByRole('button', { name: /Edytuj wątek/ }));
    expect(screen.getByRole('heading', { name: 'Edytuj wątek' })).toBeInTheDocument();

    const title = screen.getByLabelText(/Tytuł wątku/);
    await testUser.clear(title);
    await testUser.type(title, 'Nowy tytuł wątku');
    await testUser.click(screen.getByRole('checkbox', { name: 'Jan Nowak' }));
    await testUser.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));

    await waitFor(() => {
      expect(api.updateReview).toHaveBeenCalledWith('review-1', {
        title: 'Nowy tytuł wątku',
        description: 'Pierwsza propozycja układu.',
        reviewerIds: [],
      });
    });
  });

  it('lets the author add a new version from a freshly uploaded photo', async () => {
    const newVersion = {
      id: 'version-3',
      versionNumber: 3,
      note: 'Trzecia wersja.',
      asset: newAsset,
      createdAt: '2026-11-11T10:00:00Z',
      createdByName: author.displayName,
    };
    const updated = makeReview({ versionsOverride: [...versions, newVersion] });
    api.uploadProjectAsset.mockResolvedValue(newAsset);
    api.createReviewVersion.mockResolvedValue(newVersion);
    api.getReview.mockResolvedValue(updated);
    const testUser = userEvent.setup();
    renderThread(author);

    await testUser.click(screen.getByRole('button', { name: /Dodaj wersję/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Dodaj nową wersję' })).toBeInTheDocument();

    const file = new File(['png'], 'wersja-3.png', { type: 'image/png' });
    await testUser.upload(within(dialog).getByLabelText('Wybierz plik'), file);
    await testUser.type(within(dialog).getByLabelText(/Notatka do wersji/), 'Trzecia wersja.');
    await testUser.click(within(dialog).getByRole('button', { name: /Dodaj wersję/ }));

    await waitFor(() => {
      expect(api.uploadProjectAsset).toHaveBeenCalledWith('project-1', file);
      expect(api.createReviewVersion).toHaveBeenCalledWith('review-1', {
        assetId: 'asset-2',
        note: 'Trzecia wersja.',
      });
    });
    expect(await screen.findByText('Trzecia wersja.')).toBeInTheDocument();
  });

  it('hides moderator and decision controls from uninvolved members', () => {
    renderThread(outsider);

    expect(screen.queryByRole('button', { name: /Edytuj wątek/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dodaj wersję/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Zamknij wątek/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usuń wątek/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Zatwierdź/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Poproś o poprawki/ })).not.toBeInTheDocument();
  });

  it('hides reviewer decisions on a closed thread', () => {
    renderThread(reviewerUser, makeReview({ status: 'CLOSED', decision: 'APPROVED' }));

    expect(screen.getByText(/Ten wątek jest zamknięty/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Zatwierdź/ })).not.toBeInTheDocument();
  });

  it('refetches the thread and reports a stale approval version', async () => {
    const newerVersion = {
      id: 'version-3',
      versionNumber: 3,
      note: 'Najnowsza wersja.',
      asset: newAsset,
      createdAt: '2026-11-11T10:00:00Z',
      createdByName: author.displayName,
    };
    api.submitReviewApproval.mockRejectedValue(
      new ApiError(409, 'REVIEW_VERSION_STALE', 'stale'),
    );
    api.getReview.mockResolvedValue(
      makeReview({ versionsOverride: [...versions, newerVersion] }),
    );
    const testUser = userEvent.setup();
    renderThread(reviewerUser);

    await testUser.click(screen.getByRole('button', { name: /Zatwierdź/ }));
    const dialog = screen.getByRole('dialog');
    await testUser.click(within(dialog).getByRole('button', { name: 'Wyślij decyzję' }));

    expect(
      await within(dialog).findByText(
        'Dodano nową wersję. Oceń najnowszą wersję i wyślij decyzję ponownie.',
      ),
    ).toBeInTheDocument();
    expect(api.getReview).toHaveBeenCalledWith('review-1');
  });

  it('adds a version from an existing project photo without uploading', async () => {
    const thirdVersion = {
      id: 'version-3',
      versionNumber: 3,
      note: 'Ta sama grafika.',
      asset,
      createdAt: '2026-11-11T10:00:00Z',
      createdByName: author.displayName,
    };
    api.createReviewVersion.mockResolvedValue(thirdVersion);
    api.getReview.mockResolvedValue(
      makeReview({ versionsOverride: [...versions, thirdVersion] }),
    );
    const testUser = userEvent.setup();
    renderThread(author);

    await testUser.click(screen.getByRole('button', { name: /Dodaj wersję/ }));
    const dialog = screen.getByRole('dialog');
    await testUser.click(within(dialog).getByRole('button', { name: 'baner.png' }));
    await testUser.type(within(dialog).getByLabelText(/Notatka do wersji/), 'Ta sama grafika.');
    await testUser.click(within(dialog).getByRole('button', { name: /Dodaj wersję/ }));

    await waitFor(() => {
      expect(api.uploadProjectAsset).not.toHaveBeenCalled();
      expect(api.createReviewVersion).toHaveBeenCalledWith('review-1', {
        assetId: 'asset-1',
        note: 'Ta sama grafika.',
      });
    });
  });

  it('removes a newly uploaded asset when adding the version fails', async () => {
    api.uploadProjectAsset.mockResolvedValue(newAsset);
    api.createReviewVersion.mockRejectedValue(
      new ApiError(409, 'PROJECT_CLOSED', 'closed'),
    );
    api.deleteProjectAsset.mockResolvedValue(undefined);
    const testUser = userEvent.setup();
    renderThread(author);

    await testUser.click(screen.getByRole('button', { name: /Dodaj wersję/ }));
    const dialog = screen.getByRole('dialog');
    await testUser.upload(
      within(dialog).getByLabelText('Wybierz plik'),
      new File(['png'], 'wersja-3.png', { type: 'image/png' }),
    );
    await testUser.click(within(dialog).getByRole('button', { name: /Dodaj wersję/ }));

    await waitFor(() => expect(api.deleteProjectAsset).toHaveBeenCalledWith('asset-2'));
    expect(
      await within(dialog).findByText(
        'Projekt jest zamknięty. Otwórz go ponownie przed wprowadzeniem zmian.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('1 / 8 zdjęć w projekcie')).toBeInTheDocument();
  });

  it('disables adding versions when the project is closed', () => {
    renderThread(author, makeReview(), { ...project, status: 'CLOSED' });

    expect(screen.getByRole('button', { name: /Dodaj wersję/ })).toBeDisabled();
    expect(screen.getByText(/Projekt jest zamknięty/)).toBeInTheDocument();
  });

  it('shows edit and delete errors inside their dialogs', async () => {
    api.updateReview.mockRejectedValue(new ApiError(403, 'REVIEW_FORBIDDEN', 'forbidden'));
    api.deleteReview.mockRejectedValue(new ApiError(403, 'REVIEW_FORBIDDEN', 'forbidden'));
    const testUser = userEvent.setup();
    renderThread(author);

    await testUser.click(screen.getByRole('button', { name: /Edytuj wątek/ }));
    let dialog = screen.getByRole('dialog');
    await testUser.click(within(dialog).getByRole('button', { name: 'Zapisz zmiany' }));
    expect(
      await within(dialog).findByText(
        'Twoja rola w przestrzeni nie pozwala na tę operację w recenzji.',
      ),
    ).toBeInTheDocument();
    await testUser.click(within(dialog).getByRole('button', { name: 'Anuluj' }));

    await testUser.click(screen.getByRole('button', { name: /Usuń wątek/ }));
    dialog = screen.getByRole('dialog');
    await testUser.click(within(dialog).getByRole('button', { name: 'Usuń wątek' }));
    expect(
      await within(dialog).findByText(
        'Twoja rola w przestrzeni nie pozwala na tę operację w recenzji.',
      ),
    ).toBeInTheDocument();
  });

  it('places a pin at image-relative percentage coordinates', async () => {
    const testUser = userEvent.setup();
    const createdPin = {
      id: 'pin-new',
      reviewVersionId: 'version-2',
      assetId: asset.id,
      xPercent: 25,
      yPercent: 25,
      status: 'OPEN' as const,
      authorId: author.id,
      authorName: author.displayName,
      authorInitials: author.initials,
      createdAt: '2026-11-11T12:00:00Z',
      resolvedBy: null,
      resolvedByName: null,
      resolvedAt: null,
      comments: [makeComment({ id: 'comment-new', pinId: 'pin-new', body: 'Nowy detal' })],
    };
    api.createVersionPin.mockResolvedValue(createdPin);
    renderThread(author, makeReview(), project, makeDiscussion());

    const canvas = await screen.findByTestId('review-canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 200,
      height: 100,
      right: 210,
      bottom: 120,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.click(canvas, { clientX: 60, clientY: 45 });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('25.0% / 25.0%')).toBeInTheDocument();
    await testUser.type(within(dialog).getByLabelText('Komentarz do pinezki'), 'Nowy detal');
    await testUser.click(within(dialog).getByRole('button', { name: 'Dodaj pinezkę' }));

    await waitFor(() =>
      expect(api.createVersionPin).toHaveBeenCalledWith('review-1', 'version-2', {
        xPercent: 25,
        yPercent: 25,
        body: 'Nowy detal',
        attachmentAssetIds: undefined,
      }),
    );
    expect(await screen.findByTestId('pin-marker-pin-new')).toBeInTheDocument();
    expect(screen.getByText('Nowy detal')).toBeInTheDocument();
  });

  it('uploads attachments before creating a pin', async () => {
    const testUser = userEvent.setup();
    const attachment = { ...asset, id: 'attachment-1', purpose: 'ATTACHMENT', originalName: 'detal.png' };
    const createdPin = {
      id: 'pin-new',
      reviewVersionId: 'version-2',
      assetId: asset.id,
      xPercent: 50,
      yPercent: 50,
      status: 'OPEN' as const,
      authorId: author.id,
      authorName: author.displayName,
      authorInitials: author.initials,
      createdAt: '2026-11-11T12:00:00Z',
      resolvedBy: null,
      resolvedByName: null,
      resolvedAt: null,
      comments: [],
    };
    api.uploadProjectAttachment.mockResolvedValue(attachment);
    api.createVersionPin.mockResolvedValue(createdPin);
    renderThread(author, makeReview(), project, makeDiscussion());

    const canvas = await screen.findByTestId('review-canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.click(canvas, { clientX: 50, clientY: 50 });

    const dialog = screen.getByRole('dialog');
    const file = new File(['png'], 'detal.png', { type: 'image/png' });
    await testUser.upload(within(dialog).getByLabelText('Załączniki'), file);
    await testUser.type(within(dialog).getByLabelText('Komentarz do pinezki'), 'Z załącznikiem');
    await testUser.click(within(dialog).getByRole('button', { name: 'Dodaj pinezkę' }));

    await waitFor(() => {
      expect(api.uploadProjectAttachment).toHaveBeenCalledWith('project-1', file);
      expect(api.createVersionPin).toHaveBeenCalledWith('review-1', 'version-2', {
        xPercent: 50,
        yPercent: 50,
        body: 'Z załącznikiem',
        attachmentAssetIds: ['attachment-1'],
      });
    });
  });

  it('highlights the matching pin when hovering a comment and vice versa', async () => {
    const testUser = userEvent.setup();
    renderThread(author, makeReview(), project, makeDiscussion());
    const marker = await screen.findByTestId('pin-marker-pin-1');
    const comment = screen.getByTestId('comment-comment-1');

    await testUser.hover(comment);
    expect(marker).toHaveAttribute('aria-pressed', 'true');
    expect(marker.className).toContain('ring-3');

    await testUser.unhover(comment);
    expect(marker).toHaveAttribute('aria-pressed', 'false');

    await testUser.hover(marker);
    expect(comment.className).toContain('border-primary/60');
  });

  it('keeps the clicked pin selected after the pointer leaves it', async () => {
    const testUser = userEvent.setup();
    renderThread(author, makeReview(), project, makeDiscussion());
    const marker = await screen.findByTestId('pin-marker-pin-1');

    await testUser.click(marker);
    expect(marker).toHaveAttribute('aria-pressed', 'true');

    await testUser.hover(marker);
    await testUser.unhover(marker);
    expect(marker).toHaveAttribute('aria-pressed', 'true');
  });

  it('scrolls between comments and pins when either side is clicked', async () => {
    const testUser = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    renderThread(author, makeReview(), project, makeDiscussion());
    const marker = await screen.findByTestId('pin-marker-pin-1');
    const comment = screen.getByTestId('comment-comment-1');

    await testUser.click(marker);
    expect(scrollIntoView).toHaveBeenCalled();

    scrollIntoView.mockClear();
    await testUser.click(screen.getByText('Proszę poprawić margines.'));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(comment).toBeInTheDocument();
  });

  it('applies realtime pin and comment events without a refresh', async () => {
    renderThread(author, makeReview(), project, makeDiscussion());
    await screen.findByTestId('discussion-feed');

    const options = (
      realtime.createReviewRealtime.mock.calls as unknown as Array<[
        { onEvent: (event: unknown) => void },
      ]>
    ).at(-1)?.[0];
    if (!options) throw new Error('realtime client was not created');
    const comment = makeComment({
      id: 'comment-realtime',
      body: 'Komentarz na żywo',
      createdAt: '2026-11-11T12:00:00Z',
      updatedAt: '2026-11-11T12:00:00Z',
    });
    act(() => {
      options.onEvent({
        type: 'COMMENT_CREATED',
        reviewId: 'review-1',
        versionId: 'version-2',
        pinId: 'pin-1',
        commentId: comment.id,
        payloadType: 'COMMENT',
        occurredAt: '2026-11-11T12:00:00Z',
        payload: comment,
      });
    });

    expect(screen.getByText('Komentarz na żywo')).toBeInTheDocument();
    expect(screen.getByTestId('pin-marker-pin-1')).toBeInTheDocument();
  });

  it('refetches the discussion for review-level realtime events', async () => {
    api.getReview.mockResolvedValue(makeReview());
    renderThread(author, makeReview(), project, makeDiscussion());
    await screen.findByTestId('discussion-feed');
    const callsBefore = api.getReviewDiscussion.mock.calls.length;

    const options = (
      realtime.createReviewRealtime.mock.calls as unknown as Array<[
        { onEvent: (event: unknown) => void },
      ]>
    ).at(-1)?.[0];
    if (!options) throw new Error('realtime client was not created');
    act(() => {
      options.onEvent({
        type: 'APPROVAL_CREATED',
        reviewId: 'review-1',
        versionId: 'version-2',
        payloadType: 'APPROVAL',
        occurredAt: '2026-11-11T12:00:00Z',
        payload: {},
      });
    });

    await waitFor(() =>
      expect(api.getReviewDiscussion.mock.calls.length).toBeGreaterThan(callsBefore),
    );
    expect(api.getReview).toHaveBeenCalledWith('review-1');
  });

  it('adds a reply with an attachment and renders it in the feed', async () => {
    const testUser = userEvent.setup();
    const attachment = { ...asset, id: 'attachment-2', purpose: 'ATTACHMENT', originalName: 'reply.png' };
    api.uploadProjectAttachment.mockResolvedValue(attachment);
    api.createPinComment.mockResolvedValue(
      makeComment({
        id: 'comment-reply',
        parentCommentId: 'comment-1',
        body: 'Odpowiedź z plikiem',
        attachments: [attachment],
      }),
    );
    renderThread(author, makeReview(), project, makeDiscussion());
    const card = await screen.findByTestId('comment-comment-1');

    await testUser.click(within(card).getByRole('button', { name: 'Odpowiedz' }));
    const form = screen.getByTestId('reply-form-comment-1');
    await testUser.type(within(form).getByLabelText('Odpowiedź'), 'Odpowiedź z plikiem');
    const file = new File(['png'], 'reply.png', { type: 'image/png' });
    await testUser.upload(within(form).getByLabelText('Załączniki'), file);
    await testUser.click(within(form).getByRole('button', { name: 'Wyślij odpowiedź' }));

    await waitFor(() => {
      expect(api.uploadProjectAttachment).toHaveBeenCalledWith('project-1', file);
      expect(api.createPinComment).toHaveBeenCalledWith('pin-1', {
        body: 'Odpowiedź z plikiem',
        parentCommentId: 'comment-1',
        attachmentAssetIds: ['attachment-2'],
      });
    });
    expect(await screen.findByText('Odpowiedź z plikiem')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'reply.png' })).toBeInTheDocument();
  });

  it('resolves and deletes pins through the discussion panel', async () => {
    const testUser = userEvent.setup();
    api.updatePin.mockResolvedValue({
      id: 'pin-1',
      reviewVersionId: 'version-2',
      assetId: asset.id,
      xPercent: 25,
      yPercent: 40,
      status: 'RESOLVED' as const,
      authorId: reviewerUser.id,
      authorName: reviewerUser.displayName,
      authorInitials: reviewerUser.initials,
      createdAt: '2026-11-10T10:00:00Z',
      resolvedBy: author.id,
      resolvedByName: author.displayName,
      resolvedAt: '2026-11-11T12:00:00Z',
      comments: [makeComment()],
    });
    api.deletePin.mockResolvedValue(undefined);
    renderThread(author, makeReview(), project, makeDiscussion());
    await screen.findByTestId('discussion-feed');

    await testUser.click(screen.getByRole('button', { name: 'Rozwiąż' }));
    await waitFor(() =>
      expect(api.updatePin).toHaveBeenCalledWith('pin-1', { status: 'RESOLVED' }),
    );
    expect(await screen.findByTestId('pin-marker-pin-1')).toHaveAttribute(
      'data-resolved',
      'true',
    );

    await testUser.click(
      within(screen.getByTestId('comment-comment-1')).getByRole('button', {
        name: 'Usuń pinezkę #1',
      }),
    );
    const dialog = screen.getByRole('dialog');
    await testUser.click(within(dialog).getByRole('button', { name: 'Usuń' }));
    await waitFor(() => expect(api.deletePin).toHaveBeenCalledWith('pin-1'));
    expect(screen.queryByTestId('pin-marker-pin-1')).not.toBeInTheDocument();
    expect(screen.queryByText('Proszę poprawić margines.')).not.toBeInTheDocument();
  });

  it('disables new pins and replies on a closed thread while showing existing comments', async () => {
    const testUser = userEvent.setup();
    renderThread(
      author,
      makeReview({ status: 'CLOSED', decision: 'APPROVED' }),
      project,
      makeDiscussion({
        comments: [
          makeComment({
            authorId: author.id,
            authorName: author.displayName,
            authorInitials: author.initials,
          }),
        ],
      }),
    );

    expect(await screen.findByTestId('discussion-closed')).toHaveTextContent(
      'Recenzja jest zamknięta',
    );
    expect(screen.getByText('Proszę poprawić margines.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Odpowiedz' })).toBeDisabled();

    const canvas = screen.getByTestId('review-canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.click(canvas, { clientX: 50, clientY: 50 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await testUser.click(
      screen.getByRole('button', { name: 'Edytuj komentarz: Anna Kowalska' }),
    );
    expect(screen.getByTestId('edit-form-comment-1')).toBeInTheDocument();
  });

  it('resyncs the thread and discussion after reconnect, online and visibility', async () => {
    api.getReview.mockResolvedValue(makeReview());
    renderThread(author, makeReview(), project, makeDiscussion());
    await screen.findByTestId('discussion-feed');
    const options = lastRealtimeOptions();

    act(() => {
      options.onStatus?.('disconnected');
      options.onStatus?.('connected');
    });
    await waitFor(() =>
      expect(api.getReviewDiscussion).toHaveBeenCalledWith('review-1', 'version-2'),
    );
    await waitFor(() => expect(api.getReview).toHaveBeenCalledWith('review-1'));

    api.getReviewDiscussion.mockClear();
    api.getReview.mockClear();
    fireEvent(window, new Event('online'));
    await waitFor(() => expect(api.getReviewDiscussion).toHaveBeenCalled());

    api.getReviewDiscussion.mockClear();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(api.getReviewDiscussion).toHaveBeenCalled());
  });

  it('discards a discussion fetch that resolves after a realtime event was folded', async () => {
    api.getReview.mockResolvedValue(makeReview());
    renderThread(author, makeReview(), project, makeDiscussion());
    await screen.findByTestId('discussion-feed');
    const options = lastRealtimeOptions();

    const pending = deferred<DiscussionDto>();
    api.getReviewDiscussion.mockReturnValueOnce(pending.promise);
    act(() =>
      options.onEvent({
        type: 'APPROVAL_CREATED',
        reviewId: 'review-1',
        versionId: 'version-2',
        payloadType: 'APPROVAL',
        occurredAt: '2026-11-11T12:00:00Z',
        payload: {},
      }),
    );
    await waitFor(() => expect(api.getReviewDiscussion).toHaveBeenCalledTimes(2));

    const liveComment = makeComment({
      id: 'comment-race',
      body: 'Wpis na żywo',
      createdAt: '2026-11-11T13:00:00Z',
      updatedAt: '2026-11-11T13:00:00Z',
    });
    act(() =>
      options.onEvent({
        type: 'COMMENT_CREATED',
        reviewId: 'review-1',
        versionId: 'version-2',
        pinId: 'pin-1',
        commentId: liveComment.id,
        payloadType: 'COMMENT',
        occurredAt: '2026-11-11T13:00:00Z',
        payload: liveComment,
      }),
    );
    expect(screen.getByText('Wpis na żywo')).toBeInTheDocument();

    await act(async () => {
      pending.resolve(emptyDiscussion);
      await pending.promise;
    });

    expect(screen.getByText('Wpis na żywo')).toBeInTheDocument();
  });

  it('does not let a stale discussion fetch overwrite a mutation response', async () => {
    const testUser = userEvent.setup();
    api.getReview.mockResolvedValue(makeReview());
    api.updatePin.mockResolvedValue({
      id: 'pin-1',
      reviewVersionId: 'version-2',
      assetId: asset.id,
      xPercent: 25,
      yPercent: 40,
      status: 'RESOLVED' as const,
      authorId: reviewerUser.id,
      authorName: reviewerUser.displayName,
      authorInitials: reviewerUser.initials,
      createdAt: '2026-11-10T10:00:00Z',
      resolvedBy: author.id,
      resolvedByName: author.displayName,
      resolvedAt: '2026-11-11T12:00:00Z',
      comments: [makeComment()],
    });
    renderThread(author, makeReview(), project, makeDiscussion());
    await screen.findByTestId('discussion-feed');
    const options = lastRealtimeOptions();

    const pending = deferred<DiscussionDto>();
    api.getReviewDiscussion.mockReturnValueOnce(pending.promise);
    act(() =>
      options.onEvent({
        type: 'APPROVAL_CREATED',
        reviewId: 'review-1',
        versionId: 'version-2',
        payloadType: 'APPROVAL',
        occurredAt: '2026-11-11T12:00:00Z',
        payload: {},
      }),
    );
    await waitFor(() => expect(api.getReviewDiscussion).toHaveBeenCalledTimes(2));

    await testUser.click(screen.getByRole('button', { name: 'Rozwiąż' }));
    await waitFor(() =>
      expect(screen.getByTestId('pin-marker-pin-1')).toHaveAttribute(
        'data-resolved',
        'true',
      ),
    );

    await act(async () => {
      pending.resolve(makeDiscussion());
      await pending.promise;
    });

    expect(screen.getByTestId('pin-marker-pin-1')).toHaveAttribute(
      'data-resolved',
      'true',
    );
  });

  it('ignores an older pin update so RESOLVED cannot flip back to OPEN', async () => {
    renderThread(author, makeReview(), project, makeDiscussion());
    await screen.findByTestId('discussion-feed');
    const options = lastRealtimeOptions();

    const resolved = {
      id: 'pin-1',
      reviewVersionId: 'version-2',
      assetId: asset.id,
      xPercent: 25,
      yPercent: 40,
      status: 'RESOLVED' as const,
      authorId: reviewerUser.id,
      authorName: reviewerUser.displayName,
      authorInitials: reviewerUser.initials,
      createdAt: '2026-11-10T10:00:00Z',
      resolvedBy: author.id,
      resolvedByName: author.displayName,
      resolvedAt: '2026-11-11T13:00:00Z',
      comments: [makeComment()],
    };
    act(() =>
      options.onEvent({
        type: 'PIN_UPDATED',
        reviewId: 'review-1',
        versionId: 'version-2',
        pinId: 'pin-1',
        payloadType: 'PIN',
        occurredAt: '2026-11-11T13:00:00Z',
        payload: resolved,
      }),
    );
    expect(screen.getByTestId('pin-marker-pin-1')).toHaveAttribute(
      'data-resolved',
      'true',
    );

    act(() =>
      options.onEvent({
        type: 'PIN_UPDATED',
        reviewId: 'review-1',
        versionId: 'version-2',
        pinId: 'pin-1',
        payloadType: 'PIN',
        occurredAt: '2026-11-11T12:00:00Z',
        payload: { ...resolved, status: 'OPEN', resolvedAt: null, resolvedBy: null },
      }),
    );
    expect(screen.getByTestId('pin-marker-pin-1')).toHaveAttribute(
      'data-resolved',
      'true',
    );
  });

  it('retries realtime and resyncs from the unavailable badge', async () => {
    const testUser = userEvent.setup();
    api.getReview.mockResolvedValue(makeReview());
    renderThread(author, makeReview(), project, makeDiscussion());
    await screen.findByTestId('discussion-feed');
    const options = lastRealtimeOptions();

    act(() => options.onStatus?.('unavailable'));
    await testUser.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(realtime.retry).toHaveBeenCalled();
    await waitFor(() => expect(api.getReviewDiscussion).toHaveBeenCalledWith('review-1', 'version-2'));
    await waitFor(() => expect(api.getReview).toHaveBeenCalledWith('review-1'));
  });

  it('leaves the thread and stops realtime when the review is deleted', async () => {
    renderThread(author, makeReview(), project, makeDiscussion());
    await screen.findByTestId('discussion-feed');
    const options = lastRealtimeOptions();

    act(() =>
      options.onEvent({
        type: 'REVIEW_DELETED',
        reviewId: 'review-1',
        versionId: 'version-2',
        occurredAt: '2026-11-11T12:00:00Z',
      }),
    );

    expect(navigation.replace).toHaveBeenCalledWith('/projects/project-1');
    expect(realtime.disconnect).toHaveBeenCalled();
  });

  it('leaves the thread when a refresh reports REVIEW_NOT_FOUND', async () => {
    api.getReview.mockRejectedValue(new ApiError(404, 'REVIEW_NOT_FOUND', 'gone'));
    renderThread(author, makeReview(), project, makeDiscussion());
    await screen.findByTestId('discussion-feed');
    const options = lastRealtimeOptions();

    act(() =>
      options.onEvent({
        type: 'APPROVAL_CREATED',
        reviewId: 'review-1',
        versionId: 'version-2',
        payloadType: 'APPROVAL',
        occurredAt: '2026-11-11T12:00:00Z',
        payload: {},
      }),
    );

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('/projects/project-1'),
    );
    expect(realtime.disconnect).toHaveBeenCalled();
  });

  it('coalesces the echoed approval event after the author already refreshed', async () => {
    const testUser = userEvent.setup();
    api.submitReviewApproval.mockResolvedValue({});
    api.getReview.mockResolvedValue(makeReview({ decision: 'APPROVED' }));
    renderThread(reviewerUser);
    await screen.findByTestId('discussion-panel');

    await testUser.click(screen.getByRole('button', { name: /Zatwierdź/ }));
    await testUser.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Wyślij decyzję' }),
    );
    await screen.findByText('Decyzja została zapisana.');
    const callsAfterApproval = api.getReviewDiscussion.mock.calls.length;

    const options = lastRealtimeOptions();
    await act(async () => {
      options.onEvent({
        type: 'APPROVAL_CREATED',
        reviewId: 'review-1',
        versionId: 'version-2',
        payloadType: 'APPROVAL',
        occurredAt: '2026-11-11T12:00:00Z',
        payload: {},
      });
    });

    expect(api.getReviewDiscussion).toHaveBeenCalledTimes(callsAfterApproval);
  });

  it('hides thread mutations and approval actions from VIEWER authors and reviewers', () => {
    api.getReviewDiscussion.mockResolvedValue(emptyDiscussion);
    const viewerMembers: WorkspaceMemberDto[] = members.map((member) =>
      member.id === reviewerUser.id ? { ...member, role: 'VIEWER' } : member,
    );
    render(
      <ReviewThreadPage
        initialUser={reviewerUser}
        projectId={project.id}
        reviewId="review-1"
        initialReview={makeReview({ createdBy: reviewerUser })}
        initialProject={project}
        initialAssets={[asset]}
        initialMembers={viewerMembers}
      />,
    );

    expect(screen.queryByRole('button', { name: /Edytuj wątek/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dodaj wersję/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Zamknij wątek/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Usuń wątek/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Zatwierdź/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Poproś o poprawki/ })).not.toBeInTheDocument();
  });
});
