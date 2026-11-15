import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationCenter from './NotificationCenter';

const page = {
  number: 0, size: 20, totalElements: 3, totalPages: 1,
  content: [
    { id: 'low-stock', type: 'LOW_STOCK', category: 'INVENTORY', severity: 'WARNING', title: 'Low stock', message: 'Three remain', isRead: false, createdAt: new Date().toISOString() },
    { id: 'restocked', type: 'STOCK_REPLENISHED', category: 'INVENTORY', severity: 'SUCCESS', title: 'Stock replenished', message: 'Items are available', isRead: true, createdAt: new Date().toISOString() },
    { id: 'high-sale', type: 'HIGH_VALUE_SALE', category: 'SALES', severity: 'HIGH', title: 'High-value sale', message: 'Owner-only detail', isRead: false, createdAt: new Date().toISOString() }
  ]
};

const { notificationState, authState } = vi.hoisted(() => ({
  notificationState: {
    fetchNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    clearReadNotifications: vi.fn(),
    connectionStatus: 'connected'
  },
  authState: { user: { id: 'desk-id', role: 'RECEPTIONIST' } }
}));

vi.mock('../context/NotificationContext', () => ({
  useNotifications: () => notificationState,
  notificationErrorMessage: error => error?.message || 'Request failed'
}));
vi.mock('../auth', () => ({ useAuth: () => authState }));
vi.mock('../i18n', () => ({ useLanguage: () => ({ t: value => value }) }));

beforeEach(() => {
  let currentPage = page;
  notificationState.fetchNotifications.mockReset().mockImplementation(async () => currentPage);
  notificationState.markAsRead.mockReset().mockImplementation(async id => {
    const updated = { ...currentPage.content.find(item => item.id === id), isRead: true };
    currentPage = { ...currentPage, content: currentPage.content.map(item => item.id === id ? updated : item) };
    return updated;
  });
  notificationState.markAllAsRead.mockReset().mockResolvedValue({ count: 1 });
  notificationState.deleteNotification.mockReset().mockResolvedValue();
  notificationState.clearReadNotifications.mockReset().mockResolvedValue({ count: 1 });
});

describe('NotificationCenter', () => {
  it('uses server-side filters and does not present owner-only details to a receptionist', async () => {
    render(<NotificationCenter />);
    expect(await screen.findByText('Low stock')).toBeTruthy();
    expect(screen.queryByText('High-value sale')).toBeNull();
    expect(screen.getByText('Live updates connected')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'INVENTORY' } });
    await waitFor(() => expect(notificationState.fetchNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'INVENTORY', page: 0, size: 20 })));
  });

  it('marks an item as read and confirms destructive actions', async () => {
    render(<NotificationCenter />);
    await screen.findByText('Low stock');
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark read' })[0]);
    await waitFor(() => expect(notificationState.markAsRead).toHaveBeenCalledWith('low-stock', true));

    fireEvent.click(screen.getByRole('button', { name: 'Delete Low stock' }));
    expect(screen.getByText('Delete this notification?')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1));
    await waitFor(() => expect(notificationState.deleteNotification).toHaveBeenCalledWith('low-stock', false));

    fireEvent.click(screen.getByRole('button', { name: 'Clear read' }));
    expect(screen.getByRole('alertdialog', { name: 'Clear read notifications' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear read', exact: true }).at(-1));
    await waitFor(() => expect(notificationState.clearReadNotifications).toHaveBeenCalledOnce());
  });

  it('keeps the unread filter and active page while refreshing server totals after read mutations', async () => {
    let unreadTotal = 41;
    const pageRows = pageNumber => Array.from({ length: 20 }, (_, index) => {
      const id = pageNumber === 0 ? `unread-${index}` : `later-${index}`;
      const title = pageNumber === 1 && index === 0 ? 'Later page target' : `Unread ${pageNumber}-${index}`;
      return {
        ...page.content[0],
        id,
        title,
        isRead: false,
        createdAt: new Date().toISOString()
      };
    });
    const getServerPage = params => {
      const content = unreadTotal === 0 ? [] : pageRows(params.page);
      return {
        number: params.page,
        size: 20,
        totalElements: unreadTotal,
        totalPages: Math.ceil(unreadTotal / 20),
        content
      };
    };

    notificationState.fetchNotifications.mockReset().mockImplementation(async params => getServerPage(params));
    notificationState.markAsRead.mockReset().mockImplementation(async id => {
      unreadTotal -= 1;
      return { ...page.content[0], id, title: 'Later page target', isRead: true };
    });
    notificationState.markAllAsRead.mockReset().mockImplementation(async () => {
      unreadTotal = 0;
      return { count: 40 };
    });

    render(<NotificationCenter />);
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'false' } });
    await waitFor(() => expect(notificationState.fetchNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, isRead: false })));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Later page target');
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark read' })[0]);
    await waitFor(() => {
      expect(notificationState.markAsRead).toHaveBeenCalledWith('later-0', true);
      expect(notificationState.fetchNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, isRead: false }));
      expect(screen.getByText('Page 2 of 2')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => {
      expect(notificationState.markAllAsRead).toHaveBeenCalledOnce();
      expect(notificationState.fetchNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, isRead: false }));
      expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
    });
    expect(screen.getByText('No matching notifications')).toBeTruthy();
  });
});
