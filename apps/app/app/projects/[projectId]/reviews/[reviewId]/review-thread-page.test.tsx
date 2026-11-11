import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@markerit/api-client';
import type {
  AssetDto,
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
  deleteProjectAsset: vi.fn(),
  createReviewVersion: vi.fn(),
  submitReviewApproval: vi.fn(),
  closeReview: vi.fn(),
  updateReview: vi.fn(),
  deleteReview: vi.fn(),
}));
const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@markerit/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markerit/api-client')>();
  return { ...actual, ...api };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
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

function makeReview(
  overrides: {
    status?: 'OPEN' | 'CLOSED';
    decision?: 'APPROVED' | 'CHANGES_REQUESTED' | null;
    versionsOverride?: typeof versions;
  } = {},
): ReviewDto {
  const status = overrides.status ?? 'OPEN';
  const decision = overrides.decision ?? null;
  return {
    summary: {
      id: 'review-1',
      projectId: project.id,
      title: 'Baner na stronę główną',
      description: 'Pierwsza propozycja układu.',
      status,
      createdBy: author.id,
      createdByName: author.displayName,
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
) {
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

describe('ReviewThreadPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the thread header, reviewer decisions and version viewer', () => {
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
    expect(screen.getByTestId('discussion-placeholder')).toBeInTheDocument();
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
});
