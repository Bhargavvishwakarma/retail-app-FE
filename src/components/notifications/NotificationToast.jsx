import { useEffect } from 'react';
import NotificationIcon from './NotificationIcon';
import { severityMeta } from '../../utils/notificationUtils';
import { useNotifications } from '../../hooks/useNotifications';

const DISMISS_AFTER_MS = 6_000;

function Toast({ notification, onDismiss }) {
  const severity = severityMeta(notification.severity);
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(notification.id), DISMISS_AFTER_MS);
    return () => window.clearTimeout(timeout);
  }, [notification.id, onDismiss]);

  return <article className={`notification-toast notification-toast-${severity.tone}`} role="status">
    <span className={`notification-icon-wrap notification-icon-${severity.tone}`}><NotificationIcon type={notification.type} /></span>
    <div><strong>{notification.title || 'Important update'}</strong><p>{notification.message || 'There is an update for your workspace.'}</p></div>
    <button type="button" aria-label={`Dismiss ${notification.title || 'notification'}`} onClick={() => onDismiss(notification.id)}>×</button>
  </article>;
}

export default function NotificationToast() {
  const { toasts, dismissToast } = useNotifications();
  if (!toasts.length) return null;
  return <aside className="notification-toast-region" aria-label="Important notifications">{toasts.map(notification => <Toast key={notification.id} notification={notification} onDismiss={dismissToast} />)}</aside>;
}
