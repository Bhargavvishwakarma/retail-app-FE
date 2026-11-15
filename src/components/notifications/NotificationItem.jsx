import NotificationIcon from './NotificationIcon';
import { categoryLabel, relativeTime, severityMeta } from '../../utils/notificationUtils';

export default function NotificationItem({ notification, compact = false, onSelect, onMarkAsRead, onDelete, deletePending, onConfirmDelete, onCancelDelete, actionBusy = false }) {
  const severity = severityMeta(notification.severity);
  const ItemContent = <>
    <span className={`notification-icon-wrap notification-icon-${severity.tone}`}><NotificationIcon type={notification.type} /></span>
    <span className="notification-item-copy">
      <span className="notification-item-title-row"><strong>{notification.title || 'Notification'}</strong>{!notification.isRead && <span className="notification-unread-dot" aria-label="Unread" />}</span>
      <span className="notification-item-message">{notification.message || 'There is an update for your workspace.'}</span>
      <span className="notification-item-meta"><span>{categoryLabel(notification.category)}</span><span aria-hidden="true">·</span><time dateTime={notification.createdAt} title={new Date(notification.createdAt).toLocaleString()}>{relativeTime(notification.createdAt)}</time></span>
    </span>
    {!compact && <span className={`notification-severity notification-severity-${severity.tone}`}>{severity.label}</span>}
  </>;

  return <article className={`notification-item notification-item-${severity.tone}${notification.isRead ? ' is-read' : ' is-unread'}${compact ? ' is-compact' : ''}`}>
    {onSelect
      ? <button type="button" className="notification-item-main" onClick={() => onSelect(notification)} disabled={actionBusy}>{ItemContent}</button>
      : <div className="notification-item-main">{ItemContent}</div>}
    {onDelete && !deletePending && <button type="button" className="notification-delete-button" onClick={() => onDelete(notification)} aria-label={`Delete ${notification.title || 'notification'}`} disabled={actionBusy}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 6.25h9M8 6.25V4.5h4v1.75M6.5 6.25l.6 9.25h5.8l.6-9.25M8.5 9v4M11.5 9v4" /></svg>
    </button>}
    {onMarkAsRead && !notification.isRead && !deletePending && <button type="button" className="notification-mark-read-button" onClick={() => onMarkAsRead(notification)} disabled={actionBusy}>Mark read</button>}
    {deletePending && <div className="notification-delete-confirm" role="group" aria-label="Confirm notification deletion">
      <span>Delete this notification?</span><div><button type="button" className="muted" onClick={onCancelDelete} disabled={actionBusy}>Cancel</button><button type="button" className="danger" onClick={() => onConfirmDelete(notification)} disabled={actionBusy}>{actionBusy ? 'Deleting…' : 'Delete'}</button></div>
    </div>}
  </article>;
}
