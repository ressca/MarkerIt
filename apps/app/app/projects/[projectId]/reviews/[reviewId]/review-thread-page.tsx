'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  closeReview,
  createReviewVersion,
  deleteProjectAsset,
  deleteReview,
  getProject,
  getReview,
  listProjectAssets,
  listWorkspaceMembers,
  submitReviewApproval,
  updateReview,
  uploadProjectAsset,
} from '@markerit/api-client';
import type {
  AssetDto,
  ProjectDto,
  ReviewDecision,
  ReviewDto,
  ReviewReviewerDto,
  ReviewVersionDto,
  UpdateReviewInput,
  WorkspaceMemberDto,
} from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  Label,
  Skeleton,
  Textarea,
} from '@markerit/ui';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ImageIcon,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { UserProfile } from '../../../../components/types';
import { apiErrorMessage } from '../../../../lib/api-errors';
import { useAppLocale } from '../../../../lib/use-app-locale';
import { assetContentUrl } from '../../../../lib/assets';
import {
  formatDate,
  formatDateTime,
} from '../../../../lib/format';
import {
  reviewDecisionLabel,
  reviewStatusLabel,
} from '../../../../lib/project-labels';
import { MAX_PROJECT_PHOTOS, MAX_PHOTO_BYTES } from '../../../../lib/project-constants';
import { ReviewerPicker } from '../../components/reviewer-picker';
import { cn } from 'cn';

interface ReviewThreadPageProps {
  initialUser: UserProfile;
  projectId: string;
  reviewId: string;
  /** Optional fixtures used by tests and previews. */
  initialReview?: ReviewDto;
  initialProject?: ProjectDto;
  initialAssets?: AssetDto[];
  initialMembers?: WorkspaceMemberDto[];
}

type AddVersionInput = {
  file?: File;
  assetId?: string;
};

