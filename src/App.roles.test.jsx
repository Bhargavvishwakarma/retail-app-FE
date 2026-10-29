import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import api from './api';
import App from './App';

const originalAdapter = api.defaults.adapter;
const receptionist = { id: 'desk-id', name: 'Front Desk', email: 'desk@example.com', role: 'RECEPTIONIST', workspaceTheme: 'forest', active: true };
const owner = { id: 'owner-id', name: 'Shop Owner', email: 'owner@example.com', role: 'OWNER', workspaceTheme: 'forest', active: true };
const operationalSummary = { todaySalesCount: 3, totalProducts: 12, lowStockCount: 2, totalCustomers: 9 };

function renderApp(profile, route = '/') {
  window.history.pushState({}, '', route);
  sessionStorage.setItem('retail-token', 'application-jwt');
  sessionStorage.setItem('retail-token-expires-at', String(Date.now() + 60_000));
  api.defaults.adapter = async config => {
    let data;
    if (config.url.includes('/auth/me')) data = profile;
    else if (config.url.includes('/dashboard/operational')) data = operationalSummary;
    else if (config.url.includes('/dashboard/summary')) data = { todayRevenue: 1250, ...operationalSummary, recentSales: [] };
    else throw new Error(`Unexpected request: ${config.url}`);
    return { status: 200, statusText: 'OK', headers: {}, config, data };
  };
  return render(<App />);
}

afterEach(() => {
  api.defaults.adapter = originalAdapter;
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
    expect(await screen.findByText('A quick look at your store today.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sales History' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Team access' })).toBeTruthy();
    expect(await screen.findByText('Rs. 1250.00')).toBeTruthy();
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
