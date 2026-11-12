import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AssetDto,
  WorkspaceDto,
  WorkspaceFeedbackDto,
} from '@markerit/api-client';
import type { UserProfile } from '../components/types';
import { FeedbackPage } from './feedback-page';

const api = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  listWorkspaceFeedback: vi.fn(),
  updatePin: vi.fn(),
}));

vi.mock('@markerit/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@markerit/api-client')>();
  return { ...actual, ...api };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const user: UserProfile = {
  id: 'user-1',
  email: 'anna@example.com',
  displayName: 'Anna Kowalska',
  initials: 'AK',
};

const workspace: WorkspaceDto = {
  id: 'ws-1',
  name: 'Studio Północ',
  description: null,
  role: 'OWNER',
  projectCount: 2,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-10T10:00:00Z',
};

const asset: AssetDto = {
  id: 'asset-1',
  projectId: 'project-1',
  purpose: 'REVIEW_IMAGE',
  contentType: 'image/png',
  originalName: 'baner.png',
  sizeBytes: 2048,
  width: 1200,
  height: 800,
  url: 'assets/asset-1/content',
  createdAt: '2026-11-01T10:00:00Z',
};

const openFeedback: WorkspaceFeedbackDto = {
  id: 'pin-1',
  projectId: 'project-1',
  projectName: 'Kampania wiosenna',
  projectTone: 'sage',
  reviewId: 'review-1',
  reviewTitle: 'Baner na stronę główną',
  reviewStatus: 'OPEN',
  versionId: 'version-2',
  versionNumber: 2,
  asset,
  xPercent: 42,
  yPercent: 18,
  status: 'OPEN',
  authorId: user.id,
  authorName: user.displayName,
  authorInitials: user.initials,
  createdAt: '2026-11-09T10:00:00Z',
  resolvedBy: null,
  resolvedByName: null,
  resolvedAt: null,
  commentCount: 2,
  lastCommentBody: 'Skróć margines przy logo.',
  lastCommentAuthorName: 'Jan Nowak',
  lastCommentAuthorInitials: 'JN',
  lastCommentAt: '2026-11-10T12:00:00Z',
};

const resolvedFeedback: WorkspaceFeedbackDto = {
  id: 'pin-2',
  projectId: 'project-2',
  projectName: 'Opakowanie produktu',
  projectTone: 'blue',
  reviewId: 'review-2',
  reviewTitle: 'Etykieta butelki',
  reviewStatus: 'CLOSED',
  versionId: 'version-5',
  versionNumber: 5,
  asset: { ...asset, id: 'asset-2', projectId: 'project-2' },
  xPercent: 70,
  yPercent: 64,
  status: 'RESOLVED',
  authorId: 'user-2',
  authorName: 'Jan Nowak',
  authorInitials: 'JN',
  createdAt: '2026-11-08T09:00:00Z',
  resolvedBy: user.id,
  resolvedByName: user.displayName,
  resolvedAt: '2026-11-10T09:00:00Z',
  commentCount: 1,
  lastCommentBody: 'Poprawione.',
  lastCommentAuthorName: user.displayName,
  lastCommentAuthorInitials: user.initials,
  lastCommentAt: '2026-11-10T08:30:00Z',
};

function renderPage() {
  return render(
    <FeedbackPage
      initialUser={user}
      initialWorkspaces={[workspace]}
      initialWorkspaceId={workspace.id}
      initialFeedback={[openFeedback, resolvedFeedback]}
    />,
  );
}

describe('FeedbackPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows open feedback across projects and highlights the sidebar entry', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Uwagi z wszystkich projektów' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/UWAGI W PRZESTRZENI/)).toBeInTheDocument();
    expect(screen.getByText('Baner na stronę główną')).toBeInTheDocument();
    expect(screen.getByText('Skróć margines przy logo.')).toBeInTheDocument();
    expect(screen.queryByText('Etykieta butelki')).not.toBeInTheDocument();

    const feedbackLinks = screen.getAllByRole('link', { name: /Uwagi/ });
    expect(feedbackLinks.length).toBeGreaterThan(0);
    expect(feedbackLinks[0]).toHaveAttribute('aria-current', 'page');
    expect(feedbackLinks[0]).toHaveAttribute('href', '/feedback');

    const threadLink = screen.getByRole('link', { name: 'Baner na stronę główną' });
    expect(threadLink).toHaveAttribute('href', '/projects/project-1/reviews/review-1');
  });

  it('filters resolved notes and searches across projects', async () => {
    const browser = userEvent.setup();
    renderPage();

    await browser.click(screen.getByRole('tab', { name: /Rozwiązane/ }));

    expect(screen.getByText('Etykieta butelki')).toBeInTheDocument();
    expect(screen.queryByText('Baner na stronę główną')).not.toBeInTheDocument();
    expect(screen.getByText('Wątek zamknięty')).toBeInTheDocument();

    await browser.click(screen.getByRole('tab', { name: /Wszystkie/ }));
    await browser.type(screen.getByRole('textbox', { name: 'Szukaj w uwagach…' }), 'logo');

    expect(screen.getByText('Baner na stronę główną')).toBeInTheDocument();
    expect(screen.queryByText('Etykieta butelki')).not.toBeInTheDocument();
  });

  it('resolves an open note through the API and moves it out of the open tab', async () => {
    const browser = userEvent.setup();
    api.updatePin.mockResolvedValue({
      id: openFeedback.id,
      status: 'RESOLVED',
      resolvedBy: user.id,
      resolvedByName: user.displayName,
      resolvedAt: '2026-11-11T10:00:00Z',
    });

    renderPage();

    await browser.click(screen.getByRole('button', { name: 'Rozwiąż' }));

    await waitFor(() => {
      expect(api.updatePin).toHaveBeenCalledWith('pin-1', { status: 'RESOLVED' });
    });
    expect(await screen.findByText('Uwaga została oznaczona jako rozwiązana.')).toBeInTheDocument();
    expect(screen.queryByText('Baner na stronę główną')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Rozwiązane \(2\)/ })).toBeInTheDocument();
  });

  it('loads workspaces and feedback from the API when no fixtures are provided', async () => {
    window.localStorage.setItem('markerit_active_workspace_id_anna@example.com', workspace.id);
    api.listWorkspaces.mockResolvedValue([workspace]);
    api.listWorkspaceFeedback.mockResolvedValue([openFeedback]);

    render(<FeedbackPage initialUser={user} />);

    expect(await screen.findByText('Baner na stronę główną')).toBeInTheDocument();
    await waitFor(() => {
      expect(api.listWorkspaces).toHaveBeenCalled();
      expect(api.listWorkspaceFeedback).toHaveBeenCalledWith(workspace.id);
    });
  });

  it('renders an empty state when the workspace has no feedback', () => {
    render(
      <FeedbackPage
        initialUser={user}
        initialWorkspaces={[workspace]}
        initialWorkspaceId={workspace.id}
        initialFeedback={[]}
      />,
    );

    expect(screen.getByText('Brak uwag w tej przestrzeni')).toBeInTheDocument();
    expect(
      screen.getByText(/Pinezki dodane do zdjęć projektów pojawią się tutaj/),
    ).toBeInTheDocument();
  });
});
