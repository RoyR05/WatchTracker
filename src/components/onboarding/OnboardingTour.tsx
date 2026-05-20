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
    body: 'Your personal place to track movies & TV, discover what to watch next, and share picks with friends. Here is the 30-second tour.',
  },
  {
    icon: '🔍',
    title: 'Discover & Search',
    body: 'Search movies, TV shows, and people. Browse the Discovery page for trending titles, mood picks, genres, and what is on each streaming service.',
  },
  {
    icon: '✅',
    title: 'Track what you watch',
    body: 'Add titles to your Watchlist (Watching, Plan to Watch, Completed, Dropped), tick off episodes, and see upcoming releases on the Calendar.',
  },
  {
    icon: '👥',
    title: 'Follow people',
    body: 'Follow actors, directors, and creators from any title or person page. Their new & upcoming work shows up in a row on Discovery.',
  },
  {
    icon: '📨',
    title: 'Recommend & request',
    body: 'Recommend titles to friends, and request anything missing from Plex right from a title page.',
  },
  {
    icon: '👆',
    title: 'Handy gestures (mobile)',
    body: 'On a phone: swipe a card right to add to Plan to Watch, swipe left to mark Completed.',
  },
  {
    icon: '🎯',
    title: 'Set up your taste',
    body: 'Pick a few favorite genres in your Profile so Discovery and Feeling Lucky are tailored to you. It only takes a moment.',
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
