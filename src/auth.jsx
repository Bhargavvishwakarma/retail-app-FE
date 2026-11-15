import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api, { cancelSessionRequests, startSessionRequests } from './api';

const TOKEN_KEY = 'retail-token';
const EXPIRY_KEY = 'retail-token-expires-at';
const REFRESH_EARLY_MS = 30_000;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const AUTH_REQUEST_TIMEOUT_MS = 12_000;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll', 'wheel'];
const AuthContext = createContext(null);

function readSessionValue(key) {
  try { return sessionStorage.getItem(key); }
  catch { return null; }
}

function clearSession() {
  cancelSessionRequests();
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith('retail-')) sessionStorage.removeItem(key);
    }
  } catch { /* Session storage may be unavailable in restricted browsers. */ }
}

function storeToken(token, expiresIn) {
  if (!token || !Number.isFinite(Number(expiresIn)) || Number(expiresIn) <= 0) {
    throw new Error('The sign-in response was incomplete. Please try again.');
  }
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + Number(expiresIn) * 1000));
  } catch {
    clearSession();
    throw new Error('This browser cannot keep a secure sign-in session. Enable session storage and try again.');
  }
}

function isActiveProfile(profile) {
  return Boolean(profile && (profile.role === 'OWNER' || profile.role === 'RECEPTIONIST') && profile.active !== false);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(/** @type {import('./types').AppUser | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [sessionRevision, setSessionRevision] = useState(0);
  const lastActivityAt = useRef(0);
  const refreshInFlight = useRef(false);
  const sessionEnding = useRef(false);
  const isAuthenticated = Boolean(user);

  const clearAuthState = useCallback(() => {
    lastActivityAt.current = 0;
    clearSession();
    setUser(null);
    setLoading(false);
  }, []);

  const endSession = useCallback(() => {
    if (sessionEnding.current) return;
    sessionEnding.current = true;
    clearAuthState();
    // A full navigation resets the app and clears the browser Network log when Preserve log is off.
    window.location.replace('/login');
  }, [clearAuthState]);

  const logout = useCallback(async () => {
    const token = readSessionValue(TOKEN_KEY);
    try {
      if (token) await api.post('/auth/logout', null, { timeout: 8000 });
    } catch { /* Local sign-out must complete even if the API is unavailable. */ }
    endSession();
  }, [endSession]);

  useEffect(() => {
    const handleUnauthorized = () => endSession();
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    const token = readSessionValue(TOKEN_KEY);
    const expiresAt = Number(readSessionValue(EXPIRY_KEY));
    if (!token || !expiresAt || expiresAt <= Date.now()) {
      if (token) endSession();
      else clearAuthState();
      return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }

    startSessionRequests();
    let active = true;
    api.get('/auth/me')
      .then(response => {
        if (!active) return;
        if (!isActiveProfile(response.data)) {
          endSession();
          return;
        }
        lastActivityAt.current = Date.now();
        setUser(response.data);
      })
      .catch(() => { if (active) endSession(); })
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [clearAuthState, endSession]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    if (!lastActivityAt.current) lastActivityAt.current = Date.now();

    let active = true;
    let refreshTimeout;
    let expiryTimeout;
    let inactivityTimeout;

    const expireSession = () => endSession();
    const getExpiry = () => Number(readSessionValue(EXPIRY_KEY));
    const scheduleInactivityTimeout = () => {
      window.clearTimeout(inactivityTimeout);
      const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt.current);
      inactivityTimeout = window.setTimeout(expireSession, Math.max(0, remaining));
    };
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimeout);
      const expiresAt = getExpiry();
      if (!expiresAt || expiresAt <= Date.now()) { expireSession(); return; }
      refreshTimeout = window.setTimeout(refreshSession, Math.max(0, expiresAt - Date.now() - REFRESH_EARLY_MS));
    };
    const refreshSession = async () => {
      const expiresAt = getExpiry();
      if (!expiresAt || expiresAt <= Date.now()) { expireSession(); return; }
      if (Date.now() - lastActivityAt.current >= INACTIVITY_TIMEOUT_MS) { expireSession(); return; }
      if (document.visibilityState !== 'visible') return;

      const currentToken = readSessionValue(TOKEN_KEY);
      if (!currentToken) { expireSession(); return; }
      if (refreshInFlight.current) return;

      refreshInFlight.current = true;
      try {
        // The refresh endpoint uses the current bearer and has no request body.
        const response = await api.post('/auth/refresh');
        if (!active || readSessionValue(TOKEN_KEY) !== currentToken) return;
        if (getExpiry() <= Date.now()) { expireSession(); return; }

        const { token, expiresIn, user: refreshedUser } = response.data;
        if (!isActiveProfile(refreshedUser)) { expireSession(); return; }
        storeToken(token, expiresIn);
        setUser(refreshedUser);
        setSessionRevision(revision => revision + 1);
      } catch {
        // A failed refresh leaves the current bearer in place until its expiry timer runs.
        if (active && (!readSessionValue(TOKEN_KEY) || getExpiry() <= Date.now())) expireSession();
      } finally {
        refreshInFlight.current = false;
      }
    };
    const handleActivity = () => {
      const expiresAt = getExpiry();
      if (!expiresAt || expiresAt <= Date.now()) { expireSession(); return; }
      lastActivityAt.current = Date.now();
      scheduleInactivityTimeout();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const expiresAt = getExpiry();
      if (!expiresAt || expiresAt <= Date.now()) { expireSession(); return; }
      if (Date.now() - lastActivityAt.current >= INACTIVITY_TIMEOUT_MS) { expireSession(); return; }
      scheduleRefresh();
    };

    const expiresAt = getExpiry();
    if (!expiresAt || expiresAt <= Date.now()) { expireSession(); return undefined; }
    expiryTimeout = window.setTimeout(expireSession, expiresAt - Date.now());
    scheduleInactivityTimeout();
    scheduleRefresh();
    ACTIVITY_EVENTS.forEach(eventName => window.addEventListener(eventName, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearTimeout(refreshTimeout);
      window.clearTimeout(expiryTimeout);
      window.clearTimeout(inactivityTimeout);
      ACTIVITY_EVENTS.forEach(eventName => window.removeEventListener(eventName, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, sessionRevision, endSession]);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
    const { token, expiresIn, user: loggedInUser } = response.data;
    if (!isActiveProfile(loggedInUser)) throw new Error('The sign-in response was incomplete. Please try again.');
    storeToken(token, expiresIn);
    sessionEnding.current = false;
    lastActivityAt.current = Date.now();
    startSessionRequests();
    setUser(loggedInUser);
    setLoading(false);
    return loggedInUser;
  }, []);

  const loginWithGoogle = useCallback(async idToken => {
    const response = await api.post('/auth/google', { idToken }, { timeout: AUTH_REQUEST_TIMEOUT_MS });
    const { token, expiresIn, user: loggedInUser } = response.data;
    if (!isActiveProfile(loggedInUser)) throw new Error('The sign-in response was incomplete. Please try again.');
    storeToken(token, expiresIn);
    sessionEnding.current = false;
    lastActivityAt.current = Date.now();
    startSessionRequests();
    setUser(loggedInUser);
    setLoading(false);
    return loggedInUser;
  }, []);

  const updateWorkspaceTheme = useCallback(async workspaceTheme => {
    const response = await api.put('/auth/me/preferences', { workspaceTheme });
    setUser(current => current ? { ...current, ...response.data } : current);
    return response.data;
  }, []);

  const value = useMemo(() => ({ user, loading, sessionRevision, login, loginWithGoogle, logout, updateWorkspaceTheme }), [user, loading, sessionRevision, login, loginWithGoogle, logout, updateWorkspaceTheme]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <WorkspaceSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <AccessDenied />;
  return children;
}

