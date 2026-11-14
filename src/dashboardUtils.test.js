import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDateTime, getComparison, getPresetRange, isValidDashboardRange, storeDateKey } from './dashboardUtils';

describe('dashboard date and metric formatting', () => {
  it('uses the store calendar day when the browser is in another timezone', () => {
    expect(storeDateKey(new Date('2026-11-13T20:00:00.000Z'))).toBe('2026-11-14');
    expect(getPresetRange('yesterday', new Date('2026-11-13T20:00:00.000Z')))
      .toEqual({ from: '2026-11-13', to: '2026-11-13' });
  });

  it('calculates month ranges across year boundaries', () => {
    const now = new Date('2026-01-10T10:00:00.000Z');
    expect(getPresetRange('thisMonth', now)).toEqual({ from: '2026-01-01', to: '2026-01-10' });
    expect(getPresetRange('lastMonth', now)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('formats currency in INR and labels a new comparison period', () => {
    expect(formatCurrency(123456.5)).toBe('₹1,23,456.50');
    expect(getComparison(5, 0)).toEqual({ direction: 'positive', label: 'New activity vs previous period' });
    expect(getComparison(90, 100)).toEqual({ direction: 'negative', label: '-10.0% vs previous period' });
  });

  it('limits custom dashboard ranges to one year', () => {
    expect(isValidDashboardRange('2025-11-14', '2026-11-14')).toBe(true);
    expect(isValidDashboardRange('2025-11-13', '2026-11-14')).toBe(false);
    expect(isValidDashboardRange('2026-11-15', '2026-11-14')).toBe(false);
  });

  it('interprets stored local timestamps in the store timezone', () => {
    expect(formatDateTime('2026-11-14T09:15:00', 'en-IN')).toContain('9:15 am');
  });
});
