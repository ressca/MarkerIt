import type {
  ProjectStatus,
  ProjectTone,
  ReviewDecision,
  ReviewStatus,
} from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';

export function projectStatusLabel(
  messages: TranslationMessages,
  status: ProjectStatus,
): string {
  if (status === 'IN_REVIEW') return messages.project.statusInReview;
  if (status === 'CLOSED') return messages.project.statusClosed;
  return messages.project.statusActive;
}

export function projectToneLabel(messages: TranslationMessages, tone: ProjectTone): string {
  const labels: Record<ProjectTone, string> = {
    sage: messages.project.toneSage,
    sand: messages.project.toneSand,
    blue: messages.project.toneBlue,
    lilac: messages.project.toneLilac,
    emerald: messages.project.toneEmerald,
    amber: messages.project.toneAmber,
  };
  return labels[tone] ?? labels.sage;
}

export function reviewStatusLabel(messages: TranslationMessages, status: ReviewStatus): string {
  return status === 'CLOSED'
    ? messages.project.reviewStatusClosed
    : messages.project.reviewStatusOpen;
}

export function reviewDecisionLabel(
  messages: TranslationMessages,
  decision: ReviewDecision | null | undefined,
): string {
  if (decision === 'APPROVED') return messages.project.decisionApproved;
  if (decision === 'CHANGES_REQUESTED') return messages.project.decisionChangesRequested;
  return messages.project.decisionPending;
}
