import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { cancelSessionRequests, startSessionRequests } from './api';

const TOKEN_KEY = 'token';
const EXPIRY_KEY = 'tokenExpiresAt';
const AuthContext = createContext(null);

function clearSession() {
  cancelSessionRequests();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem('retail-theme');
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith('retail-')) sessionStorage.removeItem(key);
    }
  } catch { /* Session storage may be unavailable in restricted browsers. */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(/** @type {import('./types').AppUser | null} */ (null));
  const [loading, setLoading] = useState(true);

  const logout = () => {
    clearSession();
    window.location.replace('/login');
  };

  useEffect(() => {
    const handleUnauthorized = () => logout();
    const handleStorage = event => {
      if (event.key === TOKEN_KEY && !event.newValue) logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('storage', handleStorage);
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresAt = Number(localStorage.getItem(EXPIRY_KEY));
    if (!token || !expiresAt || expiresAt <= Date.now()) {
      clearSession();
      setLoading(false);
      return () => {
        window.removeEventListener('auth:unauthorized', handleUnauthorized);
        window.removeEventListener('storage', handleStorage);
      };
    }

    startSessionRequests();
    let active = true;
    api.get('/auth/me')
      .then(response => { if (active) setUser(response.data); })
      .catch(() => { if (active) logout(); })
      .finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const expiresAt = Number(localStorage.getItem(EXPIRY_KEY));
    if (!expiresAt || expiresAt <= Date.now()) { logout(); return undefined; }
    const timeout = window.setTimeout(logout, expiresAt - Date.now());
    return () => window.clearTimeout(timeout);
  }, [user]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, expiresIn, user: loggedInUser } = response.data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + Number(expiresIn) * 1000));
    startSessionRequests();
    setUser(loggedInUser);
    return loggedInUser;
  };

  const updateWorkspaceTheme = useCallback(async workspaceTheme => {
    const response = await api.put('/auth/me/preferences', { workspaceTheme });
    setUser(current => current ? { ...current, ...response.data } : current);
    return response.data;
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, updateWorkspaceTheme }), [user, loading, updateWorkspaceTheme]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading">Loading your workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === 'OWNER' ? '/' : '/pos'} replace />;
  return children;
}
