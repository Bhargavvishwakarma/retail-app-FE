import axios from 'axios';

let sessionRequests = null;

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
    let token = null;
    try { token = sessionStorage.getItem('retail-token'); }
    catch { /* Restricted browser storage is treated as a signed-out session. */ }
    if (!token || !sessionRequests) return Promise.reject(new axios.CanceledError('No active session'));
    config.headers.Authorization = `Bearer ${token}`;
    config.signal = sessionRequests.signal;
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
