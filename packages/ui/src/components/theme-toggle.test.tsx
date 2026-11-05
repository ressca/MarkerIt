import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './theme-toggle';

const props = { switchToDarkLabel: 'Dark', switchToLightLabel: 'Light' };

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.style.colorScheme = '';
});

describe('ThemeToggle', () => {
  it('restores a saved dark theme and switches back to light', async () => {
    window.localStorage.setItem('markerit-theme', 'dark');
    render(<ThemeToggle {...props} />);
    expect(await screen.findByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(window.localStorage.getItem('markerit-theme')).toBe('light');
  });

  it('uses the system preference for an unknown saved value', async () => {
    window.localStorage.setItem('markerit-theme', 'sepia');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    render(<ThemeToggle {...props} />);
    expect(await screen.findByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('uses the system preference when reading storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    render(<ThemeToggle {...props} />);
    expect(await screen.findByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('continues toggling when storage writes throw', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<ThemeToggle {...props} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
  });
});
