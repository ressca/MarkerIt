'use client';

import Link from 'next/link';
import type { ReviewReviewerDto, ReviewSummaryDto } from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';
import { Avatar, AvatarFallback, Badge, Card, CardContent } from '@markerit/ui';
import { ImageIcon, MessageSquare } from 'lucide-react';
import { assetContentUrl } from '../../../lib/assets';
import { formatDate } from '../../../lib/format';
import { reviewDecisionLabel, reviewStatusLabel } from '../../../lib/project-labels';
import { cn } from 'cn';

interface ReviewThreadCardProps {
  projectId: string;
  review: ReviewSummaryDto;
  messages: TranslationMessages;
  locale: 'pl' | 'en';
  reviewers?: ReviewReviewerDto[];
}

export function ReviewThreadCard({
  projectId,
  review,
  messages,
  locale,
  reviewers,
}: ReviewThreadCardProps) {
  const latestVersion = review.latestVersion;
  const asset = latestVersion?.asset;
  const href = `/projects/${projectId}/reviews/${review.id}`;
  const statusLabel = reviewStatusLabel(messages, review.status);

  return (
    <Link
      href={href}
      aria-label={review.title}
      className="block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
    <Card className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        <div aria-hidden="true" className="size-full">
          {asset ? (
            <img
              src={assetContentUrl(asset.id)}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon className="size-8" />
            </span>
          )}
        </div>
        <Badge
          variant={review.status === 'CLOSED' ? 'outline' : 'default'}
          className={cn(
            'absolute top-2 right-2 shadow-xs',
            review.status === 'OPEN' && 'bg-emerald-600 text-white',
          )}
        >
          {statusLabel}
        </Badge>
      </div>

      <CardContent className="space-y-3 p-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {review.title}
          </h3>
          {review.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{review.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <MessageSquare className="size-3.5 text-primary" />
            {messages.project.versionLabel} {latestVersion?.versionNumber ?? 0}
          </span>
          <span>
            {messages.project.createdBy}: {review.createdByName}
          </span>
          <span>
            {messages.project.updatedAt}: {formatDate(review.updatedAt, locale)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          {review.reviewerCount > 0 ? (
            <div className="flex min-w-0 items-center gap-2">
              {reviewers && reviewers.length > 0 && (
                <div
                  className="flex -space-x-1.5"
                  aria-label={messages.project.reviewersLabel}
                >
                  {reviewers.slice(0, 4).map((reviewer) => (
                    <Avatar
                      key={reviewer.userId}
                      size="sm"
                      role="img"
                      className="size-5 border-background font-bold text-[9px]"
                      aria-label={`${reviewer.displayName}: ${reviewDecisionLabel(
                        messages,
                        reviewer.decision,
                      )}`}
                      title={`${reviewer.displayName}: ${reviewDecisionLabel(
                        messages,
                        reviewer.decision,
                      )}`}
                    >
                      <AvatarFallback>{reviewer.initials}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
                {review.approvalSummary.approved > 0 && (
                  <span className="font-medium text-emerald-600">
                    {messages.project.decisionApproved}: {review.approvalSummary.approved}
                  </span>
                )}
                {review.approvalSummary.changesRequested > 0 && (
                  <span className="font-medium text-amber-600">
                    {messages.project.decisionChangesRequested}:{' '}
                    {review.approvalSummary.changesRequested}
                  </span>
                )}
                {review.approvalSummary.pending > 0 && (
                  <span className="font-medium text-muted-foreground">
                    {messages.project.decisionPending}: {review.approvalSummary.pending}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              {messages.project.noReviewers}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
