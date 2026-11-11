import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceSwitcher } from './workspace-switcher';
import type { Workspace } from './types';

const workspaces: Workspace[] = [
  { id: 'ws-1', name: 'Studio Północ', role: 'Właściciel', initials: 'SP', projectCount: 1 },
  { id: 'ws-2', name: 'Klient ABC', role: 'Członek', initials: 'KA', projectCount: 0 },
];

describe('WorkspaceSwitcher', () => {
  it('selects an existing workspace', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <WorkspaceSwitcher
        workspaces={workspaces}
        currentWorkspaceId="ws-1"
        onSelectWorkspace={onSelect}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Wybierz przestrzeń roboczą' }));
    await user.click(await screen.findByText('Klient ABC'));

    expect(onSelect).toHaveBeenCalledWith('ws-2');
  });

  it('creates a new workspace from the popover form', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <WorkspaceSwitcher
        workspaces={workspaces}
        currentWorkspaceId="ws-1"
        onAddWorkspace={onAdd}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Wybierz przestrzeń roboczą' }));
    await user.click(await screen.findByText('Nowa przestrzeń...'));
    await user.type(screen.getByPlaceholderText('Nazwa nowej przestrzeni'), 'Nowe studio');
    await user.click(screen.getByRole('button', { name: 'Dodaj' }));

    expect(onAdd).toHaveBeenCalledWith('Nowe studio');
  });

  it('renders the collapsed trigger with a tooltip label', () => {
    render(
      <WorkspaceSwitcher
        workspaces={workspaces}
        currentWorkspaceId="ws-1"
        collapsed
      />
    );
    expect(screen.getByRole('button', { name: 'Przestrzeń: Studio Północ' })).toBeInTheDocument();
  });
});
