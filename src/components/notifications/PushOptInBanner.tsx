import { useState, useEffect } from 'react';
import { pushNotificationService } from '../../services/pushNotificationService';

const DISMISS_KEY = 'pushBannerDismissedUntil';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface PushOptInBannerProps {
  userId: string;
}

type BannerStatus = 'checking' | 'prompt' | 'denied' | 'hidden';

/**
 * Shown at the top of the Dashboard for users who haven't enabled push
 * notifications yet. Tracks dismissal in localStorage for 7 days.
 * Automatically hides once the user grants permission, and shows
 * alternative "check settings" messaging if permission is already denied.
 */
export function PushOptInBanner({ userId }: PushOptInBannerProps) {
  const [status, setStatus] = useState<BannerStatus>('checking');
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    async function check() {
      // Don't show if browser doesn't support push
      if (!pushNotificationService.isSupported()) {
        setStatus('hidden');
        return;
      }
      // Don't show if already subscribed
      const subscribed = await pushNotificationService.isSubscribed();
      if (subscribed) {
        setStatus('hidden');
        return;
      }
      // Don't show if user dismissed recently
      const until = localStorage.getItem(DISMISS_KEY);
      if (until && Date.now() < parseInt(until, 10)) {
        setStatus('hidden');
        return;
      }
      // Show denied-state message or normal prompt
      const permission = pushNotificationService.getPermission();
      setStatus(permission === 'denied' ? 'denied' : 'prompt');
    }
    check();
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DURATION_MS));
    setStatus('hidden');
  }

  async function enable() {
    setEnabling(true);
    try {
      const result = await pushNotificationService.subscribe(userId);
      if (result === 'granted') {
        setStatus('hidden');
      } else if (result === 'denied') {
        setStatus('denied');
      }
    } finally {
      setEnabling(false);
    }
  }

  if (status === 'hidden' || status === 'checking') return null;

  return (
    <div className="flex items-start gap-3 bg-primary-950/60 border border-primary-700/60 rounded-xl px-4 py-3">
      {/* Bell icon */}
      <div className="flex-shrink-0 w-9 h-9 bg-primary-600/30 rounded-full flex items-center justify-center mt-0.5">
        <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        {status === 'denied' ? (
          <>
            <p className="text-sm font-medium text-white">Push notifications are blocked</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Enable them in your browser or device notification settings, then come back to turn them on in your Profile.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-white">Get notified on your device</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Alerts for new episodes, season finales, and recommendations — even when the app is closed.
            </p>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-1">
        {status === 'prompt' && (
          <button
            onClick={enable}
            disabled={enabling}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {enabling ? 'Enabling…' : 'Enable'}
          </button>
        )}
        <button
          onClick={dismiss}
          className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded-lg"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
