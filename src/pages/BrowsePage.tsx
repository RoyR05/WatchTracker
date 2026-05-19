import { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/layout/Layout';
import { MediaCard } from '../components/media/MediaCard';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { tmdbService } from '../services/tmdb';
import { preferencesService } from '../services/preferences';
import { userSettingsService } from '../services/userSettings';
import { FilterPanel } from '../components/browse/FilterPanel';
import type {
  BrowseTab,
  BrowseMediaType,
  BrowseItem,
  BrowseDiscoverOptions,
  Genre,
  WatchProvider,
} from '../services/tmdb';

const TABS: { value: BrowseTab; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'now_playing', label: 'Now Playing' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'top_rated', label: 'Top Rated' },
];

const MEDIA_TYPES: { value: BrowseMediaType; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV' },
];

// Familiar services pinned to the front of the provider list.
const CURATED_PROVIDER_IDS = [8, 337, 9, 350, 1899, 15, 531, 386];

type SortMode = 'interleave' | 'rating' | 'date_asc' | 'date_desc';

function keyOf(it: BrowseItem): string {
  return `${it.id}-${it.media_type}`;
}

function itemDate(it: BrowseItem): string {
  if ('release_date' in it) return it.release_date || '';
  if ('first_air_date' in it) return it.first_air_date || '';
  return '';
}

function resolveSortMode(tab: BrowseTab, sortBy: string): SortMode {
  if (sortBy === 'vote_average.desc') return 'rating';
  if (sortBy === 'popularity.desc') return 'interleave';
  if (sortBy === 'newest') return 'date_desc';
  if (sortBy === '') {
    if (tab === 'top_rated') return 'rating';
    if (tab === 'upcoming') return 'date_asc';
  }
  return 'interleave';
}

function sortItems(items: BrowseItem[], mode: SortMode): BrowseItem[] {
  if (mode === 'rating') {
    return [...items].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  }
  if (mode === 'date_asc') {
    return [...items].sort((a, b) => itemDate(a).localeCompare(itemDate(b)));
  }
  if (mode === 'date_desc') {
    return [...items].sort((a, b) => itemDate(b).localeCompare(itemDate(a)));
  }
  return items;
}

function interleave(movie: BrowseItem[], tv: BrowseItem[]): BrowseItem[] {
  const out: BrowseItem[] = [];
  const n = Math.max(movie.length, tv.length);
  for (let i = 0; i < n; i++) {
    if (i < movie.length) out.push(movie[i]);
    if (i < tv.length) out.push(tv[i]);
  }
  return out;
}

