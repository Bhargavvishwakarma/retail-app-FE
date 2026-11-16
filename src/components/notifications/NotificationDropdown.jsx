import { Link } from 'react-router-dom';
import NotificationEmptyState from './NotificationEmptyState';
import NotificationItem from './NotificationItem';
import { useNotifications } from '../../hooks/useNotifications';

export default function NotificationDropdown({ onClose, onNotificationSelect }) {
  const { notifications, unreadCount, loading, error, markAllAsRead } = useNotifications();
  const markAllDisabled = unreadCount === 0;

  const handleMarkAll = async () => {
    if (markAllDisabled) return;
    try { await markAllAsRead(); }
    catch { /* The shared context preserves optimistic state and the dropdown displays its error. */ }
  };

  return <section className="notification-dropdown" role="dialog" aria-label="Notifications">
    <header className="notification-dropdown-header">
      <div><h2>Notifications</h2><p>{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p></div>
      <div className="notification-dropdown-actions">
        <button type="button" className="notification-text-action" disabled={markAllDisabled} onClick={handleMarkAll}>Mark all read</button>
        <button type="button" className="notification-close-button" aria-label="Close notifications" title="Close notifications" onClick={onClose}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
        </button>
      </div>
    </header>
    {error && <p className="notification-inline-error" role="alert">{error}</p>}
    <div className="notification-dropdown-list" aria-busy={loading}>
      {loading && notifications.length === 0 && <div className="notification-dropdown-loading" role="status"><span className="loading-spinner" aria-hidden="true" />Loading notifications…</div>}
      {!loading && notifications.length === 0 && <NotificationEmptyState />}
      {notifications.map(notification => <NotificationItem key={notification.id} notification={notification} compact onSelect={onNotificationSelect} />)}
    </div>
    <Link className="notification-view-all" to="/notifications" onClick={onClose}>View all notifications <span aria-hidden="true">→</span></Link>
  </section>;
}
