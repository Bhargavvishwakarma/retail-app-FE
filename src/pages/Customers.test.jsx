import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Customers from './Customers';

const { apiMock, receptionistMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  receptionistMock: { id: 'desk-id', name: 'Front Desk', email: 'desk@example.com', role: 'RECEPTIONIST', active: true }
}));

vi.mock('../api', () => ({ default: apiMock }));
vi.mock('../auth', () => ({ useAuth: () => ({ user: receptionistMock }) }));
vi.mock('../i18n', () => ({ useLanguage: () => ({ t: value => value }) }));

const customer = { id: 'customer-id', name: 'Anita Rao', phone: '1234567890', email: 'anita@example.com', address: 'Mysuru' };

beforeEach(() => {
  apiMock.get.mockReset().mockResolvedValue({ data: { content: [customer], totalElements: 1 } });
  apiMock.post.mockReset().mockResolvedValue({ data: {} });
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
});

describe('Receptionist customer permissions', () => {
  it('can add customers but does not see owner-only edit and delete actions', async () => {
    render(<Customers />);
    expect(await screen.findByText('Anita Rao')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Name *'), { target: { value: 'New Customer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/customers', {
      name: 'New Customer', phone: '', email: '', address: ''
    }));
    expect(apiMock.put).not.toHaveBeenCalled();
    expect(apiMock.delete).not.toHaveBeenCalled();
  });
});