function AccessDenied() {
  return <main className="access-denied">
    <section className="access-denied-card">
      <span className="eyebrow">403</span>
      <h1>Access denied</h1>
      <p>Your account does not have permission to open this page.</p>
      <Link to="/">Return to your workspace</Link>
    </section>
  </main>;
}

function WorkspaceSkeleton() {
  return <div className="workspace-skeleton" aria-busy="true">
    <span className="visually-hidden" role="status">Loading your workspace…</span>
    <aside className="workspace-skeleton-sidebar" aria-hidden="true">
      <span className="skeleton-block workspace-skeleton-brand" />
      <span className="skeleton-block workspace-skeleton-language" />
      <div>{[0, 1, 2, 3, 4, 5, 6].map(item => <span className="skeleton-block workspace-skeleton-nav" key={item} />)}</div>
      <span className="skeleton-block workspace-skeleton-user" />
    </aside>
    <main className="workspace-skeleton-main" aria-hidden="true">
      <div className="workspace-skeleton-topbar"><span className="skeleton-block" /><span className="skeleton-block" /></div>
      <header className="workspace-skeleton-heading"><span className="skeleton-block" /><span className="skeleton-block" /><span className="skeleton-block" /></header>
      <div className="workspace-skeleton-metrics">{[0, 1, 2, 3, 4].map(item => <div className="skeleton-block" key={item} />)}</div>
      <div className="workspace-skeleton-section"><span className="skeleton-block" /><div className="workspace-skeleton-table"><span className="skeleton-block" />{[0, 1, 2, 3, 4].map(item => <span className="skeleton-block" key={item} />)}</div></div>
    </main>
  </div>;
}
