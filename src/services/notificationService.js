import api, { getSessionToken } from '../api';

const NOTIFICATION_PATH = '/notifications';

export class NotificationStreamError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'NotificationStreamError';
    this.status = status;
  }
}

export async function getNotifications(params = {}) {
  const response = await api.get(NOTIFICATION_PATH, { params });
  return response.data;
}

export async function getUnreadCount() {
  const response = await api.get(`${NOTIFICATION_PATH}/unread-count`);
  return Number(response.data?.count || 0);
}

export async function markNotificationAsRead(id) {
  const response = await api.patch(`${NOTIFICATION_PATH}/${id}/read`);
  return response.data;
}

export async function markAllNotificationsAsRead() {
  const response = await api.patch(`${NOTIFICATION_PATH}/read-all`);
  return response.data;
}

export async function deleteNotification(id) {
  await api.delete(`${NOTIFICATION_PATH}/${id}`);
}

export async function deleteReadNotifications() {
  const response = await api.delete(`${NOTIFICATION_PATH}/read`);
  return response.data;
}

function notificationStreamUrl() {
  const baseUrl = api.defaults.baseURL || '/api';
  return new URL(`${String(baseUrl).replace(/\/$/, '')}${NOTIFICATION_PATH}/stream`, window.location.origin).toString();
}

function dispatchUnauthorized() {
  window.dispatchEvent(new Event('auth:unauthorized'));
}

function parseEvent(block) {
  const event = { event: 'message', data: '', id: '' };
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') event.event = value;
    else if (field === 'id') event.id = value;
    else if (field === 'data') event.data += `${event.data ? '\n' : ''}${value}`;
  }
  if (!event.data) return null;
  try { event.payload = JSON.parse(event.data); }
  catch { event.payload = event.data; }
  return event;
}

/**
 * Streams named SSE events with the current bearer token. The server does not
 * replay Last-Event-ID, so callers must reconcile via the REST history APIs
 * when a connection is opened or re-opened.
 */
export async function streamNotificationEvents({ signal, onEvent }) {
  const token = getSessionToken();
  if (!token) {
    dispatchUnauthorized();
    throw new NotificationStreamError('Your notification session has ended.', 401);
  }

  const response = await fetch(notificationStreamUrl(), {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`
    },
    signal
  });

  if (!response.ok) {
    if (response.status === 401) dispatchUnauthorized();
    throw new NotificationStreamError('Notification stream could not be opened.', response.status);
  }
  if (!response.body) throw new NotificationStreamError('Notification stream is unavailable.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      let boundary;
      while ((boundary = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, '');
        const event = parseEvent(block);
        if (event) onEvent(event);
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const event = parseEvent(buffer);
      if (event) onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
}
