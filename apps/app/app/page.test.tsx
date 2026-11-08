import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import DashboardPage from './page';

describe('DashboardPage', () => {
  it('renders workspace navigation, summaries and project rows', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { name: 'Twoje projekty' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Menu główne' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Podsumowanie workspace' })).toBeInTheDocument();
    expect(screen.getByText('Kampania — wiosna')).toBeInTheDocument();
    expect(screen.getByText('Opakowanie produktu')).toBeInTheDocument();
    expect(screen.getByText('Identyfikacja wizualna')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dowiedz się więcej/ })).toHaveAttribute('href', '#shared');
  });

  it('filters projects by search term', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    const searchInput = screen.getByPlaceholderText('Szukaj projektu...');
    await user.type(searchInput, 'Opakowanie');

    expect(screen.getByText('Opakowanie produktu')).toBeInTheDocument();
    expect(screen.queryByText('Kampania — wiosna')).not.toBeInTheDocument();
    expect(screen.queryByText('Identyfikacja wizualna')).not.toBeInTheDocument();
  });

  it('filters projects by status pills', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    // Click 'Zamknięte'
    const closedFilter = screen.getByRole('button', { name: 'Zamknięte' });
    await user.click(closedFilter);

    expect(screen.getByText('Identyfikacja wizualna')).toBeInTheDocument();
    expect(screen.queryByText('Kampania — wiosna')).not.toBeInTheDocument();

    // Click 'W toku'
    const inProgressFilter = screen.getByRole('button', { name: 'W toku' });
    await user.click(inProgressFilter);

    expect(screen.getByText('Kampania — wiosna')).toBeInTheDocument();
    expect(screen.getByText('Opakowanie produktu')).toBeInTheDocument();
    expect(screen.queryByText('Identyfikacja wizualna')).not.toBeInTheDocument();
  });

  it('toggles between grid and list views', async () => {
    const user = userEvent.setup();
    const { container } = render(<DashboardPage />);

    expect(container.querySelector('.project-grid')).toBeInTheDocument();

    const listBtn = screen.getByRole('button', { name: 'Widok listy' });
    await user.click(listBtn);

    expect(container.querySelector('.project-list')).toBeInTheDocument();
    expect(container.querySelector('.project-grid')).not.toBeInTheDocument();
  });

  it('allows creating a new project via the dialog modal', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    // Open dialog with header "Nowy projekt" button
    const openBtns = screen.getAllByRole('button', { name: /Nowy projekt/i });
    await user.click(openBtns[0]);

    expect(screen.getByRole('heading', { name: 'Utwórz nowy projekt' })).toBeInTheDocument();

    // Fill in project details
    const nameInput = screen.getByLabelText(/Nazwa projektu/i);
    await user.type(nameInput, 'Projekt testowy 2026');

    const submitBtn = screen.getByRole('button', { name: 'Utwórz projekt' });
    await user.click(submitBtn);

    // Verify newly added project appears
    await waitFor(() => {
      expect(screen.getByText('Projekt testowy 2026')).toBeInTheDocument();
    });
  });
});
