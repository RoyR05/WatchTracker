import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Saves the page scroll position to sessionStorage when navigating away,
 * and restores it on mount. Keyed by React Router's location.key so each
 * history entry gets its own saved position.
 *
 * Call this near the top of any page component that benefits from scroll
 * restoration (Dashboard, Discovery, Search, Watchlist).
 */
export function useScrollRestoration() {
  const { key } = useLocation();
  const storageKey = `scroll:${key}`;

  // Restore scroll position synchronously after paint to avoid flash
  useLayoutEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      window.scrollTo(0, parseInt(saved, 10));
    } else {
      window.scrollTo(0, 0);
    }
  }, [storageKey]);

  // Save position on unmount (navigating away) and on visibility change
  useEffect(() => {
    function save() {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    }
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
    return () => {
      save(); // save on React unmount (route change)
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', save);
    };
  }, [storageKey]);
}
