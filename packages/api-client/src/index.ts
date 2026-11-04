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
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: ApiFieldError[];
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, problem?: ApiProblem, cause?: unknown) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = Array.isArray(problem?.fieldErrors) ? problem.fieldErrors : [];
    this.requestId = problem?.requestId;
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
): Promise<RegisterAccountResponse> {
  return apiRequest<RegisterAccountResponse>('auth/register', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}

export async function loginAccount(input: { email: string; password: string }): Promise<LoginAccountResponse> {
  return apiRequest<LoginAccountResponse>('auth/login', {
    method: 'POST',
    headers: await csrfHeaders(),
    body: JSON.stringify(input),
  });
}
