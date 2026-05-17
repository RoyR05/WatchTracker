import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __deferredInstallPrompt?: BeforeInstallPromptEvent;
  }
}

const SNOOZE_KEY = 'rf.installDismissedAt';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function isSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Number.isFinite(ts) && Date.now() - ts < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== 'undefined' && window.__deferredInstallPrompt) || null
  );
  const [installed, setInstalled] = useState(false);
  const [snoozed, setSnoozed] = useState(isSnoozed);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  // Real Safari only (exclude Chrome/Firefox on iOS — they can't add to home screen)
  const isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
      window.__deferredInstallPrompt = undefined;
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user dismissed or unsupported */
    } finally {
      setDeferred(null);
      window.__deferredInstallPrompt = undefined;
    }
  }, [deferred]);

  const snooze = useCallback(() => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore quota */
    }
    setSnoozed(true);
  }, []);

  return {
    canInstall: !!deferred && !isStandalone && !installed,
    iosInstallable: isIOSSafari && !isStandalone,
    isStandalone: !!isStandalone,
    snoozed,
    promptInstall,
    snooze,
  };
}
