'use client';

import { Client, ReconnectionTimeMode } from '@stomp/stompjs';
import type { IFrame, IMessage, StompSubscription } from '@stomp/stompjs';

/**
 * Event payloads published on `/topic/reviews/{reviewId}`. `payload` stays
 * unknown because its shape depends on `payloadType`; the discussion reducer
 * narrows it safely at runtime.
 */
export type ReviewRealtimeEventType =
  | 'PIN_CREATED'
  | 'PIN_UPDATED'
  | 'PIN_DELETED'
  | 'COMMENT_CREATED'
  | 'COMMENT_UPDATED'
  | 'COMMENT_DELETED'
  | 'REVIEW_CREATED'
  | 'REVIEW_UPDATED'
  | 'REVIEW_DELETED'
  | 'VERSION_CREATED'
  | 'APPROVAL_CREATED';

export type ReviewRealtimeEvent = {
  type: ReviewRealtimeEventType | (string & {});
  projectId?: string | null;
  reviewId: string;
  versionId?: string | null;
  pinId?: string | null;
  commentId?: string | null;
  payloadType?: string | null;
  occurredAt?: string | null;
  payload?: unknown;
};

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'unavailable';

/** Minimal STOMP surface the wrapper needs; injectable for tests. */
export interface RealtimeStompClient {
  activate(): void;
  deactivate(options?: { force?: boolean }): Promise<void> | void;
  subscribe(destination: string, callback: (message: IMessage) => void): StompSubscription;
  forceDisconnect?(): void;
  active?: boolean;
  onConnect?: (frame?: IFrame) => void;
  onWebSocketClose?: (event?: unknown) => void;
  onStompError?: (frame: IFrame) => void;
}

export type RealtimeHandle = {
  disconnect: () => Promise<void>;
  /** Manually restarts an exhausted connection after the backoff cap. */
  retry: () => void;
};

export type CreateReviewRealtimeOptions = {
  reviewId: string;
  onEvent: (event: ReviewRealtimeEvent) => void;
  onStatus?: (status: RealtimeStatus) => void;
  onError?: (error: Error) => void;
  /** Injected client for tests; production builds the STOMP client lazily. */
  client?: RealtimeStompClient;
  /** Overrides the derived broker URL. */
  wsUrl?: string;
  /** Overrides `NEXT_PUBLIC_API_URL` when deriving the broker URL. */
  apiUrl?: string;
  /** Overrides the availability check used to no-op in server/jsdom contexts. */
  websocketAvailable?: () => boolean;
};

const DEFAULT_API_URL = 'http://localhost:8080/api/v1';

/** Upper bound for automatic reconnects before the UI offers a manual retry. */
export const MAX_REALTIME_RECONNECT_ATTEMPTS = 8;

const AUTH_CLOSE_CODES = new Set([1008, 4401, 4403]);

function closeLooksUnauthorized(event: unknown): boolean {
  if (typeof event !== 'object' || event === null) return false;
  const candidate = event as { code?: unknown; reason?: unknown };
  if (typeof candidate.code === 'number' && AUTH_CLOSE_CODES.has(candidate.code)) {
    return true;
  }
  return (
    typeof candidate.reason === 'string' &&
    /unauthori[sz]ed|forbidden|401|403/i.test(candidate.reason)
  );
}

function frameLooksUnauthorized(frame: IFrame): boolean {
  const message = `${frame?.body ?? ''} ${frame?.headers?.message ?? ''}`;
  return /unauthori[sz]ed|forbidden|\b401\b|\b403\b/i.test(message);
}

/**
 * Derives the native STOMP endpoint from the HTTP API base URL.
 *
 * `http://localhost:8080/api/v1` becomes `ws://localhost:8080/ws`. The
 * session cookie is sent by the browser automatically during the handshake,
 * so no token is appended to the URL.
 */
