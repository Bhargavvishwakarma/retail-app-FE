import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationBadge from './NotificationBadge';
import NotificationDropdown from './NotificationDropdown';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../auth';
import { notificationEntityRoute } from '../../utils/notificationUtils';

export default function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount, refreshRecent, markAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = event => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        root.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) refreshRecent().catch(() => {});
  };

  const selectNotification = async notification => {
    try {
      if (!notification.isRead) await markAsRead(notification.id);
      const route = notificationEntityRoute(notification, user);
      if (route) navigate(route);
      setOpen(false);
    } catch {
      // Keep the dropdown open so its shared error state remains available.
    }
  };

  return <div className="notification-bell-wrap" ref={root}>
    <button type="button" className={`notification-bell${unreadCount ? ' has-unread' : ''}`} aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'} aria-expanded={open} aria-haspopup="dialog" onClick={toggle}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 8.25c0-3.2-2.1-5.5-5.5-5.5s-5.5 2.3-5.5 5.5v3.1L3 13v1.25h14V13l-1.5-1.65v-3.1ZM8 16.25h4" /></svg>
      <NotificationBadge count={unreadCount} />
    </button>
    {open && <NotificationDropdown onClose={() => setOpen(false)} onNotificationSelect={selectNotification} />}
  </div>;
}
