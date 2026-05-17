import { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/layout/Layout';
import { FeelingLucky } from '../components/discovery/FeelingLucky';
import { MoodDiscovery } from '../components/discovery/MoodDiscovery';
import { GenreBrowser } from '../components/discovery/GenreBrowser';
import { GenreResults } from '../components/discovery/GenreResults';
import { StreamingBrowser } from '../components/discovery/StreamingBrowser';
import { NetworkResults } from '../components/discovery/NetworkResults';
import { MediaCard } from '../components/media/MediaCard';
import { tmdbService } from '../services/tmdb';
import { userSettingsService } from '../services/userSettings';
import { preferencesService } from '../services/preferences';
import { followedPeopleService, FollowedFeedItem } from '../services/followedPeople';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Movie, TVShow } from '../services/tmdb';

function feedItemToMedia(it: FollowedFeedItem): Movie | TVShow {
  const base = {
    id: it.tmdb_id,
    overview: '',
    poster_path: it.poster_path,
    backdrop_path: null,
    vote_average: it.vote_average,
    genre_ids: [] as number[],
  };
  return it.media_type === 'movie'
    ? { ...base, title: it.title, release_date: it.release_date }
    : { ...base, name: it.title, first_air_date: it.release_date };
}

export default function DiscoveryPage() {
  const { user } = useAuth();
  const [selectedGenre, setSelectedGenre] = useState<{ id: number; name: string } | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<{ id: number | string; name: string } | null>(null);
  const [trendingToday, setTrendingToday] = useState<Array<Movie | TVShow>>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [englishOnly, setEnglishOnly] = useState(false);
  const [preferenceMap, setPreferenceMap] = useState<Map<string, 'like' | 'dislike'>>(new Map());
  const [rawFollowedItems, setRawFollowedItems] = useState<FollowedFeedItem[]>([]);
  const [followedItems, setFollowedItems] = useState<Array<Movie | TVShow>>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(true);
  const [followedPrefMap, setFollowedPrefMap] = useState<Map<string, 'like' | 'dislike'>>(new Map());
  const [followedPersonFilter, setFollowedPersonFilter] = useState<string>('all');

  useEffect(() => {
    if (!user || trendingToday.length === 0) return;
    const items = trendingToday.map(item => ({
      tmdbId: item.id,
      mediaType: ('title' in item ? 'movie' : 'tv') as 'movie' | 'tv',
    }));
    preferencesService.getPreferencesForItems(items, user.id).then(setPreferenceMap);
  }, [user, trendingToday]);

  useEffect(() => {
    async function loadSettings() {
      const savedEnglishOnly = await userSettingsService.getEnglishOnlyFilter();
      setEnglishOnly(savedEnglishOnly);
    }
    loadSettings();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadFollowedFeed() {
      setLoadingFollowed(true);
      try {
        const feed = await followedPeopleService.getFollowedFeed();
        if (cancelled || feed.length === 0) {
          if (!cancelled) setFollowedItems([]);
          return;
        }
        // Exclude titles already on the user's watchlist
        const { data: wl } = await supabase
          .from('watchlist_items')
          .select('tmdb_id, media_type')
          .eq('user_id', user!.id)
          .in('tmdb_id', feed.map(f => f.tmdb_id));
        const onList = new Set((wl ?? []).map(w => `${w.tmdb_id}-${w.media_type}`));
        const visible = feed.filter(f => !onList.has(`${f.tmdb_id}-${f.media_type}`));
        if (cancelled) return;

        setRawFollowedItems(visible);
        setFollowedPersonFilter('all');
        const media = visible.map(feedItemToMedia);
        setFollowedItems(media);

        const prefItems = visible.map(f => ({ tmdbId: f.tmdb_id, mediaType: f.media_type }));
        if (prefItems.length > 0) {
          const pm = await preferencesService.getPreferencesForItems(prefItems, user!.id);
          if (!cancelled) setFollowedPrefMap(pm);
        }
      } catch (error) {
        console.error('Error loading followed feed:', error);
      } finally {
        if (!cancelled) setLoadingFollowed(false);
      }
    }
    loadFollowedFeed();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    async function loadTrendingToday() {
      setLoadingTrending(true);
      try {
        const data = await tmdbService.getTrending('all', 'day', 1, englishOnly);
        if (data && data.results) {
          setTrendingToday(data.results.slice(0, 10));
        }
      } catch (error) {
        console.error('Error loading trending today:', error);
      } finally {
        setLoadingTrending(false);
      }
    }

    loadTrendingToday();
  }, [englishOnly]);

  const handleGenreSelect = (genreId: number, genreName: string) => {
    setSelectedGenre({ id: genreId, name: genreName });
  };

  const handleBackToGenres = () => {
    setSelectedGenre(null);
  };

  const followedPeople = useMemo(() =>
    Array.from(new Set(rawFollowedItems.map(i => i.person_name))).sort(),
    [rawFollowedItems]
  );

  const visibleFollowed = useMemo(() => {
    const filtered = followedPersonFilter === 'all'
      ? rawFollowedItems
      : rawFollowedItems.filter(i => i.person_name === followedPersonFilter);
    return filtered.map(feedItemToMedia);
  }, [rawFollowedItems, followedPersonFilter]);

  async function hideFollowedItem(tmdbId: number) {
    const raw = rawFollowedItems.find(i => i.tmdb_id === tmdbId);
    const mediaType = raw?.media_type ?? (followedItems.find(i => i.id === tmdbId) && 'title' in followedItems.find(i => i.id === tmdbId)! ? 'movie' : 'tv');
    const hadDate = !!(raw?.release_date);
    await followedPeopleService.hideFromFeed(tmdbId, mediaType as 'movie' | 'tv', hadDate);
    setRawFollowedItems(prev => prev.filter(i => i.tmdb_id !== tmdbId));
    setFollowedItems(prev => prev.filter(i => i.id !== tmdbId));
    // Invalidate cache so next reload recomputes without this item
    await followedPeopleService.invalidateCache();
  }

  if (selectedProvider) {
    return (
      <Layout>
        <NetworkResults
          providerId={selectedProvider.id}
          providerName={selectedProvider.name}
          onBack={() => setSelectedProvider(null)}
        />
      </Layout>
    );
  }

  if (selectedGenre) {
    return (
      <Layout>
        <GenreResults
          genreId={selectedGenre.id}
          genreName={selectedGenre.name}
          onBack={handleBackToGenres}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Discover</h1>
          <p className="text-gray-400">Explore new movies and TV shows</p>
        </div>

        <section className="flex justify-center">
          <FeelingLucky />
        </section>

        <section>
          <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Today's Top Trending</h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                Updated hourly
              </div>
            </div>

            {loadingTrending ? (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-32 sm:w-40">
                    <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                {trendingToday.map((item, index) => {
                  const mt = 'title' in item ? 'movie' : 'tv';
                  return (
                    <div key={item.id} className="flex-shrink-0 w-32 sm:w-40 snap-start relative">
                      <div className="absolute -top-2 -left-2 z-10 w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">
                        {index + 1}
                      </div>
                      <MediaCard
                        item={item}
                        mediaType={mt}
                        initialPreference={preferenceMap.get(`${item.id}-${mt}`) ?? null}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {(loadingFollowed || followedItems.length > 0) && (
          <section>
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white">From People You Follow</h2>
                <span className="text-sm text-gray-400">New &amp; upcoming</span>
              </div>

              {followedPeople.length >= 1 && (
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                  <button
                    onClick={() => setFollowedPersonFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                      followedPersonFilter === 'all'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >All</button>
                  {followedPeople.map(name => (
                    <button
                      key={name}
                      onClick={() => setFollowedPersonFilter(name)}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                        followedPersonFilter === name
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >{name}</button>
                  ))}
                </div>
              )}

              {loadingFollowed ? (
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-32 sm:w-40">
                      <div className="bg-gray-800 animate-pulse rounded-lg aspect-[2/3]" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                  {visibleFollowed.map((item) => {
                    const mt = 'title' in item ? 'movie' : 'tv';
                    return (
                      <div key={`${item.id}-${mt}`} className="flex-shrink-0 w-32 sm:w-40 snap-start">
                        <MediaCard
                          item={item}
                          mediaType={mt}
                          initialPreference={followedPrefMap.get(`${item.id}-${mt}`) ?? null}
                          onDislike={(id) => hideFollowedItem(id)}
                          onHide={hideFollowedItem}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        <MoodDiscovery />

        <StreamingBrowser
          onSelect={(id, name) => setSelectedProvider({ id, name })}
        />

        <GenreBrowser onGenreSelect={handleGenreSelect} />
      </div>
    </Layout>
  );
}
