import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useNotificationStream from './useNotificationStream';

const { streamMock } = vi.hoisted(() => ({ streamMock: vi.fn() }));

vi.mock('../services/notificationService', () => ({
  NotificationStreamError: class NotificationStreamError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  },
  streamNotificationEvents: streamMock
}));

function StreamHarness(props) {
  useNotificationStream(props);
  return null;
}

beforeEach(() => {
  streamMock.mockReset();
});

describe('useNotificationStream', () => {
  it('receives events, reconnects after a lost stream, and aborts on session cleanup', async () => {
    const onNotification = vi.fn();
    const onConnected = vi.fn();
    const onStatus = vi.fn();
    let finalSignal;
    streamMock
      .mockImplementationOnce(async ({ onEvent }) => {
        onEvent({ event: 'connected', payload: {} });
        onEvent({ event: 'notification', payload: { id: 'new-one' }, id: 'new-one' });
        throw new Error('stream closed');
      })
      .mockImplementation(({ signal, onEvent }) => new Promise(resolve => {
        finalSignal = signal;
        onEvent({ event: 'connected', payload: {} });
        signal.addEventListener('abort', resolve, { once: true });
      }));

    const view = render(<StreamHarness enabled sessionKey="owner-id:OWNER" onNotification={onNotification} onConnected={onConnected} onStatus={onStatus} onAuthError={vi.fn()} />);
    await waitFor(() => expect(onNotification).toHaveBeenCalledWith({ id: 'new-one' }, 'new-one'));
    expect(onConnected).toHaveBeenCalledWith({ reconnected: false });

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2), { timeout: 2_000 });
    expect(onConnected).toHaveBeenLastCalledWith({ reconnected: true });

    view.unmount();
    expect(finalSignal.aborted).toBe(true);
  });
});
