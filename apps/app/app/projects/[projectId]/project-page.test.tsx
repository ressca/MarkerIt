import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@markerit/api-client';
import type {
  AssetDto,
  ProjectDto,
  ReviewDto,
  ReviewSummaryDto,
  WorkspaceMemberDto,
} from '@markerit/api-client';
import type { UserProfile } from '../../components/types';
import { ProjectPage } from './project-page';

const api = vi.hoisted(() => ({
  getProject: vi.fn(),
  listWorkspaceMembers: vi.fn(),
  listProjectAssets: vi.fn(),
  listProjectReviews: vi.fn(),
  getReview: vi.fn(),
  createReview: vi.fn(),
  uploadProjectAsset: vi.fn(),
  deleteProjectAsset: vi.fn(),
}));

vi.mock('@markerit/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markerit/api-client')>();
  return { ...actual, ...api };
});

const user: UserProfile = {
  id: 'user-1',
  email: 'anna@example.com',
  displayName: 'Anna Kowalska',
  initials: 'AK',
};

const project: ProjectDto = {
  id: 'project-1',
  workspaceId: 'ws-1',
  name: 'Kampania wiosenna',
  description: 'Bannery i materiały social media.',
  status: 'ACTIVE',
  tone: 'sage',
  createdBy: user.id,
  createdByName: user.displayName,
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

const secondAsset: AssetDto = {
  ...asset,
  id: 'asset-2',
  originalName: 'nowy.png',
};

const member: WorkspaceMemberDto = {
  id: 'user-2',
  displayName: 'Jan Nowak',
  email: 'jan@example.com',
  initials: 'JN',
  role: 'MEMBER',
};

const reviewSummary: ReviewSummaryDto = {
  id: 'review-1',
  projectId: project.id,
  title: 'Baner na stronę główną',
  description: 'Pierwsza propozycja układu.',
  status: 'OPEN',
  createdBy: user.id,
  createdByName: user.displayName,
  createdAt: '2026-11-02T10:00:00Z',
  updatedAt: '2026-11-09T10:00:00Z',
  latestVersion: {
    id: 'version-2',
    versionNumber: 2,
    note: 'Poprawione marginesy.',
    asset,
    createdAt: '2026-11-09T10:00:00Z',
    createdByName: user.displayName,
  },
  reviewers: [
    { userId: member.id, displayName: member.displayName, initials: member.initials, decision: null },
  ],
  reviewerCount: 1,
  approvalSummary: { approved: 0, changesRequested: 0, pending: 1, total: 1 },
};

const reviewDetail: ReviewDto = {
  summary: reviewSummary,
  reviewers: [
    { userId: member.id, displayName: member.displayName, initials: member.initials, decision: null },
  ],
  versions: [
    {
      id: 'version-1',
      versionNumber: 1,
      note: 'Pierwsza wersja.',
      asset,
      createdAt: '2026-11-02T10:00:00Z',
      createdByName: user.displayName,
    },
    {
      id: 'version-2',
      versionNumber: 2,
      note: 'Poprawione marginesy.',
      asset,
      createdAt: '2026-11-09T10:00:00Z',
      createdByName: user.displayName,
    },
  ],
  approvals: [],
};

function renderPage(overrides: {
  assets?: AssetDto[];
  reviews?: ReviewSummaryDto[];
  members?: WorkspaceMemberDto[];
  project?: ProjectDto;
} = {}) {
  const assets = overrides.assets ?? [asset];
  const reviews = overrides.reviews ?? [reviewSummary];
  return render(
    <ProjectPage
      initialUser={user}
      projectId={project.id}
      initialProject={overrides.project ?? project}
      initialAssets={assets}
      initialReviews={reviews}
      initialMembers={overrides.members ?? [member]}
    />,
  );
}

describe('ProjectPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the project header, photo limit and review thread cards', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Kampania wiosenna' })).toBeInTheDocument();
    expect(screen.getByText('Bannery i materiały social media.')).toBeInTheDocument();
    expect(screen.getByText('W toku')).toBeInTheDocument();
    expect(screen.getByText('Szałwia')).toBeInTheDocument();
    expect(screen.getByText('1 / 8 zdjęć w projekcie')).toBeInTheDocument();
    expect(screen.getByText('Baner na stronę główną')).toBeInTheDocument();
    expect(screen.getByText('Wersja 2')).toBeInTheDocument();
    expect(screen.getByText('Oczekuje: 1')).toBeInTheDocument();

    const backLink = screen.getByText('Wróć do projektów').closest('a');
    expect(backLink).toHaveAttribute('href', '/');
    const titleLinks = screen.getAllByRole('link', { name: 'Baner na stronę główną' });
    expect(titleLinks).toHaveLength(1);
    expect(titleLinks[0]).toHaveAttribute(
      'href',
      '/projects/project-1/reviews/review-1',
    );
    expect(screen.getByRole('img', { name: 'Jan Nowak: Oczekuje' })).toBeInTheDocument();
  });

  it('loads project data from the API when no fixtures are provided', async () => {
    api.getProject.mockResolvedValue(project);
    api.listWorkspaceMembers.mockResolvedValue([member]);
    api.listProjectAssets.mockResolvedValue([asset]);
    api.listProjectReviews.mockResolvedValue([reviewSummary]);
    api.getReview.mockResolvedValue(reviewDetail);

    render(<ProjectPage initialUser={user} projectId={project.id} />);

    expect(await screen.findByRole('heading', { name: 'Kampania wiosenna' })).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getProject).toHaveBeenCalledWith('project-1');
      expect(api.listWorkspaceMembers).toHaveBeenCalledWith('ws-1');
      expect(api.listProjectAssets).toHaveBeenCalledWith('project-1');
      expect(api.listProjectReviews).toHaveBeenCalledWith('project-1');
    });
    expect(api.getReview).not.toHaveBeenCalled();
  });

  it('loads data once when the stored locale hydrates to English', async () => {
    window.localStorage.setItem('markerit-locale', 'en');
    api.getProject.mockResolvedValue(project);
    api.listWorkspaceMembers.mockResolvedValue([member]);
    api.listProjectAssets.mockResolvedValue([asset]);
    api.listProjectReviews.mockResolvedValue([reviewSummary]);

    render(<ProjectPage initialUser={user} projectId={project.id} />);

    expect(await screen.findByRole('heading', { name: 'Kampania wiosenna' })).toBeInTheDocument();
    await waitFor(() => expect(api.getProject).toHaveBeenCalledTimes(1));
    expect(api.listProjectReviews).toHaveBeenCalledTimes(1);
  });

  it('shows an error alert and retries the initial load', async () => {
    api.getProject.mockRejectedValueOnce(new Error('offline'));
    api.getProject.mockResolvedValueOnce(project);
    api.listWorkspaceMembers.mockResolvedValue([member]);
    api.listProjectAssets.mockResolvedValue([asset]);
    api.listProjectReviews.mockResolvedValue([]);

    render(<ProjectPage initialUser={user} projectId={project.id} />);

    expect(await screen.findByRole('heading', { name: 'Nie udało się wczytać projektu.' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /Spróbuj ponownie/ }));

    expect(await screen.findByRole('heading', { name: 'Kampania wiosenna' })).toBeInTheDocument();
  });

  it('uploads a photo and updates the project limit', async () => {
    api.uploadProjectAsset.mockResolvedValue(secondAsset);
    const testUser = userEvent.setup();
    renderPage();

    await testUser.click(screen.getByRole('button', { name: /Dodaj zdjęcie/ }));
    expect(screen.getByRole('heading', { name: 'Dodaj zdjęcie do recenzji' })).toBeInTheDocument();

    const file = new File(['png'], 'nowy.png', { type: 'image/png' });
    await testUser.upload(screen.getByLabelText('Wybierz plik'), file);
    await testUser.click(screen.getByRole('button', { name: 'Wyślij' }));

    await waitFor(() => {
      expect(api.uploadProjectAsset).toHaveBeenCalledWith('project-1', file);
      expect(screen.getByText('2 / 8 zdjęć w projekcie')).toBeInTheDocument();
    });
    expect(screen.getByText('Zdjęcie zostało dodane.')).toBeInTheDocument();
  });

  it('rejects unsupported and oversized files before calling the API', async () => {
    const testUser = userEvent.setup();
    renderPage();

    await testUser.click(screen.getByRole('button', { name: /Dodaj zdjęcie/ }));
    const input = screen.getByLabelText('Wybierz plik');

    // Bypass the file input's `accept` filter to exercise the dialog guard too.
    fireEvent.change(input, {
      target: { files: [new File(['txt'], 'notes.txt', { type: 'text/plain' })] },
    });
    await testUser.click(screen.getByRole('button', { name: 'Wyślij' }));
    expect(screen.getByText('Dozwolone są tylko pliki PNG i JPEG.')).toBeInTheDocument();

    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [big] } });
    await testUser.click(screen.getByRole('button', { name: 'Wyślij' }));
    expect(screen.getByText('Plik może mieć maksymalnie 10 MB.')).toBeInTheDocument();
    expect(api.uploadProjectAsset).not.toHaveBeenCalled();
  });

  it('creates a review thread with a mandatory photo and selected reviewers', async () => {
    api.createReview.mockResolvedValue({
      ...reviewDetail,
      summary: { ...reviewSummary, id: 'review-2', title: 'Nowy wątek' },
    });
    const testUser = userEvent.setup();
    renderPage({ reviews: [] });

    await testUser.click(screen.getAllByRole('button', { name: /Nowy wątek/ })[0]);
    expect(screen.getByRole('heading', { name: 'Nowy wątek recenzji' })).toBeInTheDocument();

    await testUser.click(screen.getByRole('button', { name: 'baner.png' }));
    await testUser.type(screen.getByLabelText(/Tytuł wątku/), 'Nowy wątek');
    await testUser.type(screen.getByLabelText(/Opis/), 'Opis dla recenzentów');
    await testUser.click(screen.getByRole('checkbox', { name: 'Jan Nowak' }));
    await testUser.click(screen.getByRole('button', { name: 'Utwórz wątek' }));

    await waitFor(() => {
      expect(api.createReview).toHaveBeenCalledWith('project-1', {
        title: 'Nowy wątek',
        description: 'Opis dla recenzentów',
        assetId: 'asset-1',
        reviewerIds: ['user-2'],
      });
    });
    expect((await screen.findAllByText('Nowy wątek')).length).toBeGreaterThan(0);
  });

  it('validates the create-thread form', async () => {
    const testUser = userEvent.setup();
    renderPage();

    await testUser.click(screen.getByRole('button', { name: /Nowy wątek/ }));
    await testUser.click(screen.getByRole('button', { name: 'Utwórz wątek' }));
    expect(screen.getByText('Podaj tytuł wątku.')).toBeInTheDocument();

    await testUser.type(screen.getByLabelText(/Tytuł wątku/), 'Wątek');
    await testUser.click(screen.getByRole('button', { name: 'Utwórz wątek' }));
    expect(screen.getByText('Wybierz zdjęcie dla tego wątku.')).toBeInTheDocument();
    expect(api.createReview).not.toHaveBeenCalled();
  });

  it('deletes an unreferenced photo after confirmation', async () => {
    api.deleteProjectAsset.mockResolvedValue(undefined);
    const testUser = userEvent.setup();
    renderPage({ assets: [asset, secondAsset], reviews: [] });

    await testUser.click(
      screen.getByRole('button', { name: 'Usuń zdjęcie: baner.png' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('baner.png')).toBeInTheDocument();
    await testUser.click(within(dialog).getByRole('button', { name: 'Usuń' }));

    await waitFor(() => {
      expect(api.deleteProjectAsset).toHaveBeenCalledWith('asset-1');
      expect(screen.queryByText('baner.png')).not.toBeInTheDocument();
    });
  });

  it('does not offer deletion for photos used by a version', () => {
    renderPage({ assets: [asset, secondAsset] });

    expect(
      screen.queryByRole('button', { name: 'Usuń zdjęcie: baner.png' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuń zdjęcie: nowy.png' })).toBeInTheDocument();
  });

  it('shows the empty states and disables thread creation without photos', () => {
    renderPage({ assets: [], reviews: [] });

    expect(screen.getByText('Brak zdjęć')).toBeInTheDocument();
    expect(screen.getByText('Brak wątków recenzji')).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /Nowy wątek/ })) {
      expect(button).toBeDisabled();
    }
  });

  it('disables new threads and photo uploads for a closed project', () => {
    renderPage({ project: { ...project, status: 'CLOSED' } });

    expect(screen.getByText(/Projekt jest zamknięty/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nowy wątek/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Dodaj zdjęcie/ })).toBeDisabled();
  });

  it('shows asset limit errors inside the upload dialog', async () => {
    api.uploadProjectAsset.mockRejectedValue(
      new ApiError(429, 'ASSET_LIMIT_REACHED', 'limit'),
    );
    const testUser = userEvent.setup();
    renderPage();

    await testUser.click(screen.getByRole('button', { name: /Dodaj zdjęcie/ }));
    const dialog = screen.getByRole('dialog');
    await testUser.upload(
      within(dialog).getByLabelText('Wybierz plik'),
      new File(['png'], 'nowy.png', { type: 'image/png' }),
    );
    await testUser.click(within(dialog).getByRole('button', { name: 'Wyślij' }));

    expect(
      await within(dialog).findByText('Projekt osiągnął limit zdjęć. Usuń nieużywane zdjęcie.'),
    ).toBeInTheDocument();
  });

  it('shows project-closed errors inside the create-thread dialog', async () => {
    api.createReview.mockRejectedValue(new ApiError(409, 'PROJECT_CLOSED', 'closed'));
    const testUser = userEvent.setup();
    renderPage({ reviews: [] });

    await testUser.click(screen.getAllByRole('button', { name: /Nowy wątek/ })[0]);
    const dialog = screen.getByRole('dialog');
    await testUser.click(within(dialog).getByRole('button', { name: 'baner.png' }));
    await testUser.type(within(dialog).getByLabelText(/Tytuł wątku/), 'Nowy wątek');
    await testUser.click(within(dialog).getByRole('button', { name: 'Utwórz wątek' }));

    expect(
      await within(dialog).findByText(
        'Projekt jest zamknięty. Otwórz go ponownie przed wprowadzeniem zmian.',
      ),
    ).toBeInTheDocument();
  });

  it('shows asset-in-use errors inside the delete-photo dialog', async () => {
    api.deleteProjectAsset.mockRejectedValue(new ApiError(409, 'ASSET_IN_USE', 'used'));
    const testUser = userEvent.setup();
    renderPage({ assets: [asset, secondAsset], reviews: [] });

    await testUser.click(screen.getByRole('button', { name: 'Usuń zdjęcie: baner.png' }));
    const dialog = screen.getByRole('dialog');
    await testUser.click(within(dialog).getByRole('button', { name: 'Usuń' }));

    expect(
      await within(dialog).findByText(
        'To zdjęcie jest używane w recenzji i nie można go usunąć.',
      ),
    ).toBeInTheDocument();
  });
});
