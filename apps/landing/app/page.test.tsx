import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomePage from './page';

afterEach(() => {
  window.localStorage.clear();
  document.title = '';
  document.documentElement.lang = '';
  document.head.innerHTML = '<meta name="description" content="">';
});

describe('landing page', () => {
  it('renders the Polish hero, navigation, preview and workflow', async () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Przypnij uwagę');
    expect(screen.getByRole('navigation', { name: 'Nawigacja główna' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Przypnij uwagę do obrazu/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Przykład' })).toHaveAttribute('href', '#example');
    expect(screen.getByText('Opakowanie produktu')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    await waitFor(() => expect(document.title).toContain('wizualny feedback'));
    expect(document.documentElement.lang).toBe('pl');
  });

  it('keeps the header clear at the top and adds its border after scrolling', () => {
    render(<HomePage />);
    const header = document.querySelector('header');
    expect(header).toHaveClass('border-transparent');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 40 });
    fireEvent.scroll(window);
    expect(header).toHaveClass('border-border/70');
  });

  it('changes language, page metadata and app links', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pin a note');
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open the app' })).toHaveAttribute('href', 'http://localhost:3000');
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
    expect(window.localStorage.getItem('markerit-locale')).toBe('en');
  });

  it('restores a supported saved locale and ignores unsupported locale values', async () => {
    window.localStorage.setItem('markerit-locale', 'en');
    const { unmount } = render(<HomePage />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Pin a note');
    unmount();
    window.localStorage.setItem('markerit-locale', 'de');
    render(<HomePage />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Przypnij uwagę');
  });

  it('keeps the page usable if browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pin a note');
  });
});
