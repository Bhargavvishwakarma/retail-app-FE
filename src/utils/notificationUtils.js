export const NOTIFICATION_CATEGORIES = [
  'INVENTORY', 'SALES', 'PURCHASE', 'PAYMENT', 'CUSTOMER', 'SYSTEM'
];

export const NOTIFICATION_SEVERITIES = [
  'INFO', 'SUCCESS', 'WARNING', 'HIGH', 'CRITICAL'
];

export const CATEGORY_LABELS = {
  INVENTORY: 'Inventory',
  SALES: 'Sales',
  PURCHASE: 'Purchases',
  PAYMENT: 'Payments',
  CUSTOMER: 'Customers',
  SYSTEM: 'System'
};

export const SEVERITY_META = {
  INFO: { label: 'Information', tone: 'info' },
  SUCCESS: { label: 'Success', tone: 'success' },
  WARNING: { label: 'Warning', tone: 'warning' },
  HIGH: { label: 'High priority', tone: 'high' },
  CRITICAL: { label: 'Critical', tone: 'critical' }
};

const TYPE_META = {
  LOW_STOCK: { icon: 'stock', toast: true },
  OUT_OF_STOCK: { icon: 'out', toast: true },
  STOCK_REPLENISHED: { icon: 'stock', toast: false },
  STOCK_ADJUSTED: { icon: 'stock', toast: false },
  SALE_COMPLETED: { icon: 'sale', toast: false },
  HIGH_VALUE_SALE: { icon: 'sale', toast: true },
  SALE_CANCELLED: { icon: 'sale', toast: true },
  SALE_RETURNED: { icon: 'sale', toast: true },
  PURCHASE_RECEIVED: { icon: 'purchase', toast: false },
  SUPPLIER_PAYMENT_DUE: { icon: 'payment', toast: true },
  SUPPLIER_PAYMENT_COMPLETED: { icon: 'payment', toast: false },
  CUSTOMER_BIRTHDAY: { icon: 'customer', toast: false },
  CUSTOMER_BALANCE_DUE: { icon: 'customer', toast: true },
  EMPLOYEE_ACTIVITY: { icon: 'system', toast: false }
};

const RECEPTIONIST_HIDDEN_TYPES = new Set([
  'HIGH_VALUE_SALE', 'SUPPLIER_PAYMENT_DUE', 'SUPPLIER_PAYMENT_COMPLETED',
  'CUSTOMER_BALANCE_DUE', 'EMPLOYEE_ACTIVITY'
]);

const ENTITY_ROUTES = {
  PRODUCT: () => '/products',
  CUSTOMER: () => '/customers',
  SALE: (user, notification) => {
    if (user?.role !== 'OWNER') return null;
    return notification?.entityId ? `/sales/${encodeURIComponent(notification.entityId)}` : '/sales';
  }
};

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || 'Other';
}

export function severityMeta(severity) {
  return SEVERITY_META[severity] || SEVERITY_META.INFO;
}

export function notificationTypeMeta(type) {
  return TYPE_META[type] || { icon: 'system', toast: false };
}

export function notificationIcon(type) {
  return notificationTypeMeta(type).icon;
}

export function isImportantNotification(notification) {
  return notificationTypeMeta(notification?.type).toast
    || ['HIGH', 'CRITICAL'].includes(notification?.severity);
}

// This is a defensive presentation guard only. The backend determines a
// recipient's permissions and owns the data returned by every endpoint.
export function canPresentNotification(notification, user) {
  return user?.role !== 'RECEPTIONIST' || !RECEPTIONIST_HIDDEN_TYPES.has(notification?.type);
}

export function notificationEntityRoute(notification, user) {
  return ENTITY_ROUTES[notification?.entityType]?.(user, notification) || null;
}

export function relativeTime(value, now = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function dateKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function groupNotificationsByDay(notifications) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const groups = { Today: [], Yesterday: [], Earlier: [] };
  for (const notification of notifications) {
    const key = dateKey(notification.createdAt);
    if (key === dateKey(today)) groups.Today.push(notification);
    else if (key === dateKey(yesterday)) groups.Yesterday.push(notification);
    else groups.Earlier.push(notification);
  }
  return groups;
}
