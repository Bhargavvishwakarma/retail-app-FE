import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import api, { cancelSessionRequests, startSessionRequests } from '../api';
import { NotificationProvider, useNotifications } from './NotificationContext';

const { authState } = vi.hoisted(() => ({
  authState: {
    user: { id: 'owner-id', role: 'OWNER' },
    sessionRevision: 0
  }
}));

vi.mock('../auth', () => ({ useAuth: () => authState }));

const originalAdapter = api.defaults.adapter;
const originalFetch = globalThis.fetch;
const ownerNotification = {
  id: 'owner-only',
  type: 'HIGH_VALUE_SALE',
  category: 'SALES',
  severity: 'HIGH',
  title: 'Owner-only sale',
  message: 'A private sale update',
  isRead: false,
  createdAt: new Date().toISOString()
};
const regularNotification = {
  id: 'regular-update',
  type: 'LOW_STOCK',
  category: 'INVENTORY',
  severity: 'WARNING',
  title: 'Stock update',
  message: 'Stock needs attention',
  isRead: false,
  createdAt: new Date().toISOString()
};

function sseResponse(record, initialEvents = ['event: connected\ndata: {}\n\n']) {
  const queue = initialEvents.map(value => ({
    value: new TextEncoder().encode(value),
    done: false
  }));
  let pendingRead;
  const reader = {
    read: vi.fn(() => {
      if (queue.length) return Promise.resolve(queue.shift());
      return new Promise(resolve => { pendingRead = resolve; });
    }),
    releaseLock: vi.fn()
  };
  const finish = () => {
    if (pendingRead) {
      const resolve = pendingRead;
      pendingRead = null;
      resolve({ value: undefined, done: true });
    } else {
      queue.push({ value: undefined, done: true });
    }
  };

  record.reader = reader;
  record.finish = finish;
  record.signal.addEventListener('abort', finish, { once: true });
  return { ok: true, body: { getReader: () => reader } };
}

function makeNotification(id, title, type = 'LOW_STOCK') {
  return {
    id,
    title,
    type,
    category: 'INVENTORY',
    severity: 'WARNING',
    message: title,
    isRead: false,
    createdAt: new Date().toISOString()
  };
}

function makePage(content) {
  return { number: 0, size: 15, totalElements: content.length, totalPages: 1, content };
}

function ContextConsumer({ name = 'primary' }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  return <section aria-label={`Notifications ${name}`}>
    <output data-testid={`${name}-unread`}>{unreadCount}</output>
    <ul data-testid={`${name}-items`}>
      {notifications.map(item => <li key={item.id}>{item.title}</li>)}
    </ul>
    <button type="button" onClick={() => markAsRead('regular-update')}>Mark one read</button>
    <button type="button" onClick={markAllAsRead}>Mark all read</button>
  </section>;
}

function renderProvider(children = <ContextConsumer />) {
  return render(<NotificationProvider>{children}</NotificationProvider>);
}

function historyRequestCount() {
  return api.defaults.adapter.mock.calls.filter(([config]) => config.url === '/notifications').length;
}

function unreadRequestCount() {
  return api.defaults.adapter.mock.calls.filter(([config]) => config.url === '/notifications/unread-count').length;
}

beforeEach(() => {
  authState.user = { id: 'owner-id', role: 'OWNER' };
  authState.sessionRevision = 0;
  sessionStorage.setItem('retail-token', 'owner-token');
  startSessionRequests();

  const streams = [];
  globalThis.fetch = vi.fn(async (_url, init) => {
    const record = {
      authorization: init.headers.Authorization,
      signal: init.signal
    };
    streams.push(record);
    return sseResponse(record);
  });
  globalThis.notificationStreams = streams;
  api.defaults.adapter = vi.fn(async config => {
    let data;
    if (config.url === '/notifications/unread-count') {
      data = { count: 0 };
    } else if (config.url === '/notifications') {
      data = makePage([]);
    } else if (config.url?.includes('/read')) {
      data = { ...regularNotification, isRead: true };
    } else {
      data = {};
    }
    return { status: 200, statusText: 'OK', headers: {}, config, data };
  });
});

