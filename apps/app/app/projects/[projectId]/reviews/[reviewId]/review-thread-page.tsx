'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  closeReview,
  createPinComment,
  createReviewVersion,
  createVersionPin,
  deleteComment,
  deletePin,
  deleteProjectAsset,
  deleteReview,
  getProject,
  getReview,
  getReviewDiscussion,
  listProjectAssets,
  listWorkspaceMembers,
  submitReviewApproval,
  updateComment,
  updatePin,
  updateReview,
  uploadProjectAsset,
  uploadProjectAttachment,
} from '@markerit/api-client';
import type {
  AssetDto,
  CommentDto,
  DiscussionDto,
  DiscussionPinDto,
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
import { AppShell } from '../../../../components/app-shell';
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
import {
  MAX_ATTACHMENT_BYTES,
  MAX_COMMENT_ATTACHMENTS,
  MAX_PROJECT_PHOTOS,
  MAX_PHOTO_BYTES,
} from '../../../../lib/project-constants';
import {
  createReviewRealtime,
  type RealtimeHandle,
  type RealtimeStatus,
  type ReviewRealtimeEvent,
} from '../../../../lib/realtime';
import { ReviewerPicker } from '../../components/reviewer-picker';
import { AddPinDialog, type PinPoint } from './components/add-pin-dialog';
import { DiscussionPanel } from './components/discussion-panel';
import { ReviewCanvas } from './components/review-canvas';
import {
  applyCommentMutation,
  applyDiscussionEvent,
  applyPinMutation,
  markCommentDeleted,
  removePin,
} from './discussion-utils';
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
  initialDiscussion?: DiscussionDto;
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
  initialDiscussion,
}: ReviewThreadPageProps) {
  const { locale, messages } = useAppLocale();
  const router = useRouter();
  // Next's router is stable, but tests/mocks may return a fresh object. Keeping
  // it in a ref prevents callbacks (and their effects) from churning.
  const routerRef = useRef(router);
  routerRef.current = router;
  const hasFixtures = initialReview !== undefined;

  const [thread, setThread] = useState<ReviewDto | null>(initialReview ?? null);
  const [project, setProject] = useState<ProjectDto | null>(initialProject ?? null);
  const [assets, setAssets] = useState<AssetDto[]>(initialAssets ?? []);
  const [members, setMembers] = useState<WorkspaceMemberDto[]>(initialMembers ?? []);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [loading, setLoading] = useState(!hasFixtures);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [discussion, setDiscussion] = useState<DiscussionDto | null>(initialDiscussion ?? null);
  const [discussionLoading, setDiscussionLoading] = useState(true);
  const [discussionError, setDiscussionError] = useState<unknown>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [pinPoint, setPinPoint] = useState<PinPoint | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');
  const discussionRef = useRef<DiscussionDto | null>(initialDiscussion ?? null);
  const selectedVersionIdRef = useRef('');
  const latestVersionIdRef = useRef('');
  const discussionRequestRef = useRef(0);
  const loadRequestRef = useRef(0);
  const threadRequestRef = useRef(0);
  /** Monotonic revision bumped by every mutation/event folded into state. */
  const revisionRef = useRef(0);
  const pinEventAtRef = useRef<Map<string, number>>(new Map());
  const realtimeHandleRef = useRef<RealtimeHandle | null>(null);
  const previousRealtimeStatusRef = useRef<RealtimeStatus>('connecting');
  const ownApprovalAtRef = useRef(0);
  const highlightedPinId = hoveredPinId ?? selectedPinId;

  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addVersionOpen, setAddVersionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const stopRealtime = useCallback(() => {
    const handle = realtimeHandleRef.current;
    realtimeHandleRef.current = null;
    void handle?.disconnect();
  }, []);

  const leaveThread = useCallback(() => {
    stopRealtime();
    routerRef.current.replace(`/projects/${projectId}`);
  }, [projectId, stopRealtime]);

  const handleReviewGone = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.code === 'REVIEW_NOT_FOUND') {
        leaveThread();
        return true;
      }
      return false;
    },
    [leaveThread],
  );

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
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
      if (requestId !== loadRequestRef.current) return;
      setThread(loadedReview);
      setProject(loadedProject);
      setAssets(loadedAssets);
      setMembers(loadedMembers);
    } catch (cause) {
      if (requestId !== loadRequestRef.current) return;
      if (handleReviewGone(cause)) return;
      setError(cause);
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [handleReviewGone, projectId, reviewId]);

  useEffect(() => {
    if (hasFixtures) return;
    void load();
  }, [hasFixtures, load]);

  const latestVersion = thread?.versions[thread.versions.length - 1];
  const selectedVersion =
    thread?.versions.find((version) => version.id === selectedVersionId) ?? latestVersion;

  useEffect(() => {
    latestVersionIdRef.current = latestVersion?.id ?? '';
  }, [latestVersion?.id]);

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
  const discussionErrorMessage = discussionError
    ? apiErrorMessage(discussionError, messages, messages.project.discussionLoadError)
    : null;
  const currentMember = members.find((member) => member.id === initialUser.id);
  const isWorkspaceAdmin =
    currentMember?.role === 'ADMIN' || currentMember?.role === 'OWNER';
  const canWrite = Boolean(currentMember && currentMember.role !== 'VIEWER');

  const refreshThread = useCallback(
    async (options: { silent?: boolean } = {}): Promise<ReviewDto | null> => {
      const requestId = ++threadRequestRef.current;
      const revision = revisionRef.current;
      try {
        const loaded = await getReview(reviewId);
        if (requestId !== threadRequestRef.current || revisionRef.current !== revision) {
          return null;
        }
        setThread(loaded);
        return loaded;
      } catch (cause) {
        if (handleReviewGone(cause)) return null;
        if (
          requestId === threadRequestRef.current &&
          revisionRef.current === revision &&
          !options.silent
        ) {
          setError(cause);
        }
        return null;
      }
    },
    [handleReviewGone, reviewId],
  );

  const commitDiscussion = useCallback((next: DiscussionDto) => {
    revisionRef.current += 1;
    discussionRef.current = next;
    setDiscussion(next);
  }, []);

  const loadDiscussion = useCallback(
    async (versionId: string, options: { silent?: boolean } = {}) => {
      const requestId = ++discussionRequestRef.current;
      const revision = revisionRef.current;
      if (!options.silent) setDiscussionLoading(true);
      setDiscussionError(null);
      try {
        const loaded = await getReviewDiscussion(reviewId, versionId);
        if (
          requestId !== discussionRequestRef.current ||
          selectedVersionIdRef.current !== versionId ||
          revisionRef.current !== revision
        ) {
          return;
        }
        discussionRef.current = loaded;
        setDiscussion(loaded);
      } catch (cause) {
        if (handleReviewGone(cause)) return;
        // A background refresh must never replace a valid feed with an error
        // banner; the older discussion stays interactive.
        if (
          requestId === discussionRequestRef.current &&
          selectedVersionIdRef.current === versionId &&
          revisionRef.current === revision &&
          !options.silent
        ) {
          setDiscussionError(cause);
        }
      } finally {
        if (requestId === discussionRequestRef.current) {
          setDiscussionLoading(false);
        }
      }
    },
    [handleReviewGone, reviewId],
  );

  useEffect(() => {
    discussionRef.current = discussion;
  }, [discussion]);

  useEffect(() => {
    const versionId = selectedVersion?.id;
    if (!versionId) return;
    selectedVersionIdRef.current = versionId;
    setSelectedPinId(null);
    setHoveredPinId(null);
    setPinPoint(null);
    if (discussionRef.current?.versionId !== versionId) {
      discussionRef.current = null;
      setDiscussion(null);
    }
    setDiscussionLoading(true);
    void loadDiscussion(versionId);
    return () => {
      discussionRequestRef.current += 1;
    };
  }, [selectedVersion?.id, loadDiscussion]);

  const resync = useCallback(() => {
    const versionId = selectedVersionIdRef.current;
    void refreshThread({ silent: true });
    if (versionId) void loadDiscussion(versionId, { silent: true });
  }, [loadDiscussion, refreshThread]);

  const handleRealtimeEvent = useCallback(
    (event: ReviewRealtimeEvent) => {
      if (event.type === 'REVIEW_DELETED') {
        leaveThread();
        return;
      }

      const versionId = selectedVersionIdRef.current;
      if (!versionId) return;

      const isReviewLevelEvent =
        event.type === 'REVIEW_CREATED' ||
        event.type === 'REVIEW_UPDATED' ||
        event.type === 'VERSION_CREATED' ||
        event.type === 'APPROVAL_CREATED' ||
        event.payloadType === 'REVIEW' ||
        event.payloadType === 'VERSION' ||
        event.payloadType === 'APPROVAL';

      if (isReviewLevelEvent) {
        // Our own approval already refreshed the thread and feed above; the
        // echoed event does not need a second round trip.
        if (
          event.type === 'APPROVAL_CREATED' &&
          Date.now() - ownApprovalAtRef.current < 3_000
        ) {
          return;
        }
        if (event.type === 'VERSION_CREATED') {
          const wasViewingLatest = versionId === latestVersionIdRef.current;
          void refreshThread({ silent: true }).then((loaded) => {
            if (!loaded) {
              void loadDiscussion(versionId, { silent: true });
              return;
            }
            const newest = loaded.versions[loaded.versions.length - 1];
            if (wasViewingLatest && newest) {
              // The user was looking at the previous latest version, so follow
              // the new one instead of silently leaving them on a stale image.
              setSelectedVersionId(newest.id);
            } else {
              void loadDiscussion(versionId, { silent: true });
            }
          });
          return;
        }
        void refreshThread({ silent: true });
        void loadDiscussion(versionId, { silent: true });
        return;
      }

      const current = discussionRef.current;
      if (!current || current.versionId !== versionId) {
        void loadDiscussion(versionId, { silent: true });
        return;
      }

      if (event.versionId && event.versionId !== versionId) return;

      if (
        (event.type === 'PIN_CREATED' || event.type === 'PIN_UPDATED') &&
        event.pinId
      ) {
        const occurredAt = event.occurredAt ? Date.parse(event.occurredAt) : 0;
        if (!Number.isNaN(occurredAt) && occurredAt > 0) {
          const lastApplied = pinEventAtRef.current.get(event.pinId) ?? 0;
          // A delayed/replayed pin update must not flip RESOLVED back to OPEN.
          if (lastApplied > 0 && occurredAt < lastApplied) return;
          pinEventAtRef.current.set(event.pinId, occurredAt);
        }
      }

      const next = applyDiscussionEvent(current, event);
      if (next === null) {
        void loadDiscussion(versionId, { silent: true });
        return;
      }
      if (next === current) return;
      commitDiscussion(next);
      if (event.type === 'PIN_CREATED' && event.pinId) {
        setSelectedPinId(event.pinId);
      }
      if (event.type === 'PIN_DELETED' && event.pinId) {
        const deletedPinId = event.pinId;
        pinEventAtRef.current.delete(deletedPinId);
        setSelectedPinId((previous) => (previous === deletedPinId ? null : previous));
        setHoveredPinId((previous) => (previous === deletedPinId ? null : previous));
      }
    },
    [commitDiscussion, leaveThread, loadDiscussion, refreshThread],
  );

  useEffect(() => {
    const handle = createReviewRealtime({
      reviewId,
      onEvent: handleRealtimeEvent,
      onStatus: (status) => {
        const previous = previousRealtimeStatusRef.current;
        previousRealtimeStatusRef.current = status;
        setRealtimeStatus(status);
        if (status !== 'connected') return;
        // Reconnect, recovery from an error and the initial connect all
        // deserve fresh server state. The revision guard discards stale
        // responses, so an extra initial fetch is harmless.
        if (previous !== 'connected') {
          resync();
        }
      },
      onError: (cause) => {
        if (cause.message === 'INVALID_REALTIME_EVENT') return;
        setRealtimeStatus((current) => (current === 'connected' ? 'error' : current));
      },
    });
    realtimeHandleRef.current = handle;
    return () => {
      if (realtimeHandleRef.current === handle) realtimeHandleRef.current = null;
      void handle.disconnect();
    };
  }, [handleRealtimeEvent, resync, reviewId]);

  useEffect(() => {
    const handleOnline = () => resync();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') resync();
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [resync]);

  async function uploadAttachments(files: File[]): Promise<string[]> {
    if (files.length === 0) return [];
    if (files.length > MAX_COMMENT_ATTACHMENTS) {
      throw new ApiError(400, 'TOO_MANY_ATTACHMENTS', 'too many');
    }
    const uploaded: AssetDto[] = [];
    try {
      for (const file of files) {
        if (!['image/png', 'image/jpeg'].includes(file.type)) {
          throw new ApiError(400, 'UNSUPPORTED_CONTENT_TYPE', 'unsupported');
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          throw new ApiError(413, 'ASSET_TOO_LARGE', 'too large');
        }
        uploaded.push(await uploadProjectAttachment(projectId, file));
      }
      return uploaded.map((asset) => asset.id);
    } catch (cause) {
      // Best effort cleanup for partially uploaded attachments.
      await Promise.allSettled(uploaded.map((asset) => deleteProjectAsset(asset.id)));
      throw cause;
    }
  }

  async function deleteAttachmentsQuietly(assetIds: string[]): Promise<void> {
    await Promise.allSettled(assetIds.map((assetId) => deleteProjectAsset(assetId)));
  }

  async function handleAddPin(body: string, files: File[]): Promise<string | null> {
    if (!selectedVersion || !pinPoint) return messages.project.addPinError;
    let attachmentAssetIds: string[] = [];
    let pinCreated = false;
    try {
      attachmentAssetIds = await uploadAttachments(files);
      const pin = await createVersionPin(reviewId, selectedVersion.id, {
        xPercent: pinPoint.xPercent,
        yPercent: pinPoint.yPercent,
        body,
        attachmentAssetIds: attachmentAssetIds.length > 0 ? attachmentAssetIds : undefined,
      });
      pinCreated = true;
      pinEventAtRef.current.set(pin.id, Date.now());
      if (discussionRef.current?.versionId === selectedVersion.id) {
        commitDiscussion(applyPinMutation(discussionRef.current, pin));
      }
      setSelectedPinId(pin.id);
      setPinPoint(null);
      setNotice(messages.project.pinAdded);
      return null;
    } catch (cause) {
      if (!pinCreated) await deleteAttachmentsQuietly(attachmentAssetIds);
      return apiErrorMessage(cause, messages, messages.project.addPinError);
    }
  }

  async function handleReply(
    pinId: string,
    parentCommentId: string | null,
    body: string,
    files: File[],
  ): Promise<string | null> {
    let attachmentAssetIds: string[] = [];
    let commentCreated = false;
    try {
      attachmentAssetIds = await uploadAttachments(files);
      const comment = await createPinComment<CommentDto>(pinId, {
        body,
        parentCommentId: parentCommentId ?? undefined,
        attachmentAssetIds: attachmentAssetIds.length > 0 ? attachmentAssetIds : undefined,
      });
      commentCreated = true;
      if (discussionRef.current) {
        commitDiscussion(applyCommentMutation(discussionRef.current, comment));
      }
      return null;
    } catch (cause) {
      if (!commentCreated) await deleteAttachmentsQuietly(attachmentAssetIds);
      return apiErrorMessage(cause, messages, messages.project.commentCreateError);
    }
  }

  async function handleEditComment(
    comment: CommentDto,
    body: string,
  ): Promise<string | null> {
    try {
      const updated = await updateComment(comment.id, { body });
      if (discussionRef.current) {
        commitDiscussion(applyCommentMutation(discussionRef.current, updated));
      }
      return null;
    } catch (cause) {
      return apiErrorMessage(cause, messages, messages.project.commentUpdateError);
    }
  }

  async function handleDeleteComment(comment: CommentDto): Promise<string | null> {
    try {
      await deleteComment(comment.id);
      if (discussionRef.current) {
        commitDiscussion(markCommentDeleted(discussionRef.current, comment));
      }
      return null;
    } catch (cause) {
      return apiErrorMessage(cause, messages, messages.project.commentDeleteError);
    }
  }

  async function handleTogglePinStatus(pin: DiscussionPinDto): Promise<string | null> {
    try {
      const updated = await updatePin(pin.id, {
        status: pin.status === 'OPEN' ? 'RESOLVED' : 'OPEN',
      });
      pinEventAtRef.current.set(pin.id, Date.now());
      if (discussionRef.current) {
        commitDiscussion(applyPinMutation(discussionRef.current, updated));
      }
      return null;
    } catch (cause) {
      return apiErrorMessage(cause, messages, messages.project.pinStatusError);
    }
  }

  async function handleDeletePin(pin: DiscussionPinDto): Promise<string | null> {
    try {
      await deletePin(pin.id);
      if (discussionRef.current) {
        commitDiscussion(removePin(discussionRef.current, pin.id));
      }
      pinEventAtRef.current.delete(pin.id);
      setSelectedPinId((previous) => (previous === pin.id ? null : previous));
      setHoveredPinId((previous) => (previous === pin.id ? null : previous));
      return null;
    } catch (cause) {
      return apiErrorMessage(cause, messages, messages.project.pinDeleteError);
    }
  }

  function focusPin(pinId: string) {
    setSelectedPinId(pinId);
    document.getElementById(`pin-marker-${pinId}`)?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'center',
    });
  }

  function selectPin(pinId: string) {
    setSelectedPinId(pinId);
    const firstComment = discussionRef.current?.comments.find(
      (comment) => comment.pinId === pinId,
    );
    const target = firstComment
      ? document.getElementById(`pin-comment-${firstComment.id}`)
      : null;
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  async function handleDecision(note: string): Promise<string | null> {
    if (!decision || !selectedVersion) return messages.project.decisionError;
    try {
      await submitReviewApproval(reviewId, {
        decision,
        versionId: selectedVersion.id,
        note: note.trim() || undefined,
      });
      ownApprovalAtRef.current = Date.now();
      revisionRef.current += 1;
      await refreshThread();
      void loadDiscussion(selectedVersion.id, { silent: true });
      setNotice(messages.project.decisionSaved);
      return null;
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'REVIEW_VERSION_STALE') {
        try {
          const loaded = await refreshThread();
          const newest = loaded?.versions[loaded.versions.length - 1];
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
      revisionRef.current += 1;
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
      revisionRef.current += 1;
      if (uploaded) {
        const createdAsset = uploaded;
        setAssets((previous) => [createdAsset, ...previous]);
      }
      const loaded = await refreshThread();
      const newest = loaded?.versions[loaded.versions.length - 1];
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
      revisionRef.current += 1;
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

  const breadcrumbs = [
    { label: messages.project.breadcrumbProjects, href: '/' },
    {
      label: project?.name ?? messages.project.projectLabel,
      href: `/projects/${projectId}`,
    },
    { label: summary?.title ?? messages.project.breadcrumbThread },
  ];

  if (loading && !thread) {
    return (
      <AppShell
        user={initialUser}
        workspaceId={project?.workspaceId}
        breadcrumbs={breadcrumbs}
      >
        <ThreadSkeleton messages={messages} />
      </AppShell>
    );
  }

  if (!thread || !summary) {
    return (
      <AppShell
        user={initialUser}
        workspaceId={project?.workspaceId}
        breadcrumbs={breadcrumbs}
      >
        <div className="mx-auto flex min-h-[60dvh] max-w-3xl flex-col items-center justify-center px-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">{messages.project.loadError}</h1>
          {errorMessage && <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>}
          <Button type="button" className="mt-4 gap-1.5" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            {messages.project.retry}
          </Button>
        </div>
      </AppShell>
    );
  }

  const statusLabel = reviewStatusLabel(messages, summary.status);
  // Only render the feed/pins that belong to the selected version; an old
  // response must never flash markers from another version while switching.
  const activeDiscussion =
    discussion && discussion.versionId === selectedVersion?.id ? discussion : null;

  return (
    <AppShell user={initialUser} workspaceId={project?.workspaceId} breadcrumbs={breadcrumbs}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-16 sm:px-8">
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
              {isAuthor && isOpen && canWrite && (
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
              {canModerate && isOpen && canWrite && (
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
              {canModerate && canWrite && (
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
          {isOpen && canModerate && canWrite && !allApproved && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {messages.project.closeThreadReason}{' '}
              {messages.project.closeThreadPending}{' '}
              {pendingReviewers.map((item) => item.displayName).join(', ')}
            </p>
          )}
          {isAuthor && isOpen && canWrite && photoLimitReached && (
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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start">
            <div className="min-w-0 space-y-3">
              <Card className="overflow-hidden">
                <ReviewCanvas
                  messages={messages}
                  imageUrl={
                    selectedVersion?.asset ? assetContentUrl(selectedVersion.asset.id) : null
                  }
                  imageAlt={`${summary.title} — ${messages.project.versionLabel} ${selectedVersion?.versionNumber ?? 0}`}
                  pins={activeDiscussion?.pins ?? []}
                  highlightedPinId={highlightedPinId}
                  isClosed={!isOpen}
                  onAddPin={setPinPoint}
                  onHoverPin={setHoveredPinId}
                  onSelectPin={selectPin}
                />
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

              {isOpen && isReviewer && isLatestSelected && canWrite && (
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
            </div>

            <DiscussionPanel
              messages={messages}
              locale={locale}
              discussion={activeDiscussion}
              loading={discussionLoading}
              error={discussionErrorMessage}
              isClosed={!isOpen}
              currentUserId={initialUser.id}
              canModerate={isWorkspaceAdmin}
              highlightedPinId={highlightedPinId}
              realtimeStatus={realtimeStatus}
              onRetry={() => {
                if (selectedVersion?.id) void loadDiscussion(selectedVersion.id);
              }}
              onRetryRealtime={() => {
                realtimeHandleRef.current?.retry();
                resync();
              }}
              onHoverPin={setHoveredPinId}
              onSelectPin={selectPin}
              onFocusPin={focusPin}
              onReply={handleReply}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
              onTogglePinStatus={handleTogglePinStatus}
              onDeletePin={handleDeletePin}
            />
          </div>
        </section>

      <AddPinDialog
        open={pinPoint !== null}
        point={pinPoint}
        messages={messages}
        onOpenChange={(open) => {
          if (!open) setPinPoint(null);
        }}
        onSubmit={handleAddPin}
      />

      <DecisionDialog
        decision={decision}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        messages={messages}
        onSubmit={handleDecision}
      />

      {isAuthor && canWrite && (
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
    </AppShell>
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
      <DialogContent className="sm:max-w-md" closeLabel={messages.project.close}>
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
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        closeLabel={messages.project.close}
      >
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
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        closeLabel={messages.project.close}
      >
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
      <DialogContent className="sm:max-w-md" closeLabel={messages.project.close}>
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
