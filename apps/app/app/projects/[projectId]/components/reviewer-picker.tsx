'use client';

import type { WorkspaceMemberDto, WorkspaceRole } from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';
import { Checkbox } from '@markerit/ui';
import { MAX_REVIEWERS } from '../../../lib/project-constants';
import { cn } from 'cn';

const WRITE_ROLES: ReadonlySet<WorkspaceRole> = new Set(['OWNER', 'ADMIN', 'MEMBER']);

export function isReviewerEligible(member: WorkspaceMemberDto): boolean {
  return WRITE_ROLES.has(member.role);
}

interface ReviewerPickerProps {
  members: WorkspaceMemberDto[];
  currentUserId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  messages: TranslationMessages;
}

export function ReviewerPicker({
  members,
  currentUserId,
  selectedIds,
  onChange,
  messages,
}: ReviewerPickerProps) {
  const otherMembers = members.filter((member) => member.id !== currentUserId);
  const selectableMembers = otherMembers.filter(isReviewerEligible);
  const viewerMembers = otherMembers.filter((member) => !isReviewerEligible(member));
  const atLimit = selectedIds.length >= MAX_REVIEWERS;

  if (selectableMembers.length === 0 && viewerMembers.length === 0) {
    return <p className="text-xs text-muted-foreground">{messages.project.noReviewers}</p>;
  }

  function toggle(memberId: string, checked: boolean) {
    if (checked && selectedIds.length >= MAX_REVIEWERS) return;
    onChange(
      checked
        ? [...selectedIds.filter((id) => id !== memberId), memberId]
        : selectedIds.filter((id) => id !== memberId),
    );
  }

  return (
    <div className="space-y-2">
      {selectableMembers.length > 0 ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {selectableMembers.map((member) => {
            const selected = selectedIds.includes(member.id);
            return (
              <label
                key={member.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs transition-colors hover:bg-muted/50',
                  selected ? 'cursor-pointer' : atLimit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                )}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => toggle(member.id, checked)}
                  aria-label={member.displayName}
                  disabled={!selected && atLimit}
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="block font-medium text-foreground">{member.displayName}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {member.email}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{messages.project.noReviewers}</p>
      )}

      {atLimit && <p className="text-[11px] text-muted-foreground">{messages.project.reviewerLimitHint}</p>}

      {viewerMembers.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">{messages.project.reviewerReadOnlyHint}</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {viewerMembers.map((member) => (
              <label
                key={member.id}
                className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-xs opacity-60"
              >
                <Checkbox checked={false} aria-label={member.displayName} disabled />
                <span className="min-w-0 flex-1 truncate">
                  <span className="block font-medium text-foreground">{member.displayName}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {member.email}
                  </span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {messages.project.viewerRole}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
