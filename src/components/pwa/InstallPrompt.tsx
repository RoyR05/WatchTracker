interface InstallPromptProps {
  canInstall: boolean;
  iosInstallable: boolean;
  snoozed: boolean;
  isStandalone: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallPrompt({
  canInstall,
  iosInstallable,
  snoozed,
  isStandalone,
  onInstall,
  onDismiss,
}: InstallPromptProps) {
  if (isStandalone || snoozed) return null;
  if (!canInstall && !iosInstallable) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 md:bottom-4 md:left-auto md:right-4 md:max-w-sm z-40 animate-in slide-in-from-bottom duration-300">
      <div className="bg-brand-card border border-white/10 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <img
          src="/logos/raineyflix-mark-transparent.png"
          alt="RaineyFlixs"
          className="w-10 h-10 object-contain flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Install RaineyFlixs</p>
          {canInstall ? (
            <>
              <p className="text-gray-400 text-xs mt-0.5">
                Add it to your home screen for a full-screen, app-like experience.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={onInstall}
                  className="px-4 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
                >
                  Install
                </button>
                <button
                  onClick={onDismiss}
                  className="px-4 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium transition-colors"
                >
                  Not now
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-400 text-xs mt-0.5">
                Tap the Share icon{' '}
                <svg
                  className="inline w-3.5 h-3.5 -mt-0.5 text-primary-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>{' '}
                then <span className="text-white font-medium">Add to Home Screen</span>.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={onDismiss}
                  className="px-4 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium transition-colors"
                >
                  Got it
                </button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
