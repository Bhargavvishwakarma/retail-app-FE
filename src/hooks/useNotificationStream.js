import { useEffect, useRef } from 'react';
import { NotificationStreamError, streamNotificationEvents } from '../services/notificationService';

const RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000];

/** Owns one fetch-based SSE connection for the mounted authenticated shell. */
export default function useNotificationStream({ enabled, sessionKey, onNotification, onConnected, onStatus, onAuthError }) {
  const callbacks = useRef({ onNotification, onConnected, onStatus, onAuthError });
  useEffect(() => {
    callbacks.current = { onNotification, onConnected, onStatus, onAuthError };
  }, [onNotification, onConnected, onStatus, onAuthError]);

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let reconnectTimer = null;
    let controller = null;
    let reconnectAttempt = 0;
    let connectedBefore = false;

    const scheduleReconnect = immediate => {
      if (stopped || reconnectTimer) return;
      const delay = immediate ? 0 : RECONNECT_DELAYS[Math.min(reconnectAttempt++, RECONNECT_DELAYS.length - 1)];
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = async () => {
      if (stopped) return;
      if (navigator.onLine === false) {
        callbacks.current.onStatus?.('offline');
        scheduleReconnect(false);
        return;
      }
      callbacks.current.onStatus?.(connectedBefore ? 'reconnecting' : 'connecting');
      controller = new AbortController();
      try {
        await streamNotificationEvents({
          signal: controller.signal,
          onEvent: event => {
            if (event.event === 'connected') {
              const reconnected = connectedBefore;
              connectedBefore = true;
              reconnectAttempt = 0;
              callbacks.current.onStatus?.('connected');
              callbacks.current.onConnected?.({ reconnected });
            } else if (event.event === 'notification') {
              callbacks.current.onNotification?.(event.payload, event.id);
            }
            // Heartbeats deliberately only keep the stream alive; no UI work is required.
          }
        });
        if (!controller.signal.aborted) throw new NotificationStreamError('Notification stream ended.');
      } catch (error) {
        if (stopped || controller?.signal.aborted) return;
        if (error instanceof NotificationStreamError && error.status === 401) {
          callbacks.current.onStatus?.('error');
          callbacks.current.onAuthError?.();
          return;
        }
        if (error instanceof NotificationStreamError && error.status === 403) {
          callbacks.current.onStatus?.('error');
          return;
        }
        callbacks.current.onStatus?.(navigator.onLine === false ? 'offline' : 'reconnecting');
        scheduleReconnect(false);
      }
    };

    const handleOnline = () => scheduleReconnect(true);
    const handleOffline = () => {
      callbacks.current.onStatus?.('offline');
      controller?.abort();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      controller?.abort();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, sessionKey]);
}
