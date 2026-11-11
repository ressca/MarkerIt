import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getMessages } from '@markerit/i18n';
import type { WorkspaceMemberDto } from '@markerit/api-client';
import { ReviewerPicker } from './reviewer-picker';

const en = getMessages('en');

function member(
  id: string,
  role: WorkspaceMemberDto['role'],
  displayName = id,
): WorkspaceMemberDto {
  return {
    id,
    displayName,
    email: `${id}@example.com`,
    initials: id.slice(0, 2).toUpperCase(),
    role,
  };
}

describe('ReviewerPicker', () => {
  it('only allows write-capable members and shows viewers as non-selectable', async () => {
    const onChange = vi.fn();
    const testUser = userEvent.setup();
    render(
      <ReviewerPicker
        members={[
          member('me', 'OWNER', 'Current Author'),
          member('member-1', 'MEMBER', 'Jan Nowak'),
          member('viewer-1', 'VIEWER', 'Ola Viewer'),
        ]}
        currentUserId="me"
        selectedIds={[]}
        onChange={onChange}
        messages={en}
      />,
    );

    expect(
      screen.queryByRole('checkbox', { name: 'Current Author' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Viewers cannot be assigned as reviewers.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ola Viewer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('checkbox', { name: 'Jan Nowak' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await testUser.click(screen.getByRole('checkbox', { name: 'Jan Nowak' }));
    expect(onChange).toHaveBeenCalledWith(['member-1']);
  });

  it('caps reviewer selection at 20 with a localized hint', () => {
    const members = Array.from({ length: 21 }, (_, index) =>
      member(`member-${index}`, 'MEMBER', `Member ${index}`),
    );
    const selected = members.slice(0, 20).map((item) => item.id);

    render(
      <ReviewerPicker
        members={members}
        currentUserId="me"
        selectedIds={selected}
        onChange={vi.fn()}
        messages={en}
      />,
    );

    expect(screen.getByText('You can assign up to 20 reviewers.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Member 20' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('checkbox', { name: 'Member 0' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
