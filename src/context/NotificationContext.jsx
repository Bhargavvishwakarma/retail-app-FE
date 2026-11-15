import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth';
import useNotificationStream from '../hooks/useNotificationStream';
import {
  deleteNotification as deleteNotificationRequest,
  deleteReadNotifications,
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead
} from '../services/notificationService';
import { canPresentNotification, isImportantNotification } from '../utils/notificationUtils';

const NotificationContext = createContext(null);
const RECENT_SIZE = 15;
const MAX_SEEN_IDS = 500;
const MAX_TOASTS = 3;

function recentFirst(notifications) {
  return [...notifications].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, RECENT_SIZE);
}

function requestError(error, fallback) {
  return error.response?.data?.detail || error.response?.data?.error || error.message || fallback;
}

export function NotificationProvider({ children }) {
  const { user, sessionRevision } = useAuth();
  const userId = user?.id || null;
  const userRole = user?.role;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const activeUserId = useRef(userId);
  const seenIds = useRef(new Set());
  const toastIds = useRef(new Set());
  const synchronization = useRef(null);

  useEffect(() => {
    activeUserId.current = userId;
    seenIds.current = new Set();
    toastIds.current = new Set();
    synchronization.current = null;
    setNotifications([]);
    setUnreadCount(0);
    setToasts([]);
    setError('');
    setConnectionStatus(userId ? 'connecting' : 'idle');
  }, [userId, userRole]);

  const remember = useCallback(id => {
    if (!id) return false;
    if (seenIds.current.has(id)) return false;
    seenIds.current.add(id);
    if (seenIds.current.size > MAX_SEEN_IDS) {
      const oldest = seenIds.current.values().next().value;
      seenIds.current.delete(oldest);
    }
    return true;
  }, []);

  const fetchNotifications = useCallback(params => getNotifications(params), []);

  const synchronizeNotifications = useCallback(async ({ showLoading = false } = {}) => {
    if (!userId) return null;
    if (synchronization.current) return synchronization.current;
    const accountId = userId;
    if (showLoading) setLoading(true);
    setError('');
    const task = Promise.all([
      getNotifications({ page: 0, size: RECENT_SIZE }),
      getUnreadCount()
    ]).then(([page, count]) => {
      if (activeUserId.current !== accountId) return null;
      const received = Array.isArray(page?.content) ? page.content : [];
      received.forEach(item => remember(item.id));
      setNotifications(current => recentFirst([
        ...received.filter(item => canPresentNotification(item, { role: userRole })),
        ...current.filter(item => !received.some(receivedItem => receivedItem.id === item.id))
      ]));
      setUnreadCount(count);
      return page;
    }).catch(syncError => {
      if (activeUserId.current === accountId) setError(requestError(syncError, 'Notifications could not be synchronized.'));
      throw syncError;
    }).finally(() => {
      if (activeUserId.current === accountId && showLoading) setLoading(false);
      if (synchronization.current === task) synchronization.current = null;
    });
    synchronization.current = task;
    return task;
  }, [remember, userId, userRole]);

  const refreshRecent = useCallback(() => synchronizeNotifications({ showLoading: true }), [synchronizeNotifications]);

  const dismissToast = useCallback(id => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const addIncomingNotification = useCallback(notification => {
    if (!notification?.id || !canPresentNotification(notification, { role: userRole }) || !remember(notification.id)) return false;
    setNotifications(current => recentFirst([notification, ...current.filter(item => item.id !== notification.id)]));
    if (!notification.isRead) setUnreadCount(current => current + 1);
    if (isImportantNotification(notification) && !toastIds.current.has(notification.id)) {
      toastIds.current.add(notification.id);
      setToasts(current => [...current.filter(toast => toast.id !== notification.id), notification].slice(-MAX_TOASTS));
    }
    return true;
  }, [remember, userRole]);

  const markAsRead = useCallback(async (id, knownUnread = true) => {
    const currentNotification = notifications.find(item => item.id === id);
    if (currentNotification?.isRead) return currentNotification;
    const previousNotifications = notifications;
    const previousCount = unreadCount;
    setNotifications(current => current.map(item => item.id === id ? { ...item, isRead: true, readAt: item.readAt || new Date().toISOString() } : item));
    if (currentNotification ? !currentNotification.isRead : knownUnread) setUnreadCount(current => Math.max(0, current - 1));
    try {
      const updated = await markNotificationAsRead(id);
      setNotifications(current => current.map(item => item.id === id ? updated : item));
      remember(id);
      return updated;
    } catch (actionError) {
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
      synchronizeNotifications().catch(() => {});
      throw actionError;
    }
  }, [notifications, unreadCount, remember, synchronizeNotifications]);

  const markAllAsRead = useCallback(async () => {
    const previousNotifications = notifications;
    const previousCount = unreadCount;
    setNotifications(current => current.map(item => item.isRead ? item : { ...item, isRead: true, readAt: new Date().toISOString() }));
    setUnreadCount(0);
    try {
      await markAllNotificationsAsRead();
      return { count: previousCount };
    } catch (actionError) {
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
      synchronizeNotifications().catch(() => {});
      throw actionError;
    }
  }, [notifications, unreadCount, synchronizeNotifications]);

  const deleteNotification = useCallback(async (id, knownUnread = false) => {
    const removed = notifications.find(item => item.id === id);
    const previousNotifications = notifications;
    const previousCount = unreadCount;
    setNotifications(current => current.filter(item => item.id !== id));
    if (removed ? !removed.isRead : knownUnread) setUnreadCount(current => Math.max(0, current - 1));
    try {
      await deleteNotificationRequest(id);
    } catch (actionError) {
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
      synchronizeNotifications().catch(() => {});
      throw actionError;
    }
  }, [notifications, unreadCount, synchronizeNotifications]);

  const clearReadNotifications = useCallback(async () => {
    const previousNotifications = notifications;
    setNotifications(current => current.filter(item => !item.isRead));
    try {
      return await deleteReadNotifications();
    } catch (actionError) {
      setNotifications(previousNotifications);
      synchronizeNotifications().catch(() => {});
      throw actionError;
    }
  }, [notifications, synchronizeNotifications]);

  useEffect(() => {
    if (userId) synchronizeNotifications({ showLoading: true }).catch(() => {});
  }, [userId, synchronizeNotifications]);

  useNotificationStream({
    enabled: Boolean(userId),
    // A refreshed bearer is a new authenticated session for a fetch stream,
    // even when the account id and role stay the same.
    sessionKey: `${userId || ''}:${userRole || ''}:${sessionRevision}`,
    onStatus: setConnectionStatus,
    onNotification: addIncomingNotification,
    // The server intentionally does not replay Last-Event-ID. Reconcile both
    // REST projections on every connection, including a reconnect.
    onConnected: () => synchronizeNotifications().catch(() => {}),
    onAuthError: () => setError('Your notification session has expired.')
  });

  const value = useMemo(() => ({
    notifications, unreadCount, connectionStatus, loading, error, toasts,
    fetchNotifications, refreshRecent, synchronizeNotifications,
    markAsRead, markAllAsRead, deleteNotification, clearReadNotifications,
    addIncomingNotification, dismissToast
  }), [notifications, unreadCount, connectionStatus, loading, error, toasts, fetchNotifications, refreshRecent,
    synchronizeNotifications, markAsRead, markAllAsRead, deleteNotification, clearReadNotifications,
    addIncomingNotification, dismissToast]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}

export function notificationErrorMessage(error, fallback = 'The notification could not be updated.') {
  return requestError(error, fallback);
}