export default function BrowsePage() {
  const { user } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<BrowseTab>('popular');
  const [mediaType, setMediaType] = useState<BrowseMediaType>('both');
  const [genres, setGenres] = useState<number[]>([]);
  const [providers, setProviders] = useState<Array<number | string>>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [results, setResults] = useState<BrowseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [preferenceMap, setPreferenceMap] = useState<Map<string, 'like' | 'dislike'>>(
    new Map()
  );

  const [genreList, setGenreList] = useState<Genre[]>([]);
  const [providerList, setProviderList] = useState<WatchProvider[]>([]);
  const [englishOnly, setEnglishOnly] = useState(false);
  const [ready, setReady] = useState(false);

  const moviePageRef = useRef(1);
  const tvPageRef = useRef(1);
  const moviePagesTotalRef = useRef(1);
  const tvPagesTotalRef = useRef(1);
  const seenRef = useRef<Set<string>>(new Set());
  const reqIdRef = useRef(0);

  // ---- Mount: load filter option lists + english-only setting ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [mg, tg] = await Promise.allSettled([
        tmdbService.getGenres('movie'),
        tmdbService.getGenres('tv'),
      ]);
      const genreMap = new Map<number, Genre>();
      if (mg.status === 'fulfilled')
        for (const g of mg.value.genres) genreMap.set(g.id, g);
      if (tg.status === 'fulfilled')
        for (const g of tg.value.genres) if (!genreMap.has(g.id)) genreMap.set(g.id, g);
      const mergedGenres = [...genreMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      const [mp, tp] = await Promise.allSettled([
        tmdbService.getWatchProviders('movie'),
        tmdbService.getWatchProviders('tv'),
      ]);
      const provMap = new Map<number, WatchProvider>();
      if (mp.status === 'fulfilled')
        for (const p of mp.value.results) provMap.set(p.provider_id, p);
      if (tp.status === 'fulfilled')
        for (const p of tp.value.results)
          if (!provMap.has(p.provider_id)) provMap.set(p.provider_id, p);
      const mergedProviders = [...provMap.values()].sort((a, b) => {
        const ai = CURATED_PROVIDER_IDS.indexOf(a.provider_id);
        const bi = CURATED_PROVIDER_IDS.indexOf(b.provider_id);
        const ar = ai === -1 ? Infinity : ai;
        const br = bi === -1 ? Infinity : bi;
        if (ar !== br) return ar - br;
        return a.display_priority - b.display_priority;
      });

      let savedEnglishOnly = false;
      try {
        savedEnglishOnly = await userSettingsService.getEnglishOnlyFilter();
      } catch {
        /* default false */
      }

      if (cancelled) return;
      setGenreList(mergedGenres);
      setProviderList(mergedProviders.slice(0, 40));
      setEnglishOnly(savedEnglishOnly);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function buildOpts(page: number, mtOverride?: BrowseMediaType): BrowseDiscoverOptions {
    return {
      tab,
      mediaType: mtOverride ?? mediaType,
      genres,
      providers,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      minRating,
      sortBy,
      page,
      englishOnly,
    };
  }

  function takeNew(items: BrowseItem[]): BrowseItem[] {
    const out: BrowseItem[] = [];
    for (const it of items) {
      const k = keyOf(it);
      if (seenRef.current.has(k)) continue;
      seenRef.current.add(k);
      out.push(it);
    }
    return out;
  }

  async function fetchStream(mt: 'movie' | 'tv', page: number) {
    return tmdbService.browseDiscover(buildOpts(page, mt));
  }

  // ---- Query (reset) on any tab/type/filter change ----
  useEffect(() => {
    if (!ready) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setResults([]);
    setHasMore(false);
    seenRef.current = new Set();
    moviePageRef.current = 1;
    tvPageRef.current = 1;

    (async () => {
      try {
        if (mediaType === 'both') {
          const [mr, tr] = await Promise.all([
            fetchStream('movie', 1),
            fetchStream('tv', 1),
          ]);
          if (reqId !== reqIdRef.current) return;
          moviePagesTotalRef.current = mr.total_pages;
          tvPagesTotalRef.current = tr.total_pages;
          const m = takeNew(mr.results);
          const t = takeNew(tr.results);
          const mode = resolveSortMode(tab, sortBy);
          const merged =
            mode === 'interleave' ? interleave(m, t) : sortItems([...m, ...t], mode);
          setResults(merged);
          setHasMore(
            moviePageRef.current < moviePagesTotalRef.current ||
              tvPageRef.current < tvPagesTotalRef.current
          );
        } else {
          const res = await tmdbService.browseDiscover(buildOpts(1));
          if (reqId !== reqIdRef.current) return;
          moviePagesTotalRef.current = res.total_pages;
          setResults(takeNew(res.results));
          setHasMore(1 < res.total_pages);
        }
      } catch {
        if (reqId === reqIdRef.current) toast.error('Failed to load titles');
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tab, mediaType, genres, providers, dateFrom, dateTo, minRating, sortBy, englishOnly]);

  async function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    const reqId = reqIdRef.current;
    setLoadingMore(true);
    try {
      if (mediaType === 'both') {
        const tasks: Array<Promise<{ results: BrowseItem[] }>> = [];
        let fetchedMovie = false;
        let fetchedTv = false;
        if (moviePageRef.current < moviePagesTotalRef.current) {
          moviePageRef.current += 1;
          fetchedMovie = true;
          tasks.push(fetchStream('movie', moviePageRef.current));
        }
        if (tvPageRef.current < tvPagesTotalRef.current) {
          tvPageRef.current += 1;
          fetchedTv = true;
          tasks.push(fetchStream('tv', tvPageRef.current));
        }
        const settled = await Promise.all(tasks);
        if (reqId !== reqIdRef.current) return;
        let idx = 0;
        const newMovie = fetchedMovie ? takeNew(settled[idx++].results) : [];
        const newTv = fetchedTv ? takeNew(settled[idx++].results) : [];
        const mode = resolveSortMode(tab, sortBy);
        setResults(prev =>
          mode === 'interleave'
            ? [...prev, ...interleave(newMovie, newTv)]
            : sortItems([...prev, ...newMovie, ...newTv], mode)
        );
        setHasMore(
          moviePageRef.current < moviePagesTotalRef.current ||
            tvPageRef.current < tvPagesTotalRef.current
        );
      } else {
        moviePageRef.current += 1;
        const res = await tmdbService.browseDiscover(
          buildOpts(moviePageRef.current)
        );
        if (reqId !== reqIdRef.current) return;
        setResults(prev => [...prev, ...takeNew(res.results)]);
        setHasMore(moviePageRef.current < moviePagesTotalRef.current);
      }
    } catch {
      toast.error('Failed to load more titles');
    } finally {
      setLoadingMore(false);
    }
  }

  const { observerTarget } = useInfiniteScroll({
    hasMore,
    isLoading: loadingMore || loading,
    onLoadMore: loadMore,
  });

  // ---- Batch-load user preferences for the rendered results ----
  useEffect(() => {
    if (!user || results.length === 0) return;
    const items = results.map(item => ({
      tmdbId: item.id,
      mediaType: item.media_type,
    }));
    preferencesService.getPreferencesForItems(items, user.id).then(setPreferenceMap);
  }, [user, results]);

  const secondTabLabel =
    mediaType === 'tv' ? 'Airing' : mediaType === 'both' ? 'On Air' : 'Now Playing';

  const activeFilterCount =
    genres.length +
    providers.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (sortBy ? 1 : 0);

  function clearFilters() {
    setGenres([]);
    setProviders([]);
    setDateFrom('');
    setDateTo('');
    setMinRating(0);
    setSortBy('');
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Browse</h1>

        {/* Category tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t.value === 'now_playing' ? secondTabLabel : t.label}
            </button>
          ))}
        </div>

        {/* Media type toggle + Filters button */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="inline-flex bg-gray-800 rounded-full p-1 border border-gray-700">
            {MEDIA_TYPES.map(m => (
              <button
                key={m.value}
                onClick={() => setMediaType(m.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  mediaType === m.value
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-full text-sm text-white hover:border-primary-500 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.879a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold bg-primary-600 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <FilterPanel
            genres={genreList}
            providers={providerList}
            selectedGenres={genres}
            selectedProviders={providers}
            dateFrom={dateFrom}
            dateTo={dateTo}
            minRating={minRating}
            sortBy={sortBy}
            onGenresChange={setGenres}
            onProvidersChange={setProviders}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onMinRatingChange={setMinRating}
            onSortByChange={setSortBy}
            onClear={clearFilters}
          />
        )}

        {loading ? (
          <SkeletonGrid count={20} />
        ) : results.length > 0 ? (
          <div>
            <p className="text-gray-400 mb-4 text-sm">
              {results.length} title{results.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((item, index) => (
                <MediaCard
                  key={`${item.id}-${item.media_type}-${index}`}
                  item={item}
                  mediaType={item.media_type}
                  initialPreference={
                    preferenceMap.get(`${item.id}-${item.media_type}`) ?? null
                  }
                />
              ))}
            </div>
            {hasMore && (
              <div ref={observerTarget} className="mt-8">
                {loadingMore && <SkeletonGrid count={12} />}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-white font-medium mb-1">No titles match these filters</p>
            <p className="text-gray-400 text-sm">
              Try widening your date range or removing some genres and services.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
