import { useEffect, useState } from 'react';
import { tmdbService } from '../../services/tmdb';

export interface StreamingProvider {
  id: number | string;
  name: string;
}

export const STREAMING_PROVIDERS: StreamingProvider[] = [
  { id: 8, name: 'Netflix' },
  { id: 337, name: 'Disney+' },
  { id: 9, name: 'Prime Video' },
  { id: 350, name: 'Apple TV+' },
  { id: 1899, name: 'Max' },
  { id: 15, name: 'Hulu' },
  // TMDB's base "Paramount Plus" (531) returns no /discover results in the
  // US; pipe-OR the real catalog ids so it survives TMDB id drift.
  { id: '531|1853|582|633', name: 'Paramount+' },
  { id: 386, name: 'Peacock' },
];

const CACHE_KEY = 'rf.providers.available';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

interface StreamingBrowserProps {
  onSelect: (providerId: number | string, providerName: string) => void;
}

export function StreamingBrowser({ onSelect }: StreamingBrowserProps) {
  const [available, setAvailable] = useState<StreamingProvider[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Same-day localStorage cache so we don't probe 8 providers every visit.
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { date: string; ids: (number | string)[] };
        if (cached.date === todayStr()) {
          const ids = new Set(cached.ids.map(String));
          setAvailable(STREAMING_PROVIDERS.filter((p) => ids.has(String(p.id))));
          return;
        }
      }
    } catch {
      /* ignore malformed cache */
    }

    (async () => {
      const checks = await Promise.all(
        STREAMING_PROVIDERS.map(async (p) => {
          try {
            const data = await tmdbService.discoverByProvider('tv', p.id, 1);
            return (data.results?.length ?? 0) > 0 ? p : null;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const live = checks.filter((p): p is StreamingProvider => p !== null);
      setAvailable(live);
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ date: todayStr(), ids: live.map((p) => p.id) })
        );
      } catch {
        /* ignore quota */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Browse by Streaming Service</h2>
          <span className="text-sm text-gray-400">What's on each platform</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {available === null
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 w-24 rounded-full bg-gray-700/60 animate-pulse"
                />
              ))
            : available.map((p) => (
                <button
                  key={String(p.id)}
                  onClick={() => onSelect(p.id, p.name)}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-gray-700 text-gray-200 hover:bg-primary-600 hover:text-white transition-colors"
                >
                  {p.name}
                </button>
              ))}
        </div>
      </div>
    </section>
  );
}
