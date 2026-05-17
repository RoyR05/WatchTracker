import { ReactNode, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAdmin } from '../../hooks/useAdmin';
import { supabase } from '../../lib/supabase';
import { checkUpcomingEpisodeNotifications } from '../../services/episodeNotifications';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import { HelpPanel } from '../help/HelpPanel';
import { InstallPrompt } from '../pwa/InstallPrompt';
import { usePwaInstall } from '../../hooks/usePwaInstall';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { profile, user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const pwa = usePwaInstall();

  // First-run: auto-open the welcome tour once per account.
  useEffect(() => {
    if (profile && profile.approval_status === 'approved' && !profile.onboarded_at) {
      setTourOpen(true);
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      loadPendingCount();
      loadUnreadNotifications();
      checkUpcomingEpisodeNotifications(user.id); // fire-and-forget, once per day

      const recsChannel = supabase
        .channel('recommendations_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'recommendations',
            filter: `to_user_id=eq.${user.id}`
          },
          () => {
            loadPendingCount();
          }
        )
        .subscribe();

      const notifsChannel = supabase
        .channel('notifications_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            loadUnreadNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(recsChannel);
        supabase.removeChannel(notifsChannel);
      };
    }
  }, [user]);

  async function loadPendingCount() {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from('recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      setPendingCount(count || 0);
    } catch (error) {
      console.error('Error loading pending recommendations:', error);
    }
  }

  async function loadUnreadNotifications() {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadNotifications(count || 0);
    } catch (error) {
      console.error('Error loading unread notifications:', error);
    }
  }

  return (
    <div className="min-h-screen bg-transparent">
      <nav className="bg-brand-bg/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <NavLink to="/" className="flex items-center" aria-label="RaineyFlixs home">
                <img
                  src="/logos/raineyflix-full-logo-transparent.png"
                  alt="RaineyFlixs"
                  className="hidden sm:block h-8 w-auto object-contain"
                />
                <img
                  src="/logos/raineyflix-mark-transparent.png"
                  alt="RaineyFlixs"
                  className="sm:hidden h-8 w-8 object-contain"
                />
              </NavLink>
              <div className="hidden md:flex space-x-4">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/discovery"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  Discovery
                </NavLink>
                <NavLink
                  to="/following"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  Following
                </NavLink>
                <NavLink
                  to="/search"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  Search
                </NavLink>
                <NavLink
                  to="/watchlist"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  Watchlist
                </NavLink>
                <NavLink
                  to="/lists"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  My Lists
                </NavLink>
                <NavLink
                  to="/calendar"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  Calendar
                </NavLink>
                <NavLink
                  to="/recommendations"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  Recommendations
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setHelpOpen(true)}
                className="text-gray-300 hover:text-white transition-colors"
                aria-label="Help"
                title="Help"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <NavLink
                to="/notifications"
                className="relative text-gray-300 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </NavLink>
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className="px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
                >
                  Admin
                </NavLink>
              )}
              <NavLink
                to="/profile"
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-gray-600"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {profile?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <span className="hidden sm:block text-sm">{profile?.username}</span>
              </NavLink>
              <button
                onClick={signOut}
                className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {children}
      </main>

      <footer className="bg-brand-soft/70 border-t border-white/10 py-6 mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="flex items-center space-x-3">
              <img
                src="/logos/raineyflix-full-logo-transparent.png"
                alt="RaineyFlixs"
                className="h-7 w-auto object-contain"
              />
              <span className="text-gray-400 text-xs">Your Personal Streaming Tracker</span>
            </div>
            <p className="text-gray-500 text-xs text-center max-w-2xl">
              This product uses the TMDB API but is not endorsed or certified by TMDB.
            </p>
          </div>
        </div>
      </footer>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
        <div className="flex justify-around">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs mt-1">Home</span>
          </NavLink>
          <NavLink
            to="/calendar"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs mt-1">Calendar</span>
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs mt-1">Search</span>
          </NavLink>
          <NavLink
            to="/watchlist"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className="text-xs mt-1">Watchlist</span>
          </NavLink>
          <NavLink
            to="/recommendations"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 relative ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`
            }
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1/4 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
            <span className="text-xs mt-1">Recs</span>
          </NavLink>
        </div>
      </nav>

      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onReplayTour={() => {
          setHelpOpen(false);
          setTourOpen(true);
        }}
        installAvailable={pwa.canInstall}
        onInstall={() => {
          setHelpOpen(false);
          pwa.promptInstall();
        }}
      />
      <InstallPrompt
        canInstall={pwa.canInstall}
        iosInstallable={pwa.iosInstallable}
        snoozed={pwa.snoozed}
        isStandalone={pwa.isStandalone}
        onInstall={pwa.promptInstall}
        onDismiss={pwa.snooze}
      />
    </div>
  );
}
