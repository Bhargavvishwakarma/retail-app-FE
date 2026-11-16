import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { cancelSessionRequests, setSessionRefreshHandler, startSessionRequests } from './api';

const originalAdapter = api.defaults.adapter;

function unauthorized(config) {
  return Object.assign(new Error('unauthorized'), { response: { status: 401 }, config });
}

describe('authenticated Axios requests', () => {
  let clearRefreshHandler;

  beforeEach(() => {
    sessionStorage.setItem('retail-token', 'old-jwt');
    startSessionRequests();
  });

  afterEach(() => {
    clearRefreshHandler?.();
    clearRefreshHandler = null;
    cancelSessionRequests();
    api.defaults.adapter = originalAdapter;
  });

  it('waits for one refresh and retries a 401 request with its replacement bearer', async () => {
    const unauthorizedEvent = vi.fn();
    const refresh = vi.fn(() => sessionStorage.setItem('retail-token', 'new-jwt'));
    const usedBearers = [];
    window.addEventListener('auth:unauthorized', unauthorizedEvent);
    clearRefreshHandler = setSessionRefreshHandler(async () => refresh());
    api.defaults.adapter = async config => {
      const bearer = config.headers.get?.('Authorization') || config.headers.Authorization;
      usedBearers.push(bearer);
      if (bearer === 'Bearer old-jwt') throw unauthorized(config);
      return { status: 200, statusText: 'OK', headers: {}, config, data: { ok: true } };
    };

    await expect(api.get('/products')).resolves.toMatchObject({ data: { ok: true } });
    expect(refresh).toHaveBeenCalledOnce();
    expect(usedBearers).toEqual(['Bearer old-jwt', 'Bearer new-jwt']);
    expect(unauthorizedEvent).not.toHaveBeenCalled();
    window.removeEventListener('auth:unauthorized', unauthorizedEvent);
  });

  it('does not convert a 403 authorization failure into a refresh or logout', async () => {
    const unauthorizedEvent = vi.fn();
    const refresher = vi.fn();
    window.addEventListener('auth:unauthorized', unauthorizedEvent);
    clearRefreshHandler = setSessionRefreshHandler(refresher);
    api.defaults.adapter = async config => {
      throw Object.assign(new Error('forbidden'), { response: { status: 403 }, config });
    };

    await expect(api.get('/owner-only')).rejects.toMatchObject({ response: { status: 403 } });
    expect(refresher).not.toHaveBeenCalled();
    expect(unauthorizedEvent).not.toHaveBeenCalled();
    window.removeEventListener('auth:unauthorized', unauthorizedEvent);
  });
});
