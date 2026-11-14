export const STORE_TIME_ZONE = 'Asia/Kolkata';

export const DATE_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'custom', label: 'Custom range' }
];

export function storeDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyAtUtcMidnight(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateKey, count) {
  const date = dateKeyAtUtcMidnight(dateKey);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function getPresetRange(preset, now = new Date()) {
  const today = storeDateKey(now);
  if (preset === 'yesterday') {
    const yesterday = addDays(today, -1);
    return { from: yesterday, to: yesterday };
  }
  if (preset === '7days') return { from: addDays(today, -6), to: today };
  if (preset === '30days') return { from: addDays(today, -29), to: today };
  if (preset === 'thisMonth') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === 'lastMonth') {
    const firstOfThisMonth = `${today.slice(0, 7)}-01`;
    const lastOfLastMonth = addDays(firstOfThisMonth, -1);
    return { from: `${lastOfLastMonth.slice(0, 7)}-01`, to: lastOfLastMonth };
  }
  return { from: today, to: today };
}

export function isValidDashboardRange(from, to, maxDays = 366) {
  if (!from || !to || from > to) return false;
  const start = dateKeyAtUtcMidnight(from);
  const end = dateKeyAtUtcMidnight(to);
  return (end - start) / 86_400_000 + 1 <= maxDays;
}

export function formatCurrency(value, { compact = false } = {}) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? 'compact' : 'standard'
  }).format(Number(value) || 0);
}

function dateFromApi(value) {
  if (!value) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasZone ? value : `${value}+05:30`);
}

export function formatDateTime(value, locale = 'en-IN') {
  const date = dateFromApi(value);
  return date ? new Intl.DateTimeFormat(locale, {
    timeZone: STORE_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date) : '—';
}

export function formatDateLabel(dateKey, locale = 'en-IN', options = {}) {
  const date = dateKeyAtUtcMidnight(dateKey);
  return new Intl.DateTimeFormat(locale, {
    timeZone: STORE_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    ...options
  }).format(date);
}

export function formatStoreDate(date = new Date(), locale = 'en-IN', options = { dateStyle: 'full' }) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: STORE_TIME_ZONE }).format(date);
}

export function getComparison(current, previous) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  if (previousValue === 0) {
    return currentValue === 0
      ? { direction: 'neutral', label: 'No change from previous period' }
      : { direction: 'positive', label: 'New activity vs previous period' };
  }
  const change = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
  return {
    direction: change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral',
    label: `${change > 0 ? '+' : ''}${change.toFixed(1)}% vs previous period`
  };
}
