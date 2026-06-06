import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
}

interface Step {
  icon: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: '🎬',
    title: 'Welcome to RaineyFlixs',
    body: 'Your personal place to track movies & TV, discover what to watch next, and stay on top of upcoming releases. Here is the quick tour — you can replay it any time from the ? Help menu.',
  },
  {
    icon: '🏠',
    title: 'Your Dashboard',
    body: 'The home screen shows what you are Currently Watching, your Plan to Watch, Coming Soon titles, and trending/popular discovery rows. Tap ⚙ Customize (top-right) to reorder sections or hide the ones you do not need.',
  },
  {
    icon: '🔍',
    title: 'Discover & Browse',
    body: 'Find something new three ways: the Discover page offers Feeling Lucky, mood picks, and content from people you follow. The Browse page (grid icon in Discover) lets you filter by genre, streaming service, rating, and more.',
  },
  {
    icon: '✅',
    title: 'Track what you watch',
    body: 'Add any title to your Watchlist with four statuses — Watching, Plan to Watch, Completed, or Dropped. On TV shows, tap episodes to tick them off individually or use "Mark Season Watched" for a whole season at once.',
  },
  {
    icon: '📅',
    title: 'Plan to Watch — three buckets',
    body: 'Your Plan to Watch list auto-sorts into Available Now, Coming Soon (future release date), and Announced (no date yet). When a Coming Soon title drops, you get a notification so nothing slips by.',
  },
  {
    icon: '👥',
    title: 'Follow people',
    body: 'Follow actors, directors, and creators from any title page or person page. Their new and upcoming work appears in a dedicated row on the Discovery page — great for tracking a favourite director.',
  },
  {
    icon: '📨',
    title: 'Recommend & request',
    body: 'Send a title recommendation to a friend directly from any detail page. If a title is missing from Plex, tap "Check Plex" then "Request it" — you will get a notification when it is added.',
  },
  {
    icon: '🎯',
    title: 'Make it yours',
    body: 'Head to Profile to pick your favourite genres — this personalises Feeling Lucky and Discovery results. While you are there, enable push notifications so episode and release alerts arrive even when the app is closed.',
  },
];

export function OnboardingTour({ open, onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { markOnboarded } = useAuth();

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  async function finish() {
    await markOnboarded();
    onClose();
  }

  async function goToGenres() {
    await markOnboarded();
    onClose();
    navigate('/profile#discovery-preferences');
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300"
      onClick={finish}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
    >
      <div
        className="bg-brand-card border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium text-gray-400">
            Step {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="text-gray-400 hover:text-white transition-colors text-sm"
            aria-label="Skip tour"
          >
            Skip
          </button>
        </div>

        <div className="text-center py-4">
          <div className="text-5xl mb-4">{current.icon}</div>
          <h2 className="text-xl font-bold text-white mb-2">{current.title}</h2>
          <p className="text-sm text-gray-300 leading-relaxed">{current.body}</p>
        </div>

        {/* progress dots */}
        <div className="flex justify-center gap-1.5 my-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary-500' : 'w-2 bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2.5 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 text-sm font-medium transition-colors"
            >
              Back
            </button>
          )}
          {isLast ? (
            <>
              <button
                onClick={finish}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 text-sm font-medium transition-colors"
              >
                Maybe later
              </button>
              <button
                onClick={goToGenres}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
              >
                Set up my genres
              </button>
            </>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
