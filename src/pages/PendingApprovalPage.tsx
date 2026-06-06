import { useAuth } from '../contexts/AuthContext';

const FEATURES = [
  { icon: '🎬', label: 'Track movies & TV', detail: 'Watching, Plan to Watch, Completed, Dropped' },
  { icon: '📅', label: 'Never miss a release', detail: 'Coming Soon alerts when your titles drop' },
  { icon: '✨', label: 'Discover what to watch', detail: 'Trending, moods, genres, and streaming services' },
  { icon: '👥', label: 'Follow creators', detail: 'Actors, directors, and writers you love' },
  { icon: '📨', label: 'Share & request', detail: 'Recommend titles to friends and request Plex additions' },
];

export default function PendingApprovalPage() {
  const { profile, signOut } = useAuth();

  const isRejected = profile?.approval_status === 'rejected';

  if (isRejected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Access Denied</h1>
            <p className="text-gray-400 mb-6">
              Your account request was not approved. If you think this is a mistake, reach out to the admin directly.
            </p>
            <button
              onClick={signOut}
              className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4 py-12">
      <div className="max-w-md w-full">

        {/* Main card */}
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">You're on the list!</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Your account is waiting for admin approval. You'll get access as soon as it's confirmed — usually within a day.
          </p>

          {/* Feature preview */}
          <div className="text-left space-y-3 mb-8">
            <p className="text-xs uppercase tracking-wide text-amber-400 font-semibold mb-3 text-center">
              Here's what's waiting for you
            </p>
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-start gap-3 bg-gray-700/50 rounded-lg px-4 py-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{f.label}</p>
                  <p className="text-xs text-gray-400">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={signOut}
            className="w-full py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          RaineyFlixs is a private app — access is invite-only.
        </p>
      </div>
    </div>
  );
}
