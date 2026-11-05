import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardPage from './page';

describe('dashboard placeholder', () => {
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
});
