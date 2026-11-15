import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from './api';
import App from './App';

const originalAdapter = api.defaults.adapter;
const originalFetch = globalThis.fetch;
const receptionist = { id: 'desk-id', name: 'Front Desk', email: 'desk@example.com', role: 'RECEPTIONIST', workspaceTheme: 'forest', active: true };
const owner = { id: 'owner-id', name: 'Shop Owner', email: 'owner@example.com', role: 'OWNER', workspaceTheme: 'forest', active: true };
const operationalSummary = { todaySalesCount: 3, totalProducts: 12, lowStockCount: 2, totalCustomers: 9 };
const analytics = {
  from: '2026-11-14', to: '2026-11-14', generatedAt: '2026-11-14T12:00:00+05:30',
  current: { revenue: 1250, transactions: 3 }, previous: { revenue: 1000, transactions: 2 }, totalCustomers: 9,
  dailySales: [{ date: '2026-11-14', revenue: 1250, transactions: 3 }],
  previousDailySales: [{ date: '2026-11-13', revenue: 1000, transactions: 2 }],
  topProductsByQuantity: [], topProductsByRevenue: [], payments: [],
  inventory: { totalProducts: 12, lowStockProducts: 2, outOfStockProducts: 0, inventoryCostValue: 0 },
  inventoryAttention: [], slowMovingProducts: [], recentActivity: []
};
const analyticsRequests = [];

function renderApp(profile, route = '/') {
  analyticsRequests.length = 0;
  window.history.pushState({}, '', route);
  sessionStorage.setItem('retail-token', 'application-jwt');
  sessionStorage.setItem('retail-token-expires-at', String(Date.now() + 60_000));
  api.defaults.adapter = async config => {
    let data;
    if (config.url.includes('/auth/me')) data = profile;
    else if (config.url.includes('/dashboard/operational')) data = operationalSummary;
    else if (config.url.includes('/dashboard/analytics')) {
      analyticsRequests.push(config.params);
      data = analytics;
    }
    else if (config.url.includes('/dashboard/summary')) data = { todayRevenue: 1250, ...operationalSummary, recentSales: [] };
    else if (config.url.includes('/notifications/unread-count')) data = { count: 0 };
    else if (config.url.includes('/notifications')) data = { content: [], number: 0, size: 15, totalElements: 0, totalPages: 0, first: true, last: true, numberOfElements: 0, empty: true };
    else throw new Error(`Unexpected request: ${config.url}`);
    return { status: 200, statusText: 'OK', headers: {}, config, data };
  };
  globalThis.fetch = vi.fn((_url, options = {}) => new Promise((resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  return render(<App />);
}

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  globalThis.fetch = originalFetch;
  window.history.pushState({}, '', '/');
});

describe('role-based dashboard and navigation', () => {
  it('shows operational metrics and shared navigation to a Receptionist', async () => {
    renderApp(receptionist);
    expect(await screen.findByText('Operational totals for today.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /New Sale/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Sales History' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Team access' })).toBeNull();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows the Owner dashboard and owner navigation to an Owner', async () => {
    renderApp(owner);
    expect(await screen.findByRole('heading', { name: 'Sales over time' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sales History' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Team access' })).toBeTruthy();
    expect(await screen.findByText('₹1,250.00')).toBeTruthy();
  });

  it('reloads all analytics for the selected date range', async () => {
    renderApp(owner);
    await screen.findByRole('heading', { name: 'Sales over time' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Date range' }), { target: { value: '7days' } });

    await waitFor(() => expect(analyticsRequests.length).toBeGreaterThan(1));
    const selectedRange = analyticsRequests.at(-1);
    expect(Date.parse(selectedRange.to) - Date.parse(selectedRange.from)).toBe(6 * 24 * 60 * 60 * 1000);
  });

  it('shows access denied when a Receptionist opens an Owner-only route directly', async () => {
    renderApp(receptionist, '/sales');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeTruthy();
    expect(screen.queryByText('Sales History')).toBeNull();
  });

  it('redirects a signed-out visitor to login when opening a protected route', async () => {
    window.history.pushState({}, '', '/products');
    render(<App />);
    expect(await screen.findByText('Sign in to manage your store workspace.')).toBeTruthy();
  });
});
