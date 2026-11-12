import { describe, expect, it, vi } from 'vitest';
import type { IMessage, StompSubscription } from '@stomp/stompjs';
import {
  apiUrlToWebSocketUrl,
  createReviewRealtime,
  reviewTopic,
  type RealtimeStatus,
  type RealtimeStompClient,
  type ReviewRealtimeEvent,
} from './realtime';

class FakeClient implements RealtimeStompClient {
  onConnect?: () => void;
  onWebSocketClose?: (event?: unknown) => void;
  onStompError?: (frame: { body?: string; headers?: Record<string, string> }) => void;
  active = false;
  readonly subscribe = vi.fn();
  readonly activate = vi.fn(() => {
    this.active = true;
  });
  readonly deactivate = vi.fn(async () => {
    this.active = false;
  });
  readonly forceDisconnect = vi.fn();
  lastCallback: ((message: IMessage) => void) | null = null;

  constructor() {
    this.subscribe.mockImplementation(
      (_destination: string, callback: (message: IMessage) => void) => {
        this.lastCallback = callback;
        return { id: 'subscription-1', unsubscribe: vi.fn() } as StompSubscription;
      },
    );
  }

  emit(body: string) {
    this.lastCallback?.({ body } as IMessage);
  }
}

const makeEvent = (overrides: Partial<ReviewRealtimeEvent> = {}): ReviewRealtimeEvent => ({
  type: 'PIN_CREATED',
  reviewId: 'review-1',
  versionId: 'version-1',
  pinId: 'pin-1',
  occurredAt: '2026-11-11T10:00:00Z',
  payloadType: 'PIN',
  payload: { id: 'pin-1' },
  ...overrides,
});

describe('realtime URL helpers', () => {
  it('derives the native STOMP endpoint from the API base URL', () => {
    expect(apiUrlToWebSocketUrl('http://localhost:8080/api/v1')).toBe(
      'ws://localhost:8080/ws',
    );
    expect(apiUrlToWebSocketUrl('https://api.example.com/api/v1/')).toBe(
      'wss://api.example.com/ws',
    );
    expect(apiUrlToWebSocketUrl(undefined, 'https://app.example.com')).toBe(
      'ws://localhost:8080/ws',
    );
    expect(apiUrlToWebSocketUrl('/api/v2', 'https://app.example.com')).toBe(
      'wss://app.example.com/ws',
    );
    expect(reviewTopic('review-1')).toBe('/topic/reviews/review-1');
  });
});

describe('createReviewRealtime', () => {
  it('connects, subscribes to the review topic and forwards parsed events', () => {
    const client = new FakeClient();
    const statuses: RealtimeStatus[] = [];
    const events: ReviewRealtimeEvent[] = [];
    const realtime = createReviewRealtime({
      reviewId: 'review-1',
      client,
      onEvent: (event) => events.push(event),
      onStatus: (status) => statuses.push(status),
    });

    expect(client.activate).toHaveBeenCalledOnce();
    expect(statuses).toEqual(['connecting']);

    client.onConnect?.();
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(client.subscribe).toHaveBeenCalledWith(
      '/topic/reviews/review-1',
      expect.any(Function),
    );

    const event = makeEvent();
    client.emit(JSON.stringify(event));
    expect(events).toEqual([event]);

    // The same event delivered twice (for example reconnect replay) is ignored.
    client.emit(JSON.stringify(event));
    expect(events).toHaveLength(1);

    // Events for another review are ignored as well.
    client.emit(JSON.stringify(makeEvent({ reviewId: 'review-2', occurredAt: 'later' })));
    expect(events).toHaveLength(1);

    void realtime.disconnect();
    expect(client.deactivate).toHaveBeenCalled();
  });

  it('deduplicates events without an occurredAt and accepts distinct events', () => {
    const client = new FakeClient();
    const events: ReviewRealtimeEvent[] = [];
    createReviewRealtime({
      reviewId: 'review-1',
      client,
      onEvent: (event) => events.push(event),
    });
    client.onConnect?.();
    client.emit(JSON.stringify(makeEvent({ occurredAt: null })));
    client.emit(JSON.stringify(makeEvent({ occurredAt: null })));
    client.emit(
      JSON.stringify(makeEvent({ type: 'COMMENT_CREATED', pinId: 'pin-1', commentId: 'c-1' })),
    );
    expect(events).toHaveLength(2);
  });

  it('reports malformed messages, websocket disconnects and STOMP errors', () => {
    const client = new FakeClient();
    const statuses: RealtimeStatus[] = [];
    const errors: Error[] = [];
    createReviewRealtime({
      reviewId: 'review-1',
      client,
      onEvent: vi.fn(),
      onStatus: (status) => statuses.push(status),
      onError: (error) => errors.push(error),
    });
    client.onConnect?.();

    client.emit('not-json');
    client.emit(JSON.stringify({ hello: 'world' }));
    expect(errors.map((error) => error.message)).toEqual([
      'INVALID_REALTIME_EVENT',
      'INVALID_REALTIME_EVENT',
    ]);

    client.onWebSocketClose?.();
    expect(statuses).toContain('disconnected');

    client.onStompError?.({ body: 'broker rejected subscription' });
    expect(statuses).toContain('error');
    expect(errors.at(-1)?.message).toBe('broker rejected subscription');
    expect(client.forceDisconnect).toHaveBeenCalled();
  });

  it('caps reconnect attempts and allows a manual retry', () => {
    const client = new FakeClient();
    const statuses: RealtimeStatus[] = [];
    const errors: Error[] = [];
    const realtime = createReviewRealtime({
      reviewId: 'review-1',
      client,
      onEvent: vi.fn(),
      onStatus: (status) => statuses.push(status),
      onError: (error) => errors.push(error),
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      client.onWebSocketClose?.();
    }

    expect(statuses.at(-1)).toBe('unavailable');
    expect(errors.at(-1)?.message).toBe('REALTIME_RECONNECT_EXHAUSTED');
    expect(client.deactivate).toHaveBeenCalled();

    realtime.retry();
    expect(statuses.at(-1)).toBe('connecting');
    expect(client.activate).toHaveBeenCalledTimes(2);
  });

  it('stops reconnecting immediately on an unauthorized close', () => {
    const client = new FakeClient();
    const statuses: RealtimeStatus[] = [];
    const errors: Error[] = [];
    createReviewRealtime({
      reviewId: 'review-1',
      client,
      onEvent: vi.fn(),
      onStatus: (status) => statuses.push(status),
      onError: (error) => errors.push(error),
    });

    client.onWebSocketClose?.({ code: 1008, reason: 'Unauthorized' });

    expect(statuses.at(-1)).toBe('unavailable');
    expect(errors.at(-1)?.message).toBe('REALTIME_UNAUTHORIZED');
    expect(client.deactivate).toHaveBeenCalled();
  });

  it('no-ops when no WebSocket implementation is available', async () => {
    const statuses: RealtimeStatus[] = [];
    const realtime = createReviewRealtime({
      reviewId: 'review-1',
      websocketAvailable: () => false,
      onEvent: vi.fn(),
      onStatus: (status) => statuses.push(status),
    });

    expect(statuses).toEqual(['unavailable']);
    realtime.retry();
    await expect(realtime.disconnect()).resolves.toBeUndefined();
  });
});
