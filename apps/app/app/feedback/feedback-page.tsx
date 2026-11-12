'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  listWorkspaceFeedback,
  listWorkspaces,
  updatePin,
} from '@markerit/api-client';
import type {
  ProjectTone,
  WorkspaceDto,
  WorkspaceFeedbackDto,
} from '@markerit/api-client';
import type { TranslationMessages } from '@markerit/i18n';
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@markerit/ui';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  FolderKanban,
  ImageIcon,
  Inbox,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type { UserProfile } from '../components/types';
import { AppShell } from '../components/app-shell';
import { apiErrorMessage } from '../lib/api-errors';
import { assetContentUrl } from '../lib/assets';
import { formatDateTime } from '../lib/format';
import { useAppLocale } from '../lib/use-app-locale';
import { getActiveWorkspaceId } from '../lib/projects-store';
import { cn } from 'cn';

type StatusFilter = 'OPEN' | 'RESOLVED' | 'ALL';

interface FeedbackPageProps {
  initialUser: UserProfile;
  /** Optional fixtures used by tests and previews. */
  initialWorkspaces?: WorkspaceDto[];
  initialWorkspaceId?: string;
  initialFeedback?: WorkspaceFeedbackDto[];
}

const toneDot: Record<ProjectTone, string> = {
  sage: 'bg-emerald-500',
  sand: 'bg-amber-500',
  blue: 'bg-sky-500',
  lilac: 'bg-violet-500',
  emerald: 'bg-emerald-600',
  amber: 'bg-amber-600',
};

