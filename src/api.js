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
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api'
});

api.interceptors.request.use(config => {
  const isLogin = String(config.url || '').includes('/auth/login');
  if (!isLogin) {
    const token = localStorage.getItem('token');
    if (!token || !sessionRequests) return Promise.reject(new axios.CanceledError('No active session'));
    config.headers.Authorization = `Bearer ${token}`;
    config.signal = sessionRequests.signal;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !String(error.config?.url || '').includes('/auth/login')) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
