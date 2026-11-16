import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const { notificationsState, authState } = vi.hoisted(() => ({
  notificationsState: {
    unreadCount: 101,
    notifications: [{
      id: 'inventory-1', type: 'LOW_STOCK', category: 'INVENTORY', severity: 'WARNING',
      title: 'Low stock', message: 'Only 3 items remain.', isRead: false, createdAt: '2026-11-15T09:30:00Z'
    }],
    refreshRecent: vi.fn().mockResolvedValue(),
    markAsRead: vi.fn().mockResolvedValue({ id: 'inventory-1', isRead: true }),
    markAllAsRead: vi.fn().mockResolvedValue({ count: 1 })
  },
  authState: { user: { id: 'owner-id', role: 'OWNER' } }
}));

vi.mock('../../hooks/useNotifications', () => ({ useNotifications: () => notificationsState }));
vi.mock('../../auth', () => ({ useAuth: () => authState }));

beforeEach(() => {
  notificationsState.notifications = [{
    id: 'inventory-1', type: 'LOW_STOCK', category: 'INVENTORY', severity: 'WARNING',
    title: 'Low stock', message: 'Only 3 items remain.', isRead: false, createdAt: '2026-11-15T09:30:00Z'
  }];
  notificationsState.refreshRecent.mockClear();
  notificationsState.markAsRead.mockClear();
  notificationsState.markAllAsRead.mockClear();
});

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="current-location">{location.pathname}</output>;
}

describe('NotificationBell', () => {
  it('shows a capped unread badge and opens or closes an accessible dropdown', async () => {
    render(<BrowserRouter><NotificationBell /></BrowserRouter>);

    const bell = screen.getByRole('button', { name: '101 unread notifications' });
    expect(screen.getByText('99+')).toBeTruthy();
    fireEvent.click(bell);
    expect(await screen.findByRole('dialog', { name: 'Notifications' })).toBeTruthy();
    expect(notificationsState.refreshRecent).toHaveBeenCalledOnce();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull());
  });

  it('closes the dropdown from its close button', async () => {
    render(<BrowserRouter><NotificationBell /></BrowserRouter>);
    fireEvent.click(screen.getByRole('button', { name: '101 unread notifications' }));
    await screen.findByRole('dialog', { name: 'Notifications' });

    fireEvent.click(screen.getByRole('button', { name: 'Close notifications' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull());
  });

  it('marks an item or all items as read from the dropdown', async () => {
    render(<BrowserRouter><NotificationBell /></BrowserRouter>);
    fireEvent.click(screen.getByRole('button', { name: '101 unread notifications' }));
    await screen.findByText('Low stock');
    fireEvent.click(screen.getByRole('button', { name: /Low stock/ }));
    await waitFor(() => expect(notificationsState.markAsRead).toHaveBeenCalledWith('inventory-1'));

    fireEvent.click(screen.getByRole('button', { name: '101 unread notifications' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(notificationsState.markAllAsRead).toHaveBeenCalledOnce());
  });

  it('opens the related sale details when a sale notification is selected', async () => {
    notificationsState.notifications = [{
      id: 'sale-notification', type: 'SALE_COMPLETED', category: 'SALES', severity: 'SUCCESS',
      title: 'Sale completed', message: 'Sale S-100 was completed.', entityType: 'SALE', entityId: 'sale-100',
      isRead: false, createdAt: '2026-11-15T09:30:00Z'
    }];

    render(<MemoryRouter initialEntries={['/']}><NotificationBell /><CurrentLocation /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '101 unread notifications' }));
    fireEvent.click(await screen.findByRole('button', { name: /Sale completed/ }));

    await waitFor(() => {
      expect(notificationsState.markAsRead).toHaveBeenCalledWith('sale-notification');
      expect(screen.getByTestId('current-location').textContent).toBe('/sales/sale-100');
    });
  });
});
