import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewProjectDialog } from './new-project-dialog';

describe('NewProjectDialog', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses a localized close label', async () => {
    window.localStorage.setItem('markerit-locale', 'en');
    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onCreateProject={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
