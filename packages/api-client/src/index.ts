import type { CommentCreateInput } from '@markerit/validators';

export type ApiFieldError = {
  field: string;
  code: string;
  message: string;
};

export type ApiProblem = {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  instance?: string;
  requestId?: string;
  fieldErrors?: ApiFieldError[];
  retryAfterSeconds?: number;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: ApiFieldError[];
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(status: number, code: string, message: string, problem?: ApiProblem, cause?: unknown) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = Array.isArray(problem?.fieldErrors) ? problem.fieldErrors : [];
    this.requestId = problem?.requestId;
    this.retryAfterSeconds = problem?.retryAfterSeconds;
  }
}

export type ApiRequestOptions = Omit<RequestInit, 'credentials'> & {
  baseUrl?: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export type RegisterAccountResponse = AuthenticatedUser & {
  createdAt: string;
};

export type LoginAccountResponse = AuthenticatedUser & {
  expiresAt: string;
};

export type VerificationChallengeResponse = {
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
};

const defaultBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

function isApiProblem(value: unknown): value is ApiProblem {
  return typeof value === 'object' && value !== null;
}

function problemFrom(value: unknown): ApiProblem {
  return isApiProblem(value) ? value : {};
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { baseUrl = defaultBaseUrl, headers: requestHeaders, ...init } = options;
  const headers = new Headers(requestHeaders);
  headers.set('Accept', 'application/json, application/problem+json');
  // FormData must keep the browser-generated multipart boundary, so the
  // generic JSON content type must not be applied to it.
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body !== undefined && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

  try {
    const response = await fetch(url, { ...init, headers, credentials: 'include' });
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    let payload: unknown;
    if (contentType.includes('json')) {
      try {
        payload = await response.json();
      } catch (cause) {
        throw new ApiError(response.status, 'INVALID_API_RESPONSE', 'Serwer zwrócił nieczytelną odpowiedź.', undefined, cause);
      }
    }

    if (!response.ok) {
      const problem = problemFrom(payload);
      throw new ApiError(
        response.status,
        typeof problem.code === 'string' ? problem.code : 'HTTP_ERROR',
        typeof problem.detail === 'string' && problem.detail.length > 0
          ? problem.detail
          : typeof problem.title === 'string' && problem.title.length > 0
            ? problem.title
            : `Żądanie nie powiodło się (HTTP ${response.status}).`,
        problem,
      );
    }

    if (payload === undefined) {
      throw new ApiError(response.status, 'INVALID_API_RESPONSE', 'Serwer zwrócił odpowiedź bez danych JSON.');
    }
    return payload as T;
  } catch (cause) {
    if (cause instanceof ApiError) {
      throw cause;
    }
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw cause;
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Nie udało się połączyć z API. Sprawdź połączenie i spróbuj ponownie.',
      undefined,
      cause,
    );
  }
}

export type CreatePinCommentInput = CommentCreateInput & {
  /** Up to 10 project attachment ids uploaded through the attachments endpoint. */
  attachmentAssetIds?: string[];
};

