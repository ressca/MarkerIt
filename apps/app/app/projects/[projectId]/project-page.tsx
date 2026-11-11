'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  createReview,
  deleteProjectAsset,
  getProject,
  listProjectAssets,
  listProjectReviews,
  listWorkspaceMembers,
  uploadProjectAsset,
} from '@markerit/api-client';
import type {
  AssetDto,
  CreateReviewInput,
  ProjectDto,
  ReviewSummaryDto,
  WorkspaceMemberDto,
} from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';
import {
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
  Input,
  Label,
  Progress,
  Skeleton,
} from '@markerit/ui';
import {
  ArrowLeft,
  ImageIcon,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { UserProfile } from '../../components/types';
import { apiErrorMessage } from '../../lib/api-errors';
import { useAppLocale } from '../../lib/use-app-locale';
import { assetContentUrl } from '../../lib/assets';
import { MAX_PHOTO_BYTES, MAX_PROJECT_PHOTOS } from '../../lib/project-constants';
import { projectStatusLabel, projectToneLabel } from '../../lib/project-labels';
import { CreateReviewDialog } from './components/create-review-dialog';
import { ReviewThreadCard } from './components/review-thread-card';
import { cn } from 'cn';

interface ProjectPageProps {
  initialUser: UserProfile;
  projectId: string;
  /** Optional fixtures used by tests and previews. */
  initialProject?: ProjectDto;
  initialAssets?: AssetDto[];
  initialReviews?: ReviewSummaryDto[];
  initialMembers?: WorkspaceMemberDto[];
}

export function ProjectPage({
  initialUser,
  projectId,
  initialProject,
  initialAssets,
  initialReviews,
  initialMembers,
}: ProjectPageProps) {
  const { locale, messages } = useAppLocale();
  const hasFixtures = initialProject !== undefined;

  const [project, setProject] = useState<ProjectDto | null>(initialProject ?? null);
  const [members, setMembers] = useState<WorkspaceMemberDto[]>(initialMembers ?? []);
  const [assets, setAssets] = useState<AssetDto[]>(initialAssets ?? []);
  const [reviews, setReviews] = useState<ReviewSummaryDto[]>(initialReviews ?? []);
  const [loading, setLoading] = useState(!hasFixtures);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteAsset, setDeleteAsset] = useState<AssetDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedProject = await getProject(projectId);
      const [loadedMembers, loadedAssets, loadedReviews] = await Promise.all([
        listWorkspaceMembers(loadedProject.workspaceId),
        listProjectAssets(projectId),
        listProjectReviews(projectId),
      ]);

      setProject(loadedProject);
      setMembers(loadedMembers);
      setAssets(loadedAssets);
      setReviews(loadedReviews);
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (hasFixtures) return;
    void load();
  }, [hasFixtures, load]);

  const referencedAssetIds = useMemo(() => {
    const referenced = new Set<string>();
    for (const review of reviews) {
      if (review.latestVersion?.asset?.id) referenced.add(review.latestVersion.asset.id);
    }
    return referenced;
  }, [reviews]);

  async function handleUpload(file: File): Promise<string | null> {
    if (assets.length >= MAX_PROJECT_PHOTOS) {
      return messages.project.photoLimitReached;
    }
    try {
      const asset = await uploadProjectAsset(projectId, file);
      setAssets((previous) => [asset, ...previous]);
      setNotice(messages.project.photoUploaded);
      return null;
    } catch (cause) {
      return apiErrorMessage(cause, messages, messages.project.photoUploadError);
    }
  }

  async function handleDeletePhoto(asset: AssetDto): Promise<string | null> {
    try {
      await deleteProjectAsset(asset.id);
      setAssets((previous) => previous.filter((item) => item.id !== asset.id));
      setNotice(messages.project.photoDeleted);
      return null;
    } catch (cause) {
      return apiErrorMessage(cause, messages, messages.project.photoDeleteError);
    }
  }

  async function handleCreateReview(input: CreateReviewInput): Promise<string | null> {
    try {
      const review = await createReview(projectId, input);
      setReviews((previous) => [review.summary, ...previous]);
      return null;
    } catch (cause) {
      return apiErrorMessage(cause, messages, messages.project.createThreadError);
    }
  }

  const errorMessage = error
    ? apiErrorMessage(error, messages, messages.project.loadError)
    : null;

  if (loading && !project) {
    return <ProjectPageSkeleton messages={messages} />;
  }

  if (!project) {
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

  const statusLabel = projectStatusLabel(messages, project.status);
  const toneLabel = projectToneLabel(messages, project.tone);
  const projectClosed = project.status === 'CLOSED';
  const currentMember = members.find((member) => member.id === initialUser.id);
  const canWrite = Boolean(currentMember && currentMember.role !== 'VIEWER');

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 pb-16 sm:px-8">
        <div>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/" />}
            className="mb-4 gap-1.5 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {messages.project.backToDashboard}
          </Button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {messages.project.projectLabel}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {project.name}
              </h1>
              {project.description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {project.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant={project.status === 'CLOSED' ? 'outline' : 'default'}
                  className={cn(
                    'px-2 py-0.5 text-[11px] font-medium',
                    project.status === 'ACTIVE' && 'bg-emerald-600 text-white',
                    project.status === 'IN_REVIEW' &&
                      'border-amber-300 bg-amber-500/20 text-amber-800 dark:border-amber-700 dark:text-amber-200',
                  )}
                >
                  {statusLabel}
                </Badge>
                <Badge variant="secondary" className="px-2 py-0.5 text-[11px] font-medium">
                  {toneLabel}
                </Badge>
              </div>
            </div>
          </div>
        </div>

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

        {projectClosed && (
          <p
            role="note"
            className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          >
            {messages.project.projectClosedNotice}
          </p>
        )}

        <section aria-labelledby="project-photos-heading" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="project-photos-heading" className="text-lg font-semibold tracking-tight">
                {messages.project.photosTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {messages.project.photosDescription}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setUploadOpen(true)}
              disabled={!canWrite || projectClosed || assets.length >= MAX_PROJECT_PHOTOS}
              className="w-fit gap-1.5"
            >
              <Plus className="size-4" />
              {messages.project.addPhoto}
            </Button>
          </div>

          <Card size="sm" className="border-border/70 bg-card/50 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <ImageIcon className="size-4" />
                  {messages.project.photosTitle}
                </span>
                <strong className="text-sm font-semibold tabular-nums text-foreground">
                  {assets.length} / {MAX_PROJECT_PHOTOS} {messages.project.photosInProject}
                </strong>
              </div>
              <Progress value={assets.length} max={MAX_PROJECT_PHOTOS} className="mt-3 h-1.5" />
              {assets.length >= MAX_PROJECT_PHOTOS && (
                <p className="mt-2 text-[11px] text-destructive">
                  {messages.project.photoLimitReached}
                </p>
              )}
            </CardContent>
          </Card>

          {assets.length === 0 ? (
            <Card className="flex flex-col items-center justify-center border-dashed py-12 text-center">
              <CardContent className="flex max-w-md flex-col items-center p-6">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ImageIcon className="size-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{messages.project.emptyPhotos}</h3>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {messages.project.emptyPhotosDescription}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => setUploadOpen(true)}
                  disabled={!canWrite || projectClosed}
                >
                  <Upload className="size-4" />
                  {messages.project.addPhoto}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {assets.map((asset) => {
                const referenced = referencedAssetIds.has(asset.id);
                return (
                  <figure
                    key={asset.id}
                    className="group relative overflow-hidden rounded-xl border border-border bg-muted"
                  >
                    <img
                      src={assetContentUrl(asset.id)}
                      alt={asset.originalName}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                    {!referenced && canWrite && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => setDeleteAsset(asset)}
                        aria-label={`${messages.project.deletePhoto}: ${asset.originalName}`}
                        className="absolute top-2 right-2 size-7 bg-background/90 shadow-xs backdrop-blur-xs"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                    <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10px] font-medium text-white">
                      {asset.originalName}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="project-reviews-heading" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="project-reviews-heading" className="text-lg font-semibold tracking-tight">
                {messages.project.reviewsTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {messages.project.reviewsDescription}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={!canWrite || assets.length === 0 || projectClosed}
              className="w-fit gap-1.5"
            >
              <Plus className="size-4" />
              {messages.project.newThread}
            </Button>
          </div>

          {reviews.length === 0 ? (
            <Card className="flex flex-col items-center justify-center border-dashed py-12 text-center">
              <CardContent className="flex max-w-md flex-col items-center p-6">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Plus className="size-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{messages.project.noReviews}</h3>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {messages.project.noReviewsDescription}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => setCreateOpen(true)}
                  disabled={!canWrite || assets.length === 0 || projectClosed}
                >
                  <Plus className="size-4" />
                  {messages.project.newThread}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {reviews.map((review) => (
                <ReviewThreadCard
                  key={review.id}
                  projectId={projectId}
                  review={review}
                  messages={messages}
                  locale={locale}
                  reviewers={review.reviewers}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <CreateReviewDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        assets={assets}
        members={members}
        currentUserId={initialUser.id}
        messages={messages}
        onCreate={handleCreateReview}
      />

      <PhotoUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        messages={messages}
        onUpload={handleUpload}
      />

      <DeletePhotoDialog
        asset={deleteAsset}
        onOpenChange={(open) => {
          if (!open) setDeleteAsset(null);
        }}
        messages={messages}
        onDelete={handleDeletePhoto}
      />
    </div>
  );
}

function ProjectPageSkeleton({ messages }: { messages: TranslationMessages }) {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-8">
      <p className="sr-only">{messages.project.loadingProject}</p>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="aspect-square w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-72 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

interface PhotoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: TranslationMessages;
  onUpload: (file: File) => Promise<string | null>;
}

function PhotoUploadDialog({ open, onOpenChange, messages, onUpload }: PhotoUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setError('');
      setUploading(false);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError(messages.project.photoRequired);
      return;
    }
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError(messages.project.photoUnsupported);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(messages.project.photoTooLarge);
      return;
    }

    setUploading(true);
    setError('');
    try {
      const uploadError = await onUpload(file);
      if (uploadError) {
        setError(uploadError);
        return;
      }
      onOpenChange(false);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" closeLabel={messages.project.close}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{messages.project.uploadPhotoTitle}</DialogTitle>
            <DialogDescription>{messages.project.uploadPhotoDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="project-photo">{messages.project.chooseFile}</Label>
            <Input
              id="project-photo"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                if (error) setError('');
              }}
            />
            {file && (
              <p className="truncate text-[11px] text-muted-foreground">{file.name}</p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {messages.project.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={uploading} className="gap-1.5">
              <Upload className="size-3.5" />
              {uploading ? messages.project.uploading : messages.project.upload}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeletePhotoDialogProps {
  asset: AssetDto | null;
  onOpenChange: (open: boolean) => void;
  messages: TranslationMessages;
  onDelete: (asset: AssetDto) => Promise<string | null>;
}

function DeletePhotoDialog({
  asset,
  onOpenChange,
  messages,
  onDelete,
}: DeletePhotoDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!asset) {
      setError('');
      setDeleting(false);
    }
  }, [asset]);

  async function handleDelete() {
    if (!asset) return;
    setDeleting(true);
    setError('');
    try {
      const deleteError = await onDelete(asset);
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
    <Dialog open={asset !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" closeLabel={messages.project.close}>
        <DialogHeader>
          <DialogTitle>{messages.project.deletePhotoTitle}</DialogTitle>
          <DialogDescription>{messages.project.deletePhotoDescription}</DialogDescription>
        </DialogHeader>
        {asset && (
          <p className="truncate rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
            {asset.originalName}
          </p>
        )}
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
            {deleting ? messages.project.deleting : messages.project.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
