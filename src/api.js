import axios from 'axios';

let sessionRequests = null;

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

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});

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
  error => {
    const url = String(error.config?.url || '');
    const isPublicAuth = ['/auth/login', '/auth/google'].some(path => url.includes(path));
    if (error.response?.status === 401 && !isPublicAuth) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
