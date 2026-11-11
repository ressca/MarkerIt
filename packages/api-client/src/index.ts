import type { CommentCreateInput, PinCreateInput } from '@markerit/validators';

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
  if (init.body !== undefined && !headers.has('Content-Type')) {
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

export function createReviewPin<TResponse>(reviewId: string, input: PinCreateInput): Promise<TResponse> {
  return apiRequest<TResponse>(`reviews/${encodeURIComponent(reviewId)}/pins`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createPinComment<TResponse>(pinId: string, input: CommentCreateInput): Promise<TResponse> {
  return apiRequest<TResponse>(`pins/${encodeURIComponent(pinId)}/comments`, {
    method: 'POST',
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
