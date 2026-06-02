import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

/**
 * Converts the URL-safe base64 VAPID public key to a Uint8Array
 * required by the Push API's applicationServerKey.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64url = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64url);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type SubscribeResult = 'granted' | 'denied' | 'unsupported' | 'error';

export const pushNotificationService = {
  /**
   * Returns true if this browser supports Web Push (serviceWorker + PushManager + Notification).
   * Note: iOS Safari requires the app to be installed as a PWA (iOS 16.4+).
   */
  isSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  /** Current OS-level notification permission state. */
  getPermission(): NotificationPermission {
    return Notification.permission;
  },

  /** True if the browser already has an active push subscription registered. */
  async isSubscribed(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      return !!(await reg.pushManager.getSubscription());
    } catch {
      return false;
    }
  },

  /**
   * Requests permission, subscribes to the Push API, and stores the
   * subscription endpoint in Supabase so the server can send pushes.
   *
   * Returns:
   *  'granted'     — permission granted and subscription stored
   *  'denied'      — user denied permission
   *  'unsupported' — browser does not support push
   *  'error'       — unexpected failure (logged to console)
   */
  async subscribe(userId: string): Promise<SubscribeResult> {
    if (!this.isSupported()) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: 'user_id,endpoint' }
      );

      if (error) {
        console.error('[Push] Failed to store subscription:', error);
        return 'error';
      }

      return 'granted';
    } catch (err) {
      console.error('[Push] subscribe error:', err);
      return 'error';
    }
  },

  /**
   * Unsubscribes from push notifications and removes the subscription
   * from Supabase so no further pushes are sent.
   */
  async unsubscribe(userId: string): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint);

      await sub.unsubscribe();
    } catch (err) {
      console.error('[Push] unsubscribe error:', err);
    }
  },
};
