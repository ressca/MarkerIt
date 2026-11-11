import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthShell } from './auth-shell';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.lang = '';
});

describe('AuthShell', () => {
  it('switches between English and Polish and persists the preference', async () => {
    const user = userEvent.setup();
    render(<AuthShell><p>Form</p></AuthShell>);
    expect(screen.getByRole('group', { name: 'Wybierz język' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Włącz czarny motyw' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('group', { name: 'Choose language' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem('markerit-locale')).toBe('en');
  });

  it('loads saved locale and keeps Polish when local storage is unavailable', async () => {
    window.localStorage.setItem('markerit-locale', 'en');
    const { unmount } = render(<AuthShell><p>Form</p></AuthShell>);
    expect(await screen.findByRole('group', { name: 'Choose language' })).toBeInTheDocument();
    unmount();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<AuthShell><p>Form</p></AuthShell>);
    expect(screen.getByRole('group', { name: 'Wybierz język' })).toBeInTheDocument();
  });

  it('handles storage write errors while still changing language', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const user = userEvent.setup();
    render(<AuthShell><p>Form</p></AuthShell>);
    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('group', { name: 'Choose language' })).toBeInTheDocument();
  });
});
