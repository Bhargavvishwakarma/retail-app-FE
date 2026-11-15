export default function NotificationBadge({ count }) {
  if (!count) return null;
  const label = count > 99 ? '99+' : String(count);
  return <span className="notification-badge" aria-label={`${count} unread notification${count === 1 ? '' : 's'}`}>{label}</span>;
}
