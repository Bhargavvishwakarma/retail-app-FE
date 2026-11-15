import { NOTIFICATION_CATEGORIES, NOTIFICATION_SEVERITIES, categoryLabel, severityMeta } from '../../utils/notificationUtils';

export default function NotificationFilters({ filters, onChange }) {
  return <div className="notification-filters" aria-label="Filter notifications">
    <label><span>Status</span><select value={filters.isRead} onChange={event => onChange({ ...filters, isRead: event.target.value })}>
      <option value="">All notifications</option><option value="false">Unread</option><option value="true">Read</option>
    </select></label>
    <label><span>Category</span><select value={filters.category} onChange={event => onChange({ ...filters, category: event.target.value })}>
      <option value="">All categories</option>{NOTIFICATION_CATEGORIES.map(category => <option key={category} value={category}>{categoryLabel(category)}</option>)}
    </select></label>
    <label><span>Severity</span><select value={filters.severity} onChange={event => onChange({ ...filters, severity: event.target.value })}>
      <option value="">All severities</option>{NOTIFICATION_SEVERITIES.map(severity => <option key={severity} value={severity}>{severityMeta(severity).label}</option>)}
    </select></label>
  </div>;
}