export async function createPinComment<TResponse>(
  pinId: string,
  input: CreatePinCommentInput,
): Promise<TResponse> {
  return apiRequest<TResponse>(`pins/${encodeURIComponent(pinId)}/comments`, {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

async function csrfHeaders(): Promise<HeadersInit> {
  const { token } = await apiRequest<{ token: string }>('auth/csrf');
  return { 'X-XSRF-TOKEN': token };
}

export async function registerAccount(
  input: { email: string; password: string },
): Promise<VerificationChallengeResponse> {
  return apiRequest<VerificationChallengeResponse>('auth/register', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function resendVerification(email: string): Promise<VerificationChallengeResponse> {
  return apiRequest<VerificationChallengeResponse>('auth/verification/resend', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmail(email: string, code: string): Promise<LoginAccountResponse> {
  return apiRequest<LoginAccountResponse>('auth/verification/verify', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify({ email, code }),
  });
}

export async function loginAccount(input: { email: string; password: string }): Promise<LoginAccountResponse> {
  return apiRequest<LoginAccountResponse>('auth/login', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

/**
 * Revokes the current API session. Callers that also maintain a Next.js cookie
 * should clear it afterwards (or in a `finally` block) because the API call may
 * fail while the local cookie is still present.
 */
export async function logoutAccount(): Promise<void> {
  await apiRequest<void>('auth/logout', {
    method: 'POST',
    headers: await csrfHeaders(),
  });
}

// ---------------------------------------------------------------------------
// Dashboard: workspaces and projects
// ---------------------------------------------------------------------------

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type ProjectStatus = 'ACTIVE' | 'IN_REVIEW' | 'CLOSED';
export type ProjectTone = 'sage' | 'sand' | 'blue' | 'lilac' | 'emerald' | 'amber';

export type WorkspaceDto = {
  id: string;
  name: string;
  description?: string | null;
  role: WorkspaceRole;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMemberDto = {
  id: string;
  displayName: string;
  initials: string;
};

export type ProjectDto = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  tone: ProjectTone;
  createdBy?: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  openComments: number;
  members: ProjectMemberDto[];
};

export type CreateWorkspaceInput = {
  name: string;
  description?: string;
};

export type UpdateWorkspaceInput = {
  name: string;
  description?: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string;
  tone?: ProjectTone;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  tone?: ProjectTone;
};

export type UserLocale = 'pl' | 'en';

export type UserProfileDto = {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  locale: UserLocale;
  avatarAssetId?: string | null;
  /** Content path relative to the API base URL. */
  avatarUrl?: string | null;
  createdAt: string;
};

export type UpdateMyProfileInput = {
  displayName?: string;
  locale?: UserLocale;
};

export type ChangeMyPasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type RequestEmailChangeInput = {
  newEmail: string;
  currentPassword: string;
};

export type EmailChangeChallengeDto = {
  email: string;
  resendAvailableAt: string;
  expiresAt: string;
};

export function getMyProfile(): Promise<UserProfileDto> {
  return apiRequest<UserProfileDto>('users/me');
}

export async function updateMyProfile(input: UpdateMyProfileInput): Promise<UserProfileDto> {
  return apiRequest<UserProfileDto>('users/me', {
    method: 'PATCH',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function uploadMyAvatar(file: File): Promise<UserProfileDto> {
  const body = new FormData();
  body.append('file', file);
  return apiRequest<UserProfileDto>('users/me/avatar', {
    method: 'POST',
    headers: await csrfHeaders(),
    body,
  });
}

export async function deleteMyAvatar(): Promise<UserProfileDto> {
  return apiRequest<UserProfileDto>('users/me/avatar', {
    method: 'DELETE',
    headers: await csrfHeaders(),
  });
}

export async function changeMyPassword(input: ChangeMyPasswordInput): Promise<void> {
  await apiRequest<void>('users/me/password', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function requestEmailChange(
  input: RequestEmailChangeInput,
): Promise<EmailChangeChallengeDto> {
  return apiRequest<EmailChangeChallengeDto>('users/me/email', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function resendEmailChange(): Promise<EmailChangeChallengeDto> {
  return apiRequest<EmailChangeChallengeDto>('users/me/email/resend', {
    method: 'POST',
    headers: await csrfHeaders(),
  });
}

export async function verifyEmailChange(input: {
  newEmail: string;
  code: string;
}): Promise<UserProfileDto> {
  return apiRequest<UserProfileDto>('users/me/email/verify', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export function listWorkspaces(): Promise<WorkspaceDto[]> {
  return apiRequest<WorkspaceDto[]>('workspaces');
}

export function getWorkspace(workspaceId: string): Promise<WorkspaceDto> {
  return apiRequest<WorkspaceDto>(`workspaces/${encodeURIComponent(workspaceId)}`);
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceDto> {
  return apiRequest<WorkspaceDto>('workspaces', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceInput,
): Promise<WorkspaceDto> {
  return apiRequest<WorkspaceDto>(`workspaces/${encodeURIComponent(workspaceId)}`, {
    method: 'PATCH',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await apiRequest<void>(`workspaces/${encodeURIComponent(workspaceId)}`, {
    method: 'DELETE',
    headers: await csrfHeaders(),
  });
}

export function listProjects(workspaceId: string): Promise<ProjectDto[]> {
  return apiRequest<ProjectDto[]>(`workspaces/${encodeURIComponent(workspaceId)}/projects`);
}

export async function createProject(
  workspaceId: string,
  input: CreateProjectInput,
): Promise<ProjectDto> {
  return apiRequest<ProjectDto>(`workspaces/${encodeURIComponent(workspaceId)}/projects`, {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<ProjectDto> {
  return apiRequest<ProjectDto>(`projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiRequest<void>(`projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
    headers: await csrfHeaders(),
  });
}

// ---------------------------------------------------------------------------
// Project detail: members, review images and review threads
// ---------------------------------------------------------------------------

export type WorkspaceMemberDto = {
  id: string;
  displayName: string;
  email: string;
  initials: string;
  role: WorkspaceRole;
};

export type AssetDto = {
  id: string;
  projectId: string;
  purpose: string;
  contentType: string;
  originalName: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  /** Content path relative to the API base URL. */
  url: string;
  createdAt: string;
};

export type ReviewStatus = 'OPEN' | 'CLOSED';
export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED';

export type ReviewVersionDto = {
  id: string;
  versionNumber: number;
  note?: string | null;
  asset?: AssetDto | null;
  createdAt: string;
  createdByName: string;
};

export type ReviewReviewerDto = {
  userId: string;
  displayName: string;
  initials: string;
  decision?: ReviewDecision | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
};

export type ReviewApprovalDto = {
  userId: string;
  displayName: string;
  versionId: string;
  decision: ReviewDecision;
  note?: string | null;
  createdAt: string;
};

export type ReviewApprovalSummaryDto = {
  approved: number;
  changesRequested: number;
  pending: number;
  total: number;
};

export type ReviewSummaryDto = {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: ReviewStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  closedBy?: string | null;
  closedByName?: string | null;
  latestVersion?: ReviewVersionDto | null;
  /** Reviewer preview included in the list response, so cards avoid a detail request. */
  reviewers?: ReviewReviewerDto[];
  reviewerCount: number;
  approvalSummary: ReviewApprovalSummaryDto;
};

export type ReviewDto = {
  summary: ReviewSummaryDto;
  reviewers: ReviewReviewerDto[];
  versions: ReviewVersionDto[];
  approvals: ReviewApprovalDto[];
};

export type CreateReviewInput = {
  title: string;
  description?: string;
  assetId: string;
  reviewerIds?: string[];
};

export type UpdateReviewInput = {
  title?: string;
  description?: string;
  reviewerIds?: string[];
};

export type CreateReviewVersionInput = {
  assetId: string;
  note?: string;
};

export type SubmitReviewApprovalInput = {
  decision: ReviewDecision;
  /** Version the decision applies to; stale versions are rejected by the API. */
  versionId: string;
  note?: string;
};

export function getProject(projectId: string): Promise<ProjectDto> {
  return apiRequest<ProjectDto>(`projects/${encodeURIComponent(projectId)}`);
}

export function listProjectAssets(projectId: string): Promise<AssetDto[]> {
  return apiRequest<AssetDto[]>(`projects/${encodeURIComponent(projectId)}/assets`);
}

async function uploadFile(path: string, file: File): Promise<AssetDto> {
  const body = new FormData();
  body.append('file', file);
  return apiRequest<AssetDto>(path, {
    method: 'POST',
    // Do not set Content-Type: the browser must add the multipart boundary.
    headers: await csrfHeaders(),
    body,
  });
}

export function uploadProjectAsset(projectId: string, file: File): Promise<AssetDto> {
  return uploadFile(`projects/${encodeURIComponent(projectId)}/assets`, file);
}

export function uploadProjectAttachment(projectId: string, file: File): Promise<AssetDto> {
  return uploadFile(`projects/${encodeURIComponent(projectId)}/attachments`, file);
}

export async function deleteProjectAsset(assetId: string): Promise<void> {
  await apiRequest<void>(`assets/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
    headers: await csrfHeaders(),
  });
}

export function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberDto[]> {
  return apiRequest<WorkspaceMemberDto[]>(`workspaces/${encodeURIComponent(workspaceId)}/members`);
}

export function listProjectReviews(projectId: string): Promise<ReviewSummaryDto[]> {
  return apiRequest<ReviewSummaryDto[]>(`projects/${encodeURIComponent(projectId)}/reviews`);
}

export type WorkspaceFeedbackDto = {
  id: string;
  projectId: string;
  projectName: string;
  projectTone: ProjectTone;
  reviewId: string;
  reviewTitle: string;
  reviewStatus: ReviewStatus;
  versionId: string;
  versionNumber: number;
  asset?: AssetDto | null;
  xPercent: number;
  yPercent: number;
  status: PinStatus;
  authorId?: string | null;
  authorName: string;
  authorInitials: string;
  createdAt: string;
  resolvedBy?: string | null;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
  commentCount: number;
  /** Body of the pin's original note (its first comment). */
  noteBody?: string | null;
  lastCommentBody?: string | null;
  lastCommentAuthorName?: string | null;
  lastCommentAuthorInitials?: string | null;
  lastCommentAt?: string | null;
};

/**
 * Lists pins from the latest version of every review in the workspace,
 * including closed reviews, for the workspace feedback inbox.
 */
export function listWorkspaceFeedback(workspaceId: string): Promise<WorkspaceFeedbackDto[]> {
  return apiRequest<WorkspaceFeedbackDto[]>(
    `workspaces/${encodeURIComponent(workspaceId)}/feedback`,
  );
}

export async function createReview(
  projectId: string,
  input: CreateReviewInput,
): Promise<ReviewDto> {
  return apiRequest<ReviewDto>(`projects/${encodeURIComponent(projectId)}/reviews`, {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export function getReview(reviewId: string): Promise<ReviewDto> {
  return apiRequest<ReviewDto>(`reviews/${encodeURIComponent(reviewId)}`);
}

export async function updateReview(
  reviewId: string,
  input: UpdateReviewInput,
): Promise<ReviewDto> {
  return apiRequest<ReviewDto>(`reviews/${encodeURIComponent(reviewId)}`, {
    method: 'PATCH',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function createReviewVersion(
  reviewId: string,
  input: CreateReviewVersionInput,
): Promise<ReviewVersionDto> {
  return apiRequest<ReviewVersionDto>(`reviews/${encodeURIComponent(reviewId)}/versions`, {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function submitReviewApproval(
  reviewId: string,
  input: SubmitReviewApprovalInput,
): Promise<ReviewApprovalDto> {
  return apiRequest<ReviewApprovalDto>(`reviews/${encodeURIComponent(reviewId)}/approvals`, {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function closeReview(reviewId: string): Promise<ReviewDto> {
  return apiRequest<ReviewDto>(`reviews/${encodeURIComponent(reviewId)}/close`, {
    method: 'POST',
    headers: await csrfHeaders(),
  });
}

export async function deleteReview(reviewId: string): Promise<void> {
  await apiRequest<void>(`reviews/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
    headers: await csrfHeaders(),
  });
}

// ---------------------------------------------------------------------------
// Discussion: pins, comments and review decisions
// ---------------------------------------------------------------------------

export type PinStatus = 'OPEN' | 'RESOLVED';

export type CommentDto = {
  id: string;
  pinId: string;
  parentCommentId?: string | null;
  authorId?: string | null;
  authorName: string;
  authorInitials: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string | null;
  deleted: boolean;
  attachments: AssetDto[];
};

/**
 * A pin with its full visible comment thread. Returned by pin mutations and by
 * the version pins endpoint.
 */
export type PinDto = {
  id: string;
  reviewVersionId: string;
  assetId: string;
  xPercent: number;
  yPercent: number;
  status: PinStatus;
  authorId?: string | null;
  authorName: string;
  authorInitials: string;
  createdAt: string;
  resolvedBy?: string | null;
  resolvedByName?: string | null;
  resolvedAt?: string | null;
  comments: CommentDto[];
};

/** A marker in the discussion payload; comments are sent in a separate list. */
export type DiscussionPinDto = Omit<PinDto, 'reviewVersionId' | 'comments'> & {
  commentCount: number;
};

/** An approval decision rendered as a review item in the discussion feed. */
export type DiscussionReviewDto = {
  id: string;
  reviewId: string;
  versionId: string;
  kind: 'REVIEW';
  decision: ReviewDecision;
  note?: string | null;
  authorId?: string | null;
  authorName: string;
  authorInitials: string;
  createdAt: string;
};

export type DiscussionDto = {
  reviewId: string;
  versionId: string;
  pins: DiscussionPinDto[];
  comments: CommentDto[];
  reviews: DiscussionReviewDto[];
};

export type CreatePinInput = {
  xPercent: number;
  yPercent: number;
  body: string;
  attachmentAssetIds?: string[];
};

export type UpdatePinInput = {
  status: PinStatus;
};

export type UpdateCommentInput = {
  body: string;
};

export function getReviewDiscussion(reviewId: string, versionId: string): Promise<DiscussionDto> {
  return apiRequest<DiscussionDto>(
    `reviews/${encodeURIComponent(reviewId)}/versions/${encodeURIComponent(versionId)}/discussion`,
  );
}

export function listReviewPins(reviewId: string, versionId: string): Promise<PinDto[]> {
  return apiRequest<PinDto[]>(
    `reviews/${encodeURIComponent(reviewId)}/versions/${encodeURIComponent(versionId)}/pins`,
  );
}

export async function createVersionPin(
  reviewId: string,
  versionId: string,
  input: CreatePinInput,
): Promise<PinDto> {
  return apiRequest<PinDto>(
    `reviews/${encodeURIComponent(reviewId)}/versions/${encodeURIComponent(versionId)}/pins`,
    {
      method: 'POST',
      headers: await csrfHeaders(),
      body: JSON.stringify(input),
    },
  );
}

export async function updatePin(pinId: string, input: UpdatePinInput): Promise<PinDto> {
  return apiRequest<PinDto>(`pins/${encodeURIComponent(pinId)}`, {
    method: 'PATCH',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function deletePin(pinId: string): Promise<void> {
  await apiRequest<void>(`pins/${encodeURIComponent(pinId)}`, {
    method: 'DELETE',
    headers: await csrfHeaders(),
  });
}

export async function updateComment(
  commentId: string,
  input: UpdateCommentInput,
): Promise<CommentDto> {
  return apiRequest<CommentDto>(`comments/${encodeURIComponent(commentId)}`, {
    method: 'PATCH',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiRequest<void>(`comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
    headers: await csrfHeaders(),
  });
}
