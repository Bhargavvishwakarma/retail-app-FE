import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from './api';
import { AuthProvider, useAuth } from './auth';

const originalAdapter = api.defaults.adapter;
const owner = { id: 'owner-id', name: 'Shop Owner', email: 'owner@example.com', role: 'OWNER', workspaceTheme: 'forest', active: true };
const receptionist = { ...owner, id: 'desk-id', name: 'Front Desk', email: 'desk@example.com', role: 'RECEPTIONIST' };

function setAdapter(handler) {
  api.defaults.adapter = async config => {
    const result = await handler(config);
    return { status: 200, statusText: 'OK', headers: {}, config, ...result };
  };
}

function AuthControls() {
  const { user, loading, loginWithGoogle, logout } = useAuth();
  return <div>
    <output>{loading ? 'loading' : user ? `${user.role}:${user.name}` : 'signed out'}</output>
    <button type="button" onClick={() => loginWithGoogle('google-id-token')}>Google login</button>
    <button type="button" onClick={() => api.get('/products').catch(() => {})}>Protected request</button>
    <button type="button" onClick={logout}>Sign out</button>
  </div>;
}

function mountAuth() {
  return render(<AuthProvider><AuthControls /></AuthProvider>);
}

afterEach(() => { api.defaults.adapter = originalAdapter; });

describe('application authentication session', () => {
  it('exchanges a Google ID token and stores only the app token in session storage', async () => {
    const requests = [];
    setAdapter(config => {
      requests.push(config);
      expect(config.url).toContain('/auth/google');
      expect(JSON.parse(config.data)).toEqual({ idToken: 'google-id-token' });
      return { data: { token: 'app-jwt', tokenType: 'Bearer', expiresIn: 3600, user: owner } };
    });
    mountAuth();

    fireEvent.click(screen.getByRole('button', { name: 'Google login' }));
    expect(await screen.findByText('OWNER:Shop Owner')).toBeTruthy();
    expect(sessionStorage.getItem('retail-token')).toBe('app-jwt');
    expect(sessionStorage.getItem('retail-token-expires-at')).toBeTruthy();
    expect(sessionStorage.getItem('google-id-token')).toBeNull();
    expect(requests).toHaveLength(1);
  });

  it('validates a saved token against /auth/me and sends it as a bearer token on logout', async () => {
    sessionStorage.setItem('retail-token', 'restored-jwt');
    sessionStorage.setItem('retail-token-expires-at', String(Date.now() + 60_000));
    const requests = [];
    setAdapter(config => {
      requests.push(config);
      if (config.url.includes('/auth/me')) return { data: receptionist };
      if (config.url.includes('/auth/logout')) return { status: 204, data: null };
      throw new Error(`Unexpected request: ${config.url}`);
    });
    mountAuth();

    expect(await screen.findByText('RECEPTIONIST:Front Desk')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('signed out')).toBeTruthy();
    const logoutRequest = requests.find(config => config.url.includes('/auth/logout'));
    expect(logoutRequest.headers.Authorization).toBe('Bearer restored-jwt');
    expect(sessionStorage.getItem('retail-token')).toBeNull();
    expect(sessionStorage.getItem('retail-token-expires-at')).toBeNull();
  });

  it('clears the local session when a protected API request returns 401', async () => {
    sessionStorage.setItem('retail-token', 'revoked-jwt');
    sessionStorage.setItem('retail-token-expires-at', String(Date.now() + 60_000));
    setAdapter(config => {
      if (config.url.includes('/auth/me')) return { data: owner };
      throw Object.assign(new Error('unauthorized'), { response: { status: 401 }, config });
    });
    mountAuth();

    expect(await screen.findByText('OWNER:Shop Owner')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Protected request' }));
    await waitFor(() => expect(screen.getByText('signed out')).toBeTruthy());
    expect(sessionStorage.getItem('retail-token')).toBeNull();
  });

  it('does not restore an inactive account', async () => {
    sessionStorage.setItem('retail-token', 'inactive-jwt');
    sessionStorage.setItem('retail-token-expires-at', String(Date.now() + 60_000));
    setAdapter(() => ({ data: { ...receptionist, active: false } }));
    mountAuth();

    expect(await screen.findByText('signed out')).toBeTruthy();
    expect(sessionStorage.getItem('retail-token')).toBeNull();
  });
});
