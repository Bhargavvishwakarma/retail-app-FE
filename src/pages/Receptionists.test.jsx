import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Receptionists from './Receptionists';

const { apiMock, ownerMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  ownerMock: { id: 'owner-id', name: 'Shop Owner', email: 'owner@example.com', role: 'OWNER', active: true }
}));

vi.mock('../api', () => ({ default: apiMock }));
vi.mock('../auth', () => ({ useAuth: () => ({ user: ownerMock }) }));
vi.mock('../i18n', () => ({ useLanguage: () => ({ t: value => value }) }));

const owner = { ...ownerMock, createdAt: '2026-01-01T10:00:00' };
const receptionist = { id: 'desk-id', name: 'Front Desk', email: 'desk@example.com', role: 'RECEPTIONIST', active: true, createdAt: '2026-01-02T10:00:00' };

beforeEach(() => {
  apiMock.get.mockReset().mockResolvedValue({ data: { content: [owner, receptionist], totalElements: 2 } });
  apiMock.post.mockReset();
  apiMock.patch.mockReset();
});

describe('Owner staff management', () => {
  it('pre-registers a receptionist without a password and can update status and role', async () => {
    apiMock.post.mockResolvedValue({ data: receptionist });
    apiMock.patch
      .mockResolvedValueOnce({ data: { ...receptionist, active: false } })
      .mockResolvedValueOnce({ data: { ...receptionist, active: false, role: 'OWNER' } });
    render(<Receptionists />);

    expect(await screen.findByText('Front Desk')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Evening Desk' } });
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'evening@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pre-register receptionist' }));

    expect((await screen.findByRole('status')).textContent).toContain('can sign in with Google using this verified email');
    expect(apiMock.post).toHaveBeenCalledWith('/auth/receptionists', { name: 'Evening Desk', email: 'evening@example.com' });
    expect(apiMock.post.mock.calls[0][1]).not.toHaveProperty('password');

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledWith('/auth/users/desk-id/status', { active: false }));
    expect(await screen.findByText('Inactive')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Make Owner' }));
    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledWith('/auth/users/desk-id/role', { role: 'OWNER' }));
    expect((await screen.findByRole('status')).textContent).toContain("Front Desk's account was updated");
  });

  it('shows duplicate email errors from the backend', async () => {
    apiMock.post.mockRejectedValue({ response: { status: 409 } });
    render(<Receptionists />);
    await screen.findByText('Front Desk');
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Front Desk' } });
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'desk@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pre-register receptionist' }));
    expect((await screen.findByRole('alert')).textContent).toContain('already exists');
  });

  it('does not expose access controls for the signed-in Owner', async () => {
    render(<Receptionists />);
    await screen.findByText('Front Desk');
    const ownerRow = screen.getByText('Shop Owner').closest('tr');
    expect(ownerRow.textContent).toContain('Your access is managed by your sign-in.');
    expect(ownerRow.querySelector('button')).toBeNull();
  });
});