afterEach(() => {
  cancelSessionRequests();
  api.defaults.adapter = originalAdapter;
  globalThis.fetch = originalFetch;
  delete globalThis.notificationStreams;
});

describe('NotificationProvider integration', () => {
  it('restarts exactly one authenticated stream after a JWT revision and releases both readers', async () => {
    const view = renderProvider();
    await waitFor(() => expect(globalThis.notificationStreams).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId('primary-unread').textContent).toBe('0'));

    sessionStorage.setItem('retail-token', 'refreshed-token');
    await act(async () => {
      authState.sessionRevision += 1;
      view.rerender(<NotificationProvider><ContextConsumer /></NotificationProvider>);
    });

    await waitFor(() => expect(globalThis.notificationStreams).toHaveLength(2));
    expect(globalThis.notificationStreams[0].signal.aborted).toBe(true);
    expect(globalThis.notificationStreams.map(stream => stream.authorization)).toEqual([
      'Bearer owner-token',
      'Bearer refreshed-token'
    ]);

    view.unmount();
    await waitFor(() => {
      expect(globalThis.notificationStreams[0].reader.releaseLock).toHaveBeenCalledOnce();
      expect(globalThis.notificationStreams[1].reader.releaseLock).toHaveBeenCalledOnce();
    });
    expect(globalThis.notificationStreams[1].signal.aborted).toBe(true);
    expect(globalThis.notificationStreams).toHaveLength(2);
  });

  it('refreshes history and unread count after reconnect without duplicating notifications', async () => {
    let history = [makeNotification('existing', 'Existing notification')];
    let unreadCount = 1;
    api.defaults.adapter = vi.fn(async config => {
      const data = config.url === '/notifications/unread-count'
        ? { count: unreadCount }
        : makePage(history);
      return { status: 200, statusText: 'OK', headers: {}, config, data };
    });

    renderProvider();
    await screen.findByText('Existing notification');
    await waitFor(() => expect(unreadRequestCount()).toBeGreaterThan(0));
    const historyCallsBeforeReconnect = historyRequestCount();
    const unreadCallsBeforeReconnect = unreadRequestCount();

    history = [
      makeNotification('existing', 'Existing notification'),
      makeNotification('missed', 'Recovered notification')
    ];
    unreadCount = 2;
    act(() => globalThis.notificationStreams[0].finish());

    await screen.findByText('Recovered notification', {}, { timeout: 4_000 });
    await waitFor(() => expect(screen.getByTestId('primary-unread').textContent).toBe('2'));
    expect(historyRequestCount()).toBeGreaterThan(historyCallsBeforeReconnect);
    expect(unreadRequestCount()).toBeGreaterThan(unreadCallsBeforeReconnect);
    expect(screen.getAllByText('Existing notification')).toHaveLength(1);
    expect(screen.getAllByText('Recovered notification')).toHaveLength(1);
  });

  it('clears owner-only cache on role downgrade and uses the receptionist token for new requests', async () => {
    let releaseReceptionistHistory;
    api.defaults.adapter = vi.fn(config => {
      const authorization = config.headers.get?.('Authorization') || config.headers.Authorization;
      if (config.url === '/notifications/unread-count') {
        return Promise.resolve({ status: 200, statusText: 'OK', headers: {}, config, data: { count: 0 } });
      }
      if (authorization === 'Bearer receptionist-token' && config.url === '/notifications') {
        return new Promise(resolve => {
          releaseReceptionistHistory = () => resolve({
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            data: makePage([regularNotification])
          });
        });
      }
      return Promise.resolve({
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: makePage([ownerNotification])
      });
    });

    const view = renderProvider();
    await screen.findByText('Owner-only sale');
    sessionStorage.setItem('retail-token', 'receptionist-token');
    await act(async () => {
      authState.user = { id: 'owner-id', role: 'RECEPTIONIST' };
      view.rerender(<NotificationProvider><ContextConsumer /></NotificationProvider>);
    });

    await waitFor(() => expect(releaseReceptionistHistory).toBeTypeOf('function'));
    expect(screen.queryByText('Owner-only sale')).toBeNull();
    expect(globalThis.notificationStreams).toHaveLength(2);
    expect(globalThis.notificationStreams[0].signal.aborted).toBe(true);
    expect(globalThis.notificationStreams[1].authorization).toBe('Bearer receptionist-token');

    await act(async () => releaseReceptionistHistory());
    expect(await screen.findByText('Stock update')).toBeTruthy();
    const receptionistRequests = api.defaults.adapter.mock.calls.filter(([config]) => {
      const authorization = config.headers.get?.('Authorization') || config.headers.Authorization;
      return authorization === 'Bearer receptionist-token';
    });
    expect(receptionistRequests.length).toBeGreaterThan(0);
  });

  it('aborts the active stream on logout', async () => {
    const view = renderProvider();
    await waitFor(() => expect(globalThis.notificationStreams).toHaveLength(1));

    await act(async () => {
      authState.user = null;
      view.rerender(<NotificationProvider><ContextConsumer /></NotificationProvider>);
    });
    expect(globalThis.notificationStreams[0].signal.aborted).toBe(true);
    expect(globalThis.notificationStreams).toHaveLength(1);
  });

  it('removes stream listeners and aborts the pending stream on unmount, sharing one stream across consumers', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const view = renderProvider(<><ContextConsumer name="first" /><ContextConsumer name="second" /></>);
    await waitFor(() => expect(globalThis.notificationStreams).toHaveLength(1));

    const streamListeners = addListener.mock.calls.filter(([type]) => ['online', 'offline'].includes(type));
    expect(streamListeners).toHaveLength(2);
    expect(screen.getByTestId('first-unread')).toBeTruthy();
    expect(screen.getByTestId('second-unread')).toBeTruthy();
    expect(globalThis.notificationStreams).toHaveLength(1);

    view.unmount();
    expect(globalThis.notificationStreams[0].signal.aborted).toBe(true);
    await waitFor(() => expect(globalThis.notificationStreams[0].reader.releaseLock).toHaveBeenCalledOnce());
    expect(globalThis.notificationStreams).toHaveLength(1);

    for (const [type, listener] of streamListeners) {
      expect(removeListener).toHaveBeenCalledWith(type, listener);
    }
  });

  it('updates the shared unread count when individual and bulk read mutations succeed', async () => {
    let unreadCount = 2;
    let history = [regularNotification, makeNotification('another-unread', 'Another unread')];
    api.defaults.adapter = vi.fn(async config => {
      let data;
      if (config.url === '/notifications/unread-count') {
        data = { count: unreadCount };
      } else if (config.url === '/notifications') {
        data = makePage(history);
      } else if (config.url === '/notifications/regular-update/read') {
        unreadCount = 1;
        history = history.map(item => item.id === 'regular-update' ? { ...item, isRead: true } : item);
        data = { ...regularNotification, isRead: true };
      } else if (config.url === '/notifications/read-all') {
        unreadCount = 0;
        history = history.map(item => ({ ...item, isRead: true }));
        data = { count: 2 };
      } else {
        data = {};
      }
      return { status: 200, statusText: 'OK', headers: {}, config, data };
    });

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('primary-unread').textContent).toBe('2'));
    await act(async () => screen.getByRole('button', { name: 'Mark one read' }).click());
    await waitFor(() => expect(screen.getByTestId('primary-unread').textContent).toBe(String(unreadCount)));

    await act(async () => screen.getByRole('button', { name: 'Mark all read' }).click());
    await waitFor(() => expect(screen.getByTestId('primary-unread').textContent).toBe(String(unreadCount)));
  });
});
