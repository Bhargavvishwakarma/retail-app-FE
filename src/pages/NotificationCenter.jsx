import { useEffect, useMemo, useState } from 'react';
import LoadingStatus from '../components/LoadingStatus';
import Pagination from '../components/Pagination';
import NotificationEmptyState from '../components/notifications/NotificationEmptyState';
import NotificationFilters from '../components/notifications/NotificationFilters';
import NotificationItem from '../components/notifications/NotificationItem';
import { notificationErrorMessage, useNotifications } from '../context/NotificationContext';
import { useAuth } from '../auth';
import { canPresentNotification, groupNotificationsByDay } from '../utils/notificationUtils';

const PAGE_SIZE = 20;
const EMPTY_PAGE = { content: [], number: 0, totalElements: 0, totalPages: 0 };

function streamLabel(status) {
  if (status === 'connected') return 'Live updates connected';
  if (status === 'reconnecting') return 'Reconnecting live updates…';
  if (status === 'offline') return 'Offline — updates will sync when you reconnect';
  if (status === 'error') return 'Live updates are unavailable';
  return 'Connecting live updates…';
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const { fetchNotifications, markAsRead, markAllAsRead, deleteNotification, clearReadNotifications, connectionStatus } = useNotifications();
  const [filters, setFilters] = useState({ category: '', severity: '', isRead: '' });
  const [page, setPage] = useState(0);
  const [response, setResponse] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [clearConfirmation, setClearConfirmation] = useState(false);
  const [actionId, setActionId] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    fetchNotifications({
      page,
      size: PAGE_SIZE,
      category: filters.category || undefined,
      severity: filters.severity || undefined,
      isRead: filters.isRead === '' ? undefined : filters.isRead === 'true'
    }).then(next => {
      if (current) setResponse({ ...EMPTY_PAGE, ...next, content: Array.isArray(next?.content) ? next.content : [] });
    }).catch(requestFailure => {
      if (current) setError(notificationErrorMessage(requestFailure, 'Notifications could not be loaded.'));
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [fetchNotifications, filters, page, reloadKey]);

  const updateFilters = next => {
    setFilters(next);
    setPage(0);
    setPendingDeleteId(null);
  };

  const visibleContent = useMemo(() => response.content.filter(notification => canPresentNotification(notification, user)), [response.content, user]);
  const groups = useMemo(() => groupNotificationsByDay(visibleContent), [visibleContent]);
  const hasReadNotification = visibleContent.some(notification => notification.isRead);

  const handleMarkRead = async notification => {
    setActionId(notification.id);
    setError('');
    try {
      const updated = await markAsRead(notification.id, !notification.isRead);
      setResponse(current => ({ ...current, content: current.content
        .map(item => item.id === notification.id ? updated : item)
        .filter(item => filters.isRead !== 'false' || item.isRead === false) }));
      // The mutation response is a NotificationResponse, not a PageResponse.
      // Re-read the active server-side page to correct its total and fill any
      // row removed from an unread filter.
      setReloadKey(value => value + 1);
    } catch (actionError) {
      setError(notificationErrorMessage(actionError));
    } finally { setActionId(''); }
  };

  const handleMarkAll = async () => {
    setActionId('all');
    setError('');
    try {
      await markAllAsRead();
      setResponse(current => ({ ...current, content: current.content
        .map(item => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() }))
        .filter(item => filters.isRead !== 'false') }));
      setReloadKey(value => value + 1);
    } catch (actionError) {
      setError(notificationErrorMessage(actionError));
    } finally { setActionId(''); }
  };

  const handleDelete = async notification => {
    setActionId(notification.id);
    setError('');
    try {
      await deleteNotification(notification.id, !notification.isRead);
      setPendingDeleteId(null);
      setReloadKey(value => value + 1);
    } catch (actionError) {
      setError(notificationErrorMessage(actionError, 'Notification could not be deleted.'));
    } finally { setActionId(''); }
  };

  const handleClearRead = async () => {
    setActionId('clear');
    setError('');
    try {
      await clearReadNotifications();
      setClearConfirmation(false);
      setReloadKey(value => value + 1);
    } catch (actionError) {
      setError(notificationErrorMessage(actionError, 'Read notifications could not be cleared.'));
    } finally { setActionId(''); }
  };

  return <section className="notification-center-page">
    <header className="notification-center-heading">
      <div><span className="eyebrow">WORKSPACE UPDATES</span><h1>Notifications</h1><p>Keep track of inventory, sales, and operational activity.</p></div>
      <span className={`notification-connection-status notification-connection-${connectionStatus}`} role="status">{streamLabel(connectionStatus)}</span>
    </header>
    <div className="notification-center-toolbar">
      <NotificationFilters filters={filters} onChange={updateFilters} />
      <div className="notification-center-actions">
        <button type="button" className="muted" onClick={handleMarkAll} disabled={actionId !== '' || !response.content.some(item => !item.isRead)}>{actionId === 'all' ? 'Marking…' : 'Mark all read'}</button>
        <button type="button" className="notification-clear-button" onClick={() => setClearConfirmation(true)} disabled={actionId !== '' || !hasReadNotification}>Clear read</button>
      </div>
    </div>
    {clearConfirmation && <div className="notification-clear-confirm" role="alertdialog" aria-label="Clear read notifications">
      <div><strong>Clear all read notifications?</strong><p>This removes read notifications from your history. Unread notifications will be kept.</p></div>
      <div><button type="button" className="muted" onClick={() => setClearConfirmation(false)} disabled={actionId === 'clear'}>Cancel</button><button type="button" className="danger" onClick={handleClearRead} disabled={actionId === 'clear'}>{actionId === 'clear' ? 'Clearing…' : 'Clear read'}</button></div>
    </div>}
    {error && <div className="notification-page-error" role="alert"><span>!</span><p>{error}</p><button type="button" className="muted" onClick={() => setReloadKey(value => value + 1)}>Try again</button></div>}
    <div className="notification-history" aria-busy={loading}>
      {loading && <LoadingStatus>Loading notifications…</LoadingStatus>}
      {!loading && !error && visibleContent.length === 0 && <NotificationEmptyState filtered={Boolean(filters.category || filters.severity || filters.isRead)} />}
      {!loading && visibleContent.length > 0 && Object.entries(groups).map(([label, notifications]) => notifications.length > 0 && <section className="notification-day-group" key={label} aria-labelledby={`notification-group-${label}`}>
        <h2 id={`notification-group-${label}`}>{label}</h2>
        <div>{notifications.map(notification => <NotificationItem key={notification.id} notification={notification} onMarkAsRead={handleMarkRead} onDelete={() => setPendingDeleteId(notification.id)} deletePending={pendingDeleteId === notification.id} onConfirmDelete={handleDelete} onCancelDelete={() => setPendingDeleteId(null)} actionBusy={Boolean(actionId) && actionId !== notification.id} />)}</div>
      </section>)}
    </div>
    {!loading && response.totalElements > 0 && <Pagination page={response.number} size={response.size || PAGE_SIZE} total={response.totalElements} onPageChange={nextPage => { setPage(nextPage); setPendingDeleteId(null); }} />}
  </section>;
}
