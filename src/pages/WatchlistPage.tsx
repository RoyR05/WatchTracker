import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/layout/Layout';
import { tmdbService } from '../services/tmdb';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../types/database.types';

type WatchlistItem = Database['public']['Tables']['watchlist_items']['Row'];
type WatchlistStatus = 'watching' | 'completed' | 'plan_to_watch' | 'dropped';

const STATUS_CONFIG: Record<WatchlistStatus, { label: string; color: string; dot: string }> = {
  watching:     { label: 'Watching',     color: 'bg-cyan-600/20 text-cyan-300 border-cyan-700',   dot: 'bg-cyan-500' },
  plan_to_watch:{ label: 'Plan to Watch',color: 'bg-yellow-600/20 text-yellow-300 border-yellow-700', dot: 'bg-yellow-500' },
  completed:    { label: 'Completed',    color: 'bg-green-600/20 text-green-300 border-green-700', dot: 'bg-green-500' },
  dropped:      { label: 'Dropped',      color: 'bg-red-600/20 text-red-300 border-red-700',       dot: 'bg-red-500' },
};

const ALL_STATUSES: WatchlistStatus[] = ['watching', 'plan_to_watch', 'completed', 'dropped'];

type SortKey = 'added' | 'title' | 'year';

export default function WatchlistPage() {
  const { user } = useAuth();
  const [activeStatus, setActiveStatus] = useState<WatchlistStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('added');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [search, setSearch] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['watchlist-full', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WatchlistItem[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Derive counts per status
  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = items.filter(i => i.status === s).length;
    return acc;
  }, {} as Record<WatchlistStatus, number>);

  // Apply filters + sort
  const visible = items
    .filter(i => activeStatus === 'all' || i.status === activeStatus)
    .filter(i => mediaFilter === 'all' || i.media_type === mediaFilter)
    .filter(i => {
      if (!search.trim()) return true;
      return (i.title ?? '').toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      if (sortKey === 'title') return (a.title ?? '').localeCompare(b.title ?? '');
      if (sortKey === 'year') return (b.media_year ?? 0) - (a.media_year ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">My Watchlist</h1>
            <p className="text-gray-400 text-sm">{items.length} title{items.length !== 1 ? 's' : ''} total</p>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setActiveStatus('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeStatus === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All ({items.length})
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                activeStatus === s
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
              {STATUS_CONFIG[s].label} ({counts[s]})
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search titles…"
            className="flex-1 min-w-48 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
          <select
            value={mediaFilter}
            onChange={e => setMediaFilter(e.target.value as 'all' | 'movie' | 'tv')}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All types</option>
            <option value="movie">Movies</option>
            <option value="tv">TV Shows</option>
          </select>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="added">Recently Added</option>
            <option value="title">Title A–Z</option>
            <option value="year">Release Year</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <svg className="mx-auto h-14 w-14 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            {items.length === 0 ? (
              <>
                <p className="text-white font-medium mb-1">Your watchlist is empty</p>
                <p className="text-gray-400 text-sm mb-4">Search for movies and TV shows to start tracking</p>
                <Link
                  to="/search"
                  className="inline-block px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                >
                  Browse & Search
                </Link>
              </>
            ) : (
              <>
                <p className="text-white font-medium mb-1">No results</p>
                <p className="text-gray-400 text-sm">Try adjusting your filters</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {visible.map(item => {
              const cfg = STATUS_CONFIG[item.status as WatchlistStatus];
              return (
                <Link
                  key={item.id}
                  to={`/details/${item.media_type}/${item.tmdb_id}`}
                  className="flex gap-4 bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-colors group"
                >
                  {/* Poster */}
                  <div className="flex-shrink-0 w-14 h-20 rounded overflow-hidden bg-gray-700">
                    <img
                      src={tmdbService.getImageUrl(item.poster_path ?? null, 'w342')}
                      alt={item.title ?? ''}
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate group-hover:text-primary-400 transition-colors">
                          {item.title ?? 'Unknown title'}
                        </p>
                        <p className="text-sm text-gray-400">
                          {item.media_year ?? '—'} · {item.media_type === 'movie' ? 'Movie' : 'TV Show'}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg?.color ?? ''}`}>
                        {cfg?.label ?? item.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Added {new Date(item.created_at).toLocaleDateString()}
                      {item.completed_at && ` · Completed ${new Date(item.completed_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