function activityTimestamp(item: WorkspaceFeedbackDto): number {
  const value = item.lastCommentAt ?? item.resolvedAt ?? item.createdAt;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function FeedbackPage({
  initialUser,
  initialWorkspaces,
  initialWorkspaceId,
  initialFeedback,
}: FeedbackPageProps) {
  const { locale, messages } = useAppLocale();
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>(initialWorkspaces ?? []);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(initialWorkspaceId ?? '');
  const [feedback, setFeedback] = useState<WorkspaceFeedbackDto[]>(initialFeedback ?? []);
  const [loading, setLoading] = useState(
    initialWorkspaces === undefined || initialFeedback === undefined,
  );
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [projectFilter, setProjectFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busyPinId, setBusyPinId] = useState<string | null>(null);

  useEffect(() => {
    if (initialWorkspaces !== undefined) return;

    let active = true;
    (async () => {
      try {
        const loaded = await listWorkspaces();
        if (!active) return;
        setWorkspaces(loaded);
        const saved = getActiveWorkspaceId(initialUser.email);
        const selected = loaded.find((workspace) => workspace.id === saved) ?? loaded[0];
        setActiveWorkspaceId(selected?.id ?? '');
        if (!selected) setLoading(false);
      } catch (cause) {
        if (!active) return;
        setError(cause);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [initialUser.email, initialWorkspaces]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    if (initialFeedback !== undefined && activeWorkspaceId === initialWorkspaceId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    listWorkspaceFeedback(activeWorkspaceId)
      .then((items) => {
        if (active) setFeedback(items);
      })
      .catch((cause) => {
        if (active) setError(cause);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeWorkspaceId, initialFeedback, initialWorkspaceId]);

  const currentWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  const reload = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setFeedback(await listWorkspaceFeedback(activeWorkspaceId));
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  async function toggleStatus(item: WorkspaceFeedbackDto) {
    if (item.reviewStatus === 'CLOSED') return;
    setBusyPinId(item.id);
    setError(null);
    try {
      const nextStatus = item.status === 'OPEN' ? 'RESOLVED' : 'OPEN';
      const updated = await updatePin(item.id, { status: nextStatus });
      setFeedback((previous) =>
        previous.map((candidate) =>
          candidate.id === item.id
            ? {
                ...candidate,
                status: updated.status,
                resolvedBy: updated.resolvedBy ?? null,
                resolvedByName: updated.resolvedByName ?? null,
                resolvedAt: updated.resolvedAt ?? null,
              }
            : candidate,
        ),
      );
      setNotice(
        updated.status === 'RESOLVED'
          ? messages.feedback.resolvedNotice
          : messages.feedback.reopenedNotice,
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setBusyPinId(null);
    }
  }

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of feedback) map.set(item.projectId, item.projectName);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'pl'),
    );
  }, [feedback]);

  const openCount = feedback.filter((item) => item.status === 'OPEN').length;
  const resolvedCount = feedback.length - openCount;
  const projectsWithFeedback = new Set(feedback.map((item) => item.projectId)).size;
  const commentCount = feedback.reduce((sum, item) => sum + item.commentCount, 0);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return feedback
      .filter((item) => {
        if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
        if (projectFilter !== 'all' && item.projectId !== projectFilter) return false;
        if (!normalizedQuery) return true;
        return [item.projectName, item.reviewTitle, item.authorName, item.lastCommentBody]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => activityTimestamp(b) - activityTimestamp(a));
  }, [feedback, projectFilter, query, statusFilter]);

  const filtersActive = statusFilter !== 'OPEN' || projectFilter !== 'all' || query.trim() !== '';
  const selectedProjectName =
    projectOptions.find((project) => project.id === projectFilter)?.name ??
    messages.feedback.allProjects;

  function clearFilters() {
    setStatusFilter('OPEN');
    setProjectFilter('all');
    setQuery('');
  }

  const errorMessage = error
    ? apiErrorMessage(error, messages, messages.feedback.loadError)
    : null;
  const showNoWorkspace = !loading && !currentWorkspace;
  const showEmpty = !loading && Boolean(currentWorkspace) && feedback.length === 0;
  const showNoResults = !loading && feedback.length > 0 && filtered.length === 0;

  return (
    <AppShell
      user={initialUser}
      workspaceId={activeWorkspaceId || undefined}
      activeTab="feedback"
      breadcrumbs={[{ label: messages.feedback.breadcrumb }]}
    >
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-16 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {(currentWorkspace?.name ?? 'Workspace').toUpperCase()} ·{' '}
              {messages.feedback.eyebrow.toUpperCase()}
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              <Inbox className="size-6 text-primary" aria-hidden="true" />
              {messages.feedback.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {messages.feedback.description}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reload()}
            disabled={!activeWorkspaceId || loading}
            className="gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            {messages.feedback.refresh}
          </Button>
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
              aria-label="Zamknij komunikat błędu"
              className="size-5 shrink-0 text-destructive hover:bg-destructive/15"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"
          >
            <span className="leading-relaxed">{notice}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setNotice(null)}
              aria-label="Zamknij powiadomienie"
              className="size-5 shrink-0 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<MessageSquare className="size-4" />}
            label={messages.feedback.summaryOpen}
            value={openCount}
            tone="text-amber-600"
          />
          <SummaryCard
            icon={<CheckCircle2 className="size-4" />}
            label={messages.feedback.summaryResolved}
            value={resolvedCount}
            tone="text-emerald-600"
          />
          <SummaryCard
            icon={<FolderKanban className="size-4" />}
            label={messages.feedback.summaryProjects}
            value={projectsWithFeedback}
            tone="text-primary"
          />
          <SummaryCard
            icon={<MessageCircle className="size-4" />}
            label={messages.feedback.summaryComments}
            value={commentCount}
            tone="text-sky-600"
          />
        </div>

        <div className="flex flex-col gap-3 border-b border-border pb-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <TabsList>
              <TabsTrigger value="OPEN">
                {messages.feedback.filterOpen} ({openCount})
              </TabsTrigger>
              <TabsTrigger value="RESOLVED">
                {messages.feedback.filterResolved} ({resolvedCount})
              </TabsTrigger>
              <TabsTrigger value="ALL">
                {messages.feedback.filterAll} ({feedback.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 max-w-52 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    aria-label={messages.feedback.projectFilter}
                  />
                }
              >
                <FolderKanban className="size-3.5" />
                <span className="truncate">{selectedProjectName}</span>
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{messages.feedback.projectFilter}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setProjectFilter('all')}>
                  <span className="flex-1">{messages.feedback.allProjects}</span>
                  {projectFilter === 'all' && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
                {projectOptions.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => setProjectFilter(project.id)}
                  >
                    <span className="flex-1 truncate">{project.name}</span>
                    {projectFilter === project.id && (
                      <Check className="size-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={messages.feedback.searchPlaceholder}
                aria-label={messages.feedback.searchPlaceholder}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </div>

        {!loading && feedback.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {interpolate(messages.feedback.results, {
              count: filtered.length,
              total: feedback.length,
            })}
          </p>
        )}

        {loading ? (
          <FeedbackListSkeleton />
        ) : showNoWorkspace ? (
          <EmptyState
            title={messages.feedback.noWorkspaceTitle}
            description={messages.feedback.noWorkspaceDescription}
          />
        ) : showEmpty ? (
          <EmptyState
            title={messages.feedback.emptyTitle}
            description={messages.feedback.emptyDescription}
          />
        ) : showNoResults ? (
          <EmptyState
            title={messages.feedback.emptyFilteredTitle}
            description={messages.feedback.emptyFilteredDescription}
            action={
              filtersActive ? (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  {messages.feedback.clearFilters}
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-3" aria-live="polite">
            {filtered.map((item) => (
              <FeedbackRow
                key={item.id}
                item={item}
                messages={messages}
                locale={locale}
                busy={busyPinId === item.id}
                onToggleStatus={() => void toggleStatus(item)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card size="sm" className="border-border/80 bg-card/60 shadow-2xs">
      <CardContent className="flex items-center gap-3 p-3">
        <span className={cn('flex size-8 items-center justify-center rounded-lg bg-muted', tone)}>
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-semibold leading-tight text-foreground">{value}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{label}</span>
        </span>
      </CardContent>
    </Card>
  );
}

function FeedbackRow({
  item,
  messages,
  locale,
  busy,
  onToggleStatus,
}: {
  item: WorkspaceFeedbackDto;
  messages: TranslationMessages;
  locale: 'pl' | 'en';
  busy: boolean;
  onToggleStatus: () => void;
}) {
  const threadHref = `/projects/${item.projectId}/reviews/${item.reviewId}`;
  const open = item.status === 'OPEN';
  const reviewClosed = item.reviewStatus === 'CLOSED';
  const commentLabel =
    item.commentCount === 1
      ? messages.feedback.commentsCountOne
      : interpolate(messages.feedback.commentsCount, { count: item.commentCount });

  return (
    <Card
      size="sm"
      className="overflow-hidden transition-colors hover:border-primary/30"
    >
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-36">
          {item.asset ? (
            <img
              src={assetContentUrl(item.asset.id)}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon className="size-7" />
            </span>
          )}
          <span
            aria-hidden="true"
            className={cn(
              'absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md',
              open ? 'bg-amber-500' : 'bg-emerald-500',
            )}
            style={{ left: `${item.xPercent}%`, top: `${item.yPercent}%` }}
          />
          <Badge
            variant="secondary"
            className={cn(
              'absolute left-2 top-2 px-1.5 py-0 text-[10px] font-semibold shadow-xs',
              open
                ? 'bg-amber-500/95 text-white'
                : 'bg-emerald-600/95 text-white',
            )}
          >
            {open ? messages.feedback.statusOpen : messages.feedback.statusResolved}
          </Badge>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <span className={cn('size-2 rounded-full', toneDot[item.projectTone])} />
                  {item.projectName}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {messages.feedback.versionLabel} {item.versionNumber}
                </span>
                {reviewClosed && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {messages.feedback.reviewClosed}
                  </Badge>
                )}
              </div>
              <Link
                href={threadHref}
                className="mt-1 block truncate text-sm font-semibold text-foreground transition-colors hover:text-primary"
              >
                {item.reviewTitle}
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {reviewClosed ? (
                <span className="max-w-40 text-right text-[10px] leading-tight text-muted-foreground">
                  {messages.feedback.closedReviewHint}
                </span>
              ) : (
                <Button
                  type="button"
                  variant={open ? 'outline' : 'secondary'}
                  size="xs"
                  disabled={busy}
                  onClick={onToggleStatus}
                  className="gap-1"
                >
                  {open ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  {busy
                    ? messages.feedback.resolving
                    : open
                      ? messages.feedback.resolve
                      : messages.feedback.reopen}
                </Button>
              )}
              <Link
                href={threadHref}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                {messages.feedback.openThread}
              </Link>
            </div>
          </div>

          {item.lastCommentBody ? (
            <p className="line-clamp-2 rounded-lg bg-muted/50 px-2.5 py-2 text-xs leading-relaxed text-foreground">
              <span className="font-medium text-muted-foreground">
                {interpolate(messages.feedback.lastCommentBy, {
                  name: item.lastCommentAuthorName ?? item.authorName,
                })}
              </span>
              <br />
              {item.lastCommentBody}
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground">{messages.feedback.noComments}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span>{item.authorName}</span>
            <span>{formatDateTime(item.createdAt, locale)}</span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3" />
              {commentLabel}
            </span>
            {!open && item.resolvedByName && item.resolvedAt && (
              <span className="text-emerald-600 dark:text-emerald-400">
                {item.resolvedByName} · {formatDateTime(item.resolvedAt, locale)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeedbackListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} size="sm">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
            <Skeleton className="h-28 w-full rounded-lg sm:h-24 sm:w-36" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center justify-center border-dashed py-14 text-center">
      <CardContent className="flex max-w-md flex-col items-center p-6">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Inbox className="size-7" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}