export function ReviewThreadPage({
  initialUser,
  projectId,
  reviewId,
  initialReview,
  initialProject,
  initialAssets,
  initialMembers,
}: ReviewThreadPageProps) {
  const { locale, messages } = useAppLocale();
  const router = useRouter();
  const hasFixtures = initialReview !== undefined;

  const [thread, setThread] = useState<ReviewDto | null>(initialReview ?? null);
  const [project, setProject] = useState<ProjectDto | null>(initialProject ?? null);
  const [assets, setAssets] = useState<AssetDto[]>(initialAssets ?? []);
  const [members, setMembers] = useState<WorkspaceMemberDto[]>(initialMembers ?? []);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [loading, setLoading] = useState(!hasFixtures);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedReview, loadedProject] = await Promise.all([
        getReview(reviewId),
        getProject(projectId),
      ]);
      const [loadedAssets, loadedMembers] = await Promise.all([
        listProjectAssets(projectId),
        listWorkspaceMembers(loadedProject.workspaceId),
      ]);
      setThread(loadedReview);
      setProject(loadedProject);
      setAssets(loadedAssets);
      setMembers(loadedMembers);
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, [projectId, reviewId]);

  useEffect(() => {
    if (hasFixtures) return;
    void load();
  }, [hasFixtures, load]);

  const latestVersion = thread?.versions[thread.versions.length - 1];
  const selectedVersion =
    thread?.versions.find((version) => version.id === selectedVersionId) ?? latestVersion;

  useEffect(() => {
    if (latestVersion && !thread?.versions.some((version) => version.id === selectedVersionId)) {
      setSelectedVersionId(latestVersion.id);
    }
  }, [latestVersion, selectedVersionId, thread?.versions]);

  const summary = thread?.summary;
  const isAuthor = summary?.createdBy === initialUser.id;
  const reviewer = thread?.reviewers.find((item) => item.userId === initialUser.id);
  const isReviewer = Boolean(reviewer);
  const canModerate = isAuthor || isReviewer;
  const isOpen = summary?.status === 'OPEN';
  const pendingReviewers = thread?.reviewers.filter((item) => item.decision !== 'APPROVED') ?? [];
  const allApproved = pendingReviewers.length === 0;
  const isLatestSelected = selectedVersion?.id === latestVersion?.id;
  const photoLimitReached = assets.length >= MAX_PROJECT_PHOTOS;
  const projectClosed = project?.status === 'CLOSED';
  const errorMessage = error
    ? apiErrorMessage(error, messages, messages.project.genericError)
    : null;

  async function refreshThread() {
    const loaded = await getReview(reviewId);
    setThread(loaded);
    return loaded;
  }

  async function handleDecision(note: string): Promise<string | null> {
    if (!decision || !selectedVersion) return messages.project.decisionError;
    try {
      await submitReviewApproval(reviewId, {
        decision,
        versionId: selectedVersion.id,
        note: note.trim() || undefined,
      });
      await refreshThread();
      setNotice(messages.project.decisionSaved);
      return null;
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'REVIEW_VERSION_STALE') {
        try {
          const loaded = await refreshThread();
          const newest = loaded.versions[loaded.versions.length - 1];
          if (newest) setSelectedVersionId(newest.id);
        } catch {
          // The stale message below is still the most useful feedback.
        }
      }
      return apiErrorMessage(cause, messages, messages.project.decisionError);
    }
  }

  async function handleClose() {
    try {
      const closed = await closeReview(reviewId);
      setThread(closed);
      setNotice(messages.project.closeThreadSuccess);
      setError(null);
    } catch (cause) {
      setError(cause);
    }
  }

  async function handleAddVersion(
    input: AddVersionInput,
    note: string,
  ): Promise<string | null> {
    let uploaded: AssetDto | null = null;
    let versionCreated = false;
    try {
      let assetId = input.assetId;
      if (input.file) {
        uploaded = await uploadProjectAsset(projectId, input.file);
        assetId = uploaded.id;
      }
      if (!assetId) {
        return messages.project.addVersionAssetRequired;
      }
      await createReviewVersion(reviewId, {
        assetId,
        note: note.trim() || undefined,
      });
      versionCreated = true;
      if (uploaded) {
        const createdAsset = uploaded;
        setAssets((previous) => [createdAsset, ...previous]);
      }
      const loaded = await refreshThread();
      const newest = loaded.versions[loaded.versions.length - 1];
      if (newest) setSelectedVersionId(newest.id);
      setNotice(messages.project.versionCreated);
      return null;
    } catch (cause) {
      if (uploaded && !versionCreated) {
        try {
          await deleteProjectAsset(uploaded.id);
        } catch {
          // Best effort: an orphaned upload can be removed from the project later.
        }
      }
      return apiErrorMessage(cause, messages, messages.project.versionError);
    }
  }

  async function handleEdit(input: UpdateReviewInput): Promise<string | null> {
    try {
      const updated = await updateReview(reviewId, input);
      setThread(updated);
      return null;
    } catch (cause) {
      return apiErrorMessage(cause, messages, messages.project.editThreadError);
    }
  }

  async function handleDelete(): Promise<string | null> {
    try {
      await deleteReview(reviewId);
      router.push(`/projects/${projectId}`);
      return null;
    } catch (cause) {
      return apiErrorMessage(cause, messages, messages.project.deleteThreadError);
    }
  }

  if (loading && !thread) {
    return <ThreadSkeleton messages={messages} />;
  }

  if (!thread || !summary) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">{messages.project.loadError}</h1>
        {errorMessage && <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>}
        <Button type="button" className="mt-4 gap-1.5" onClick={() => void load()}>
          <RefreshCw className="size-4" />
          {messages.project.retry}
        </Button>
      </div>
    );
  }

  const statusLabel = reviewStatusLabel(messages, summary.status);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-16 sm:px-8">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/projects/${projectId}`} />}
          className="gap-1.5 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {project?.name ?? messages.project.backToDashboard}
        </Button>

        <header className="flex flex-col gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={summary.status === 'CLOSED' ? 'outline' : 'default'}
                  className={cn(
                    'px-2 py-0.5 text-[11px] font-medium',
                    summary.status === 'OPEN' && 'bg-emerald-600 text-white',
                  )}
                >
                  {statusLabel}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {messages.project.createdBy}: {summary.createdByName} ·{' '}
                  {formatDate(summary.createdAt, locale)}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {summary.title}
              </h1>
              {summary.description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {summary.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAuthor && isOpen && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                    className="gap-1.5"
                  >
                    <Pencil className="size-3.5" />
                    {messages.project.editThread}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddVersionOpen(true)}
                    disabled={projectClosed}
                    className="gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    {messages.project.addVersion}
                  </Button>
                </>
              )}
              {canModerate && isOpen && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleClose()}
                  disabled={!allApproved}
                  className="gap-1.5"
                >
                  <Check className="size-3.5" />
                  {messages.project.closeThread}
                </Button>
              )}
              {canModerate && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  className="gap-1.5"
                >
                  <Trash2 className="size-3.5" />
                  {messages.project.deleteThread}
                </Button>
              )}
            </div>
          </div>

          {!isOpen && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {messages.project.threadClosedNotice}
            </p>
          )}
          {projectClosed && (
            <p
              role="note"
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            >
              {messages.project.projectClosedNotice}
            </p>
          )}
          {isOpen && canModerate && !allApproved && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {messages.project.closeThreadReason}{' '}
              {messages.project.closeThreadPending}{' '}
              {pendingReviewers.map((item) => item.displayName).join(', ')}
            </p>
          )}
          {isAuthor && isOpen && photoLimitReached && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {messages.project.addVersionExistingOnly}
            </p>
          )}

          <ReviewerList reviewers={thread.reviewers} messages={messages} />
        </header>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <span className="leading-relaxed">{errorMessage}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setError(null)}
              aria-label={messages.project.close}
              className="size-5 shrink-0 text-destructive hover:bg-destructive/15"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
          >
            <span className="leading-relaxed">{notice}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setNotice(null)}
              aria-label={messages.project.close}
              className="size-5 shrink-0 text-emerald-700 hover:bg-emerald-500/15"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        <section aria-label={messages.project.versionSelectorLabel} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <VersionSelector
              versions={thread.versions}
              selectedVersion={selectedVersion}
              latestVersion={latestVersion}
              messages={messages}
              onSelect={setSelectedVersionId}
            />
            <span className="text-[11px] text-muted-foreground">
              {messages.project.updatedAt}: {formatDateTime(summary.updatedAt, locale)}
            </span>
          </div>

          <Card className="overflow-hidden">
            <div className="relative flex min-h-56 items-center justify-center bg-muted/50">
              {selectedVersion?.asset ? (
                <img
                  src={assetContentUrl(selectedVersion.asset.id)}
                  alt={`${summary.title} — ${messages.project.versionLabel} ${selectedVersion.versionNumber}`}
                  className="max-h-[70dvh] w-full object-contain"
                />
              ) : (
                <span className="flex flex-col items-center gap-2 p-10 text-muted-foreground">
                  <ImageIcon className="size-10" />
                  <span className="text-xs">{messages.project.emptyPhotosDescription}</span>
                </span>
              )}
            </div>
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[11px]">
                  {messages.project.versionLabel} {selectedVersion?.versionNumber ?? 0}
                </Badge>
                {!isLatestSelected && (
                  <Badge variant="outline" className="text-[11px]">
                    {messages.project.olderVersion}
                  </Badge>
                )}
                {selectedVersion && (
                  <span className="text-[11px] text-muted-foreground">
                    {messages.project.versionCreatedBy}: {selectedVersion.createdByName} ·{' '}
                    {formatDate(selectedVersion.createdAt, locale)}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground">
                {selectedVersion?.note || messages.project.versionNoteEmpty}
              </p>
            </CardContent>
          </Card>

          {isOpen && isReviewer && isLatestSelected && (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {messages.project.decisionDescription}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setDecision('APPROVED')}
                  className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Check className="size-3.5" />
                  {messages.project.approve}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDecision('CHANGES_REQUESTED')}
                  className="gap-1.5"
                >
                  <MessageSquare className="size-3.5" />
                  {messages.project.requestChanges}
                </Button>
              </div>
            </div>
          )}
        </section>

        <section
          aria-labelledby="discussion-placeholder-heading"
          data-testid="discussion-placeholder"
          className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center"
        >
          <h2
            id="discussion-placeholder-heading"
            className="text-sm font-semibold text-foreground"
          >
            {messages.project.discussionPlaceholderTitle}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            {messages.project.discussionPlaceholderDescription}
          </p>
        </section>
      </main>

      <DecisionDialog
        decision={decision}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        messages={messages}
        onSubmit={handleDecision}
      />

      {isAuthor && (
        <EditThreadDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          thread={thread}
          members={members}
          currentUserId={initialUser.id}
          messages={messages}
          onSave={handleEdit}
        />
      )}

      <AddVersionDialog
        open={addVersionOpen}
        onOpenChange={setAddVersionOpen}
        messages={messages}
        assets={assets}
        photoLimitReached={photoLimitReached}
        onAddVersion={handleAddVersion}
      />

      <DeleteThreadDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        messages={messages}
        onDelete={handleDelete}
      />
    </div>
  );
}