export function apiUrlToWebSocketUrl(
  apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL,
  origin?: string,
): string {
  const fallbackOrigin =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080');
  const base = apiUrl?.trim() ? apiUrl : DEFAULT_API_URL;
  const url = new URL(base, fallbackOrigin);
  const path = url.pathname.replace(/\/api\/v\d+\/?$/, '').replace(/\/+$/, '');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${path}/ws`;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function reviewTopic(reviewId: string): string {
  return `/topic/reviews/${reviewId}`;
}

function isRealtimeEvent(value: unknown): value is ReviewRealtimeEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return typeof event.type === 'string' && typeof event.reviewId === 'string';
}

function eventKey(event: ReviewRealtimeEvent): string {
  return [
    event.type,
    event.pinId ?? '',
    event.commentId ?? '',
    event.occurredAt ?? '',
    event.versionId ?? '',
  ].join('|');
}

function defaultWebSocketAvailable(): boolean {
  return typeof window !== 'undefined' && typeof WebSocket !== 'undefined';
}

/**
 * Connects to the review STOMP topic and forwards typed events.
 *
 * The wrapper owns reconnection/backoff, de-duplicates events that arrive more
 * than once, and degrades to a no-op when no WebSocket implementation exists
 * (for example during server rendering or in a bare jsdom test).
 */
export function createReviewRealtime({
  reviewId,
  onEvent,
  onStatus,
  onError,
  client,
  wsUrl,
  apiUrl,
  websocketAvailable = defaultWebSocketAvailable,
}: CreateReviewRealtimeOptions): RealtimeHandle {
  if (!client && !websocketAvailable()) {
    onStatus?.('unavailable');
    return { disconnect: async () => undefined, retry: () => undefined };
  }

  const stomp =
    client ??
    new Client({
      brokerURL: wsUrl ?? apiUrlToWebSocketUrl(apiUrl),
      connectionTimeout: 8_000,
      reconnectDelay: 1_000,
      maxReconnectDelay: 30_000,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      // The server only pushes events; no client heartbeats are required.
      heartbeatOutgoing: 0,
      debug: () => undefined,
    });

  let stopped = false;
  let reconnectAttempts = 0;
  let subscription: StompSubscription | null = null;
  const seen = new Set<string>();
  const seenOrder: string[] = [];
  const MAX_SEEN = 250;

  function remember(key: string): boolean {
    if (seen.has(key)) return false;
    seen.add(key);
    seenOrder.push(key);
    if (seenOrder.length > MAX_SEEN) {
      const oldest = seenOrder.shift();
      if (oldest) seen.delete(oldest);
    }
    return true;
  }

  function stopExhausted(message: string): void {
    stopped = true;
    try {
      subscription?.unsubscribe();
    } finally {
      subscription = null;
      onStatus?.('unavailable');
      onError?.(new Error(message));
      void stomp.deactivate();
    }
  }

  stomp.onConnect = () => {
    if (stopped) return;
    reconnectAttempts = 0;
    onStatus?.('connected');
    try {
      subscription?.unsubscribe();
    } finally {
      subscription = null;
    }
    subscription = stomp.subscribe(reviewTopic(reviewId), (message) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.body);
      } catch {
        onError?.(new Error('INVALID_REALTIME_EVENT'));
        return;
      }
      if (!isRealtimeEvent(parsed)) {
        onError?.(new Error('INVALID_REALTIME_EVENT'));
        return;
      }
      if (parsed.reviewId !== reviewId) return;
      if (!remember(eventKey(parsed))) return;
      onEvent(parsed);
    });
  };

  stomp.onWebSocketClose = (event?: unknown) => {
    if (stopped) return;
    subscription = null;
    reconnectAttempts += 1;
    if (closeLooksUnauthorized(event)) {
      stopExhausted('REALTIME_UNAUTHORIZED');
      return;
    }
    if (reconnectAttempts >= MAX_REALTIME_RECONNECT_ATTEMPTS) {
      stopExhausted('REALTIME_RECONNECT_EXHAUSTED');
      return;
    }
    onStatus?.('disconnected');
  };

  stomp.onStompError = (frame) => {
    if (stopped) return;
    subscription = null;
    if (frameLooksUnauthorized(frame)) {
      stopExhausted('REALTIME_UNAUTHORIZED');
      return;
    }
    onStatus?.('error');
    onError?.(new Error(frame?.body || frame?.headers?.message || 'REALTIME_ERROR'));
    // An ERROR frame closes the connection on the server; force the socket
    // down so stompjs schedules the next exponential-backoff reconnect.
    stomp.forceDisconnect?.();
  };

  function retry(): void {
    if (!stopped) return;
    stopped = false;
    reconnectAttempts = 0;
    onStatus?.('connecting');
    stomp.activate();
  }

  onStatus?.('connecting');
  stomp.activate();

  return {
    retry,
    disconnect: async () => {
      stopped = true;
      try {
        subscription?.unsubscribe();
      } finally {
        subscription = null;
        await stomp.deactivate();
      }
    },
  };
}
