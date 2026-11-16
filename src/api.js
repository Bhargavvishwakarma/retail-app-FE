import axios from 'axios';

let sessionRequests = null;
let sessionRefreshHandler = null;
let refreshInFlight = null;

// The notification stream uses fetch because EventSource cannot attach the
// application's bearer token. Keeping token access here means it follows the
// same session-storage contract as the Axios interceptor below.
export function getSessionToken() {
  try { return sessionStorage.getItem('retail-token'); }
  catch { return null; }
}

export function startSessionRequests() {
  sessionRequests?.abort();
  sessionRequests = new AbortController();
}

export function cancelSessionRequests() {
  sessionRequests?.abort();
  sessionRequests = null;
}

// AuthProvider owns token expiry and profile validation. The shared promise
// keeps concurrent requests from treating an old bearer as a logout while its
// replacement token is being saved.
export function setSessionRefreshHandler(handler) {
  sessionRefreshHandler = handler;
  return () => {
    if (sessionRefreshHandler === handler) sessionRefreshHandler = null;
  };
}

export function refreshSession() {
  if (!sessionRefreshHandler) return Promise.reject(new Error('No active session refresh handler'));
  if (!refreshInFlight) {
    refreshInFlight = Promise.resolve()
      .then(() => sessionRefreshHandler?.())
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

// Render spins down inactive free services. A public request to the API base
// keeps the deployed service warm without relying on a signed-in user's
// session or invoking the authentication interceptors below.
const KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000;

function pingApi() {
  axios.get(api.defaults.baseURL, { timeout: 8_000 }).catch(() => {
    // A failed ping is non-critical; the next scheduled ping will try again.
  });
}

if (import.meta.env.PROD && typeof window !== 'undefined') {
  pingApi();
  window.setInterval(pingApi, KEEP_ALIVE_INTERVAL_MS);
}

api.interceptors.request.use(config => {
  const url = String(config.url || '');
  const isPublicAuth = ['/auth/login', '/auth/google'].some(path => url.includes(path));
  if (!isPublicAuth) {
    const token = getSessionToken();
    if (!token || !sessionRequests) return Promise.reject(new axios.CanceledError('No active session'));
    config.headers.Authorization = `Bearer ${token}`;
    config.signal = config.signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([config.signal, sessionRequests.signal])
      : sessionRequests.signal;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    const url = String(error.config?.url || '');
    const isPublicAuth = ['/auth/login', '/auth/google'].some(path => url.includes(path));
    const isRefreshRequest = url.includes('/auth/refresh');
    const config = error.config;
    if (error.response?.status === 401 && !isPublicAuth && !isRefreshRequest && config && !config._sessionRetry) {
      const tokenUsed = config.headers?.get?.('Authorization') || config.headers?.Authorization;
      try {
        await refreshSession();
        const refreshedToken = getSessionToken();
        if (refreshedToken && tokenUsed !== `Bearer ${refreshedToken}`) {
          config._sessionRetry = true;
          return api.request(config);
        }
      } catch {
        // The original 401 below is the authoritative session failure.
      }
    }
    if (error.response?.status === 401 && !isPublicAuth) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