function ThreadSkeleton({ messages }: { messages: TranslationMessages }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-8">
      <p className="sr-only">{messages.project.loadingProject}</p>
      <Skeleton className="h-4 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-[50dvh] w-full rounded-xl" />
    </div>
  );
}

interface ReviewerListProps {
  reviewers: ReviewReviewerDto[];
  messages: TranslationMessages;
}

function ReviewerList({ reviewers, messages }: ReviewerListProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {messages.project.reviewersLabel}
      </p>
      {reviewers.length === 0 ? (
        <p className="text-xs text-muted-foreground">{messages.project.noReviewers}</p>
      ) : (
        <ul className="flex flex-wrap items-center gap-2">
          {reviewers.map((reviewer) => (
            <li
              key={reviewer.userId}
              className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1"
            >
              <Avatar size="sm" className="size-6 font-bold text-[10px]">
                <AvatarFallback>{reviewer.initials}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-foreground">{reviewer.displayName}</span>
              <Badge
                variant={reviewer.decision === 'APPROVED' ? 'default' : 'outline'}
                className={cn(
                  'h-4.5 px-1.5 text-[10px]',
                  reviewer.decision === 'APPROVED' && 'bg-emerald-600 text-white',
                  reviewer.decision === 'CHANGES_REQUESTED' &&
                    'border-amber-300 bg-amber-500/20 text-amber-800 dark:border-amber-700 dark:text-amber-200',
                )}
              >
                {reviewDecisionLabel(messages, reviewer.decision)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface VersionSelectorProps {
  versions: ReviewVersionDto[];
  selectedVersion?: ReviewVersionDto | null;
  latestVersion?: ReviewVersionDto;
  messages: TranslationMessages;
  onSelect: (versionId: string) => void;
}

function VersionSelector({
  versions,
  selectedVersion,
  latestVersion,
  messages,
  onSelect,
}: VersionSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" />
        }
      >
        {messages.project.versionSelectorLabel} {selectedVersion?.versionNumber ?? 0}
        {selectedVersion?.id === latestVersion?.id ? ` · ${messages.project.latestVersion}` : ''}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>{messages.project.versionSelectorLabel}</DropdownMenuLabel>
        {[...versions].reverse().map((version) => (
          <DropdownMenuItem key={version.id} onClick={() => onSelect(version.id)}>
            <span className="flex-1">
              {messages.project.versionLabel} {version.versionNumber}
              {version.id === latestVersion?.id ? ` · ${messages.project.latestVersion}` : ''}
            </span>
            {version.id === selectedVersion?.id && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DecisionDialogProps {
  decision: ReviewDecision | null;
  onOpenChange: (open: boolean) => void;
  messages: TranslationMessages;
  onSubmit: (note: string) => Promise<string | null>;
}

function DecisionDialog({ decision, onOpenChange, messages, onSubmit }: DecisionDialogProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (decision === null) {
      setNote('');
      setError('');
      setSubmitting(false);
    }
  }, [decision]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const submitError = await onSubmit(note);
      if (submitError) {
        setError(submitError);
        return;
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={decision !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {decision === 'CHANGES_REQUESTED'
                ? messages.project.requestChangesTitle
                : messages.project.approveTitle}
            </DialogTitle>
            <DialogDescription>{messages.project.decisionDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="decision-note">{messages.project.decisionNoteLabel}</Label>
            <Textarea
              id="decision-note"
              value={note}
              maxLength={4000}
              onChange={(event) => setNote(event.target.value)}
              placeholder={messages.project.decisionNotePlaceholder}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {messages.project.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? messages.project.submittingDecision : messages.project.submitDecision}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thread: ReviewDto;
  members: WorkspaceMemberDto[];
  currentUserId: string;
  messages: TranslationMessages;
  onSave: (input: UpdateReviewInput) => Promise<string | null>;
}

function EditThreadDialog({
  open,
  onOpenChange,
  thread,
  members,
  currentUserId,
  messages,
  onSave,
}: EditThreadDialogProps) {
  const [title, setTitle] = useState(thread.summary.title);
  const [description, setDescription] = useState(thread.summary.description ?? '');
  const [reviewerIds, setReviewerIds] = useState<string[]>(
    thread.reviewers.map((item) => item.userId).filter((id) => id !== currentUserId),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(thread.summary.title);
      setDescription(thread.summary.description ?? '');
      setReviewerIds(
        thread.reviewers.map((item) => item.userId).filter((id) => id !== currentUserId),
      );
      setError('');
    }
  }, [currentUserId, open, thread]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(messages.project.titleRequired);
      return;
    }
    if (trimmedTitle.length > 120) {
      setError(messages.project.titleTooLong);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saveError = await onSave({
        title: trimmedTitle,
        description: description.trim(),
        reviewerIds,
      });
      if (saveError) {
        setError(saveError);
        return;
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{messages.project.editThreadTitle}</DialogTitle>
            <DialogDescription>{messages.project.editThreadDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="edit-thread-title">{messages.project.titleLabel} *</Label>
              <Input
                id="edit-thread-title"
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-thread-description">{messages.project.descriptionLabel}</Label>
              <Textarea
                id="edit-thread-description"
                value={description}
                maxLength={4000}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{messages.project.reviewersLabel}</Label>
              <ReviewerPicker
                members={members}
                currentUserId={currentUserId}
                selectedIds={reviewerIds}
                onChange={setReviewerIds}
                messages={messages}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {messages.project.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? messages.project.savingChanges : messages.project.saveChanges}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface AddVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: TranslationMessages;
  assets: AssetDto[];
  photoLimitReached: boolean;
  onAddVersion: (input: AddVersionInput, note: string) => Promise<string | null>;
}

function AddVersionDialog({
  open,
  onOpenChange,
  messages,
  assets,
  photoLimitReached,
  onAddVersion,
}: AddVersionDialogProps) {
  const [assetId, setAssetId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setAssetId('');
      setFile(null);
      setNote('');
      setError('');
      setUploading(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!assetId && !file) {
      setError(messages.project.addVersionAssetRequired);
      return;
    }
    if (file) {
      if (!['image/png', 'image/jpeg'].includes(file.type)) {
        setError(messages.project.photoUnsupported);
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError(messages.project.photoTooLarge);
        return;
      }
    }

    setUploading(true);
    setError('');
    try {
      const versionError = await onAddVersion(
        file ? { file } : { assetId },
        note,
      );
      if (versionError) {
        setError(versionError);
        return;
      }
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{messages.project.addVersionTitle}</DialogTitle>
            <DialogDescription>{messages.project.addVersionDescription}</DialogDescription>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            {assets.length} / {MAX_PROJECT_PHOTOS} {messages.project.photosInProject}
          </p>

          <div className="space-y-1.5">
            <Label>{messages.project.chooseExistingPhoto}</Label>
            {assets.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                {messages.project.emptyPhotosDescription}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {assets.map((asset) => {
                  const selected = asset.id === assetId;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      aria-label={asset.originalName}
                      aria-pressed={selected}
                      onClick={() => {
                        setAssetId(selected ? '' : asset.id);
                        setFile(null);
                        if (error) setError('');
                      }}
                      className={cn(
                        'group relative aspect-square overflow-hidden rounded-lg border bg-muted outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50',
                        selected
                          ? 'border-primary ring-2 ring-primary/40'
                          : 'border-border hover:border-primary/40',
                      )}
                    >
                      <img
                        src={assetContentUrl(asset.id)}
                        alt={asset.originalName}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                      {selected && (
                        <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                          <Check className="size-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {photoLimitReached ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {messages.project.addVersionExistingOnly}
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-center text-[11px] text-muted-foreground">
                {messages.project.orUploadNewPhoto}
              </p>
              <Label htmlFor="version-file">{messages.project.chooseFile}</Label>
              <Input
                id="version-file"
                type="file"
                accept="image/png,image/jpeg"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  if (event.target.files?.[0]) setAssetId('');
                  if (error) setError('');
                }}
              />
              {file && <p className="truncate text-[11px] text-muted-foreground">{file.name}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="version-note">{messages.project.versionNoteLabel}</Label>
            <Textarea
              id="version-note"
              value={note}
              maxLength={4000}
              onChange={(event) => setNote(event.target.value)}
              placeholder={messages.project.versionNotePlaceholder}
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {messages.project.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={uploading} className="gap-1.5">
              <Upload className="size-3.5" />
              {uploading ? messages.project.uploadingVersion : messages.project.uploadVersion}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: TranslationMessages;
  onDelete: () => Promise<string | null>;
}

function DeleteThreadDialog({
  open,
  onOpenChange,
  messages,
  onDelete,
}: DeleteThreadDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setError('');
      setDeleting(false);
    }
  }, [open]);

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      const deleteError = await onDelete();
      if (deleteError) {
        setError(deleteError);
        return;
      }
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{messages.project.deleteThreadTitle}</DialogTitle>
          <DialogDescription>{messages.project.deleteThreadDescription}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {messages.project.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? messages.project.deleting : messages.project.deleteThreadConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
