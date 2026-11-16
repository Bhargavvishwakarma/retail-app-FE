import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { cancelSessionRequests, startSessionRequests } from '../api';
import {
  deleteNotification,
  deleteReadNotifications,
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  streamNotificationEvents
} from './notificationService';

const originalAdapter = api.defaults.adapter;
const originalFetch = globalThis.fetch;

function sseResponse(parts) {
  let index = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => index < parts.length
          ? { value: new TextEncoder().encode(parts[index++]), done: false }
          : { value: undefined, done: true },
        releaseLock: vi.fn()
      })
    }
  };
}

beforeEach(() => {
  sessionStorage.setItem('retail-token', 'stream-jwt');
  startSessionRequests();
  api.defaults.adapter = vi.fn(async config => ({ status: 200, statusText: 'OK', headers: {}, config, data: { count: 4, content: [] } }));
});

afterEach(() => {
  cancelSessionRequests();
  api.defaults.adapter = originalAdapter;
  globalThis.fetch = originalFetch;
});

describe('notification service', () => {
  it('uses the existing authenticated Axios client for history and mutations', async () => {
    await getNotifications({ page: 2, size: 20, category: 'INVENTORY' });
    await getUnreadCount();
    await markNotificationAsRead('one');
    await markAllNotificationsAsRead();
    await deleteNotification('one');
    await deleteReadNotifications();

    const calls = api.defaults.adapter.mock.calls.map(([config]) => ({ method: config.method, url: config.url, params: config.params }));
    expect(calls).toEqual([
      { method: 'get', url: '/notifications', params: { page: 2, size: 20, category: 'INVENTORY' } },
      { method: 'get', url: '/notifications/unread-count', params: undefined },
      { method: 'patch', url: '/notifications/one/read', params: undefined },
      { method: 'patch', url: '/notifications/read-all', params: undefined },
      { method: 'delete', url: '/notifications/one', params: undefined },
      { method: 'delete', url: '/notifications/read', params: undefined }
    ]);
  });

  it('streams named SSE events with the existing bearer token', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(sseResponse([
      'event: connected\ndata: {"connectedAt":"2026-01-01T00:00:00Z"}\n\n',
      'id: notification-1\nevent: notification\ndata: {"id":"notification-1","type":"LOW_STOCK"}\n\n',
      'event: heartbeat\ndata: {"timestamp":"2026-01-01T00:00:01Z"}\n\n'
    ]));
    const received = [];

    await streamNotificationEvents({ signal: new AbortController().signal, onEvent: event => received.push(event) });

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:8080/api/notifications/stream', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer stream-jwt', Accept: 'text/event-stream' })
    }));
    expect(received.map(event => event.event)).toEqual(['connected', 'notification', 'heartbeat']);
    expect(received[1]).toMatchObject({ id: 'notification-1', payload: { id: 'notification-1', type: 'LOW_STOCK' } });
  });

  it('does not end the application session when the stream is forbidden', async () => {
    const unauthorizedEvent = vi.fn();
    window.addEventListener('auth:unauthorized', unauthorizedEvent);
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });

    await expect(streamNotificationEvents({ signal: new AbortController().signal, onEvent: vi.fn() }))
      .rejects.toMatchObject({ status: 403 });
    expect(unauthorizedEvent).not.toHaveBeenCalled();
    window.removeEventListener('auth:unauthorized', unauthorizedEvent);
  });
});
