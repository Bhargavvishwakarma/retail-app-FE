export default function NotificationEmptyState({ filtered = false }) {
  return <div className="notification-empty-state">
    <span className="notification-empty-icon" aria-hidden="true">✓</span>
    <strong>{filtered ? 'No matching notifications' : 'You’re all caught up'}</strong>
    <p>{filtered ? 'Try adjusting the filters to see more notifications.' : 'New updates for your workspace will appear here.'}</p>
  </div>;
}
