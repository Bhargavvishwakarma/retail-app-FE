import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import api from '../api';
import { AuthProvider, useAuth } from '../auth';
import { LanguageProvider } from '../i18n';
import Login from './Login';

const originalAdapter = api.defaults.adapter;

function setAdapter(handler) {
  api.defaults.adapter = async config => {
    const result = await handler(config);
    return { status: 200, statusText: 'OK', headers: {}, config, ...result };
  };
}

function Destination() {
  const { user } = useAuth();
  return <main>{user ? `${user.role} workspace` : 'Workspace'}</main>;
}

function renderLogin() {
  return render(<LanguageProvider><AuthProvider><MemoryRouter initialEntries={['/login']}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Destination />} />
    </Routes>
  </MemoryRouter></AuthProvider></LanguageProvider>);
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-web-client-id');
  let callback;
  window.google = { accounts: { id: {
    initialize: vi.fn(options => { callback = options.callback; }),
    renderButton: vi.fn(container => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Sign in with Google';
      button.addEventListener('click', () => callback({ credential: 'google-id-token' }));
      container.appendChild(button);
    })
  } } };
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
  delete window.google;
});

describe('Google and password sign-in', () => {
  it.each([
    [{ id: 'owner-id', name: 'Owner', email: 'owner@example.com', role: 'OWNER', active: true }, 'OWNER workspace'],
    [{ id: 'desk-id', name: 'Front Desk', email: 'desk@example.com', role: 'RECEPTIONIST', active: true }, 'RECEPTIONIST workspace']
  ])('renders the official Google button and routes the returned %s role', async (profile, expectedDestination) => {
    const requests = [];
    setAdapter(config => {
      requests.push(config);
      expect(config.url).toContain('/auth/google');
      expect(JSON.parse(config.data)).toEqual({ idToken: 'google-id-token' });
      return { data: { token: 'application-jwt', tokenType: 'Bearer', expiresIn: 28800, user: profile } };
    });
    renderLogin();

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    expect(await screen.findByText(expectedDestination)).toBeTruthy();
    expect(window.google.accounts.id.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'test-web-client-id', auto_select: false }));
    expect(sessionStorage.getItem('retail-token')).toBe('application-jwt');
    expect(requests).toHaveLength(1);
  });

  it('prevents duplicate Google callbacks while sign-in is in progress', async () => {
    let completeRequest;
    const requests = [];
    setAdapter(config => {
      requests.push(config);
      return new Promise(resolve => { completeRequest = () => resolve({ data: { token: 'application-jwt', expiresIn: 3600, user: { id: 'owner-id', name: 'Owner', email: 'owner@example.com', role: 'OWNER', active: true } } }); });
    });
    renderLogin();
    const googleButton = await screen.findByRole('button', { name: 'Sign in with Google' });
    fireEvent.click(googleButton);
    expect(await screen.findByText('Signing in...')).toBeTruthy();
    fireEvent.click(googleButton);
    expect(requests).toHaveLength(1);
    completeRequest();
    expect(await screen.findByText('OWNER workspace')).toBeTruthy();
  });

  it('explains when a Google account has not been registered for the store', async () => {
    setAdapter(async () => { throw Object.assign(new Error('forbidden'), { response: { status: 403 } }); });
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    expect((await screen.findByRole('alert')).textContent).toContain('not enabled for this store');
  });

  it('shows a safe message for an invalid Google ID token', async () => {
    setAdapter(async () => { throw Object.assign(new Error('unauthorized'), { response: { status: 401 } }); });
    renderLogin();
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    expect((await screen.findByRole('alert')).textContent).toContain('could not verify this sign-in');
  });

  it('keeps the existing password login and prevents duplicate submissions', async () => {
    let completeRequest;
    const requests = [];
    setAdapter(config => {
      requests.push(config);
      expect(config.url).toContain('/auth/login');
      return new Promise(resolve => { completeRequest = () => resolve({ data: { token: 'legacy-app-jwt', expiresIn: 3600, user: { id: 'owner-id', name: 'Owner', email: 'owner@example.com', role: 'OWNER', active: true } } }); });
    });
    renderLogin();
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    const form = screen.getByLabelText('Password').closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(requests).toHaveLength(1));
    completeRequest();
    expect(await screen.findByText('OWNER workspace')).toBeTruthy();
  });
});
