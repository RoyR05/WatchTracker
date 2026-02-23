interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_DURATION = 5 * 60 * 1000;

export const CacheTTL = {
  SHORT: 60 * 1000,
  MEDIUM: 5 * 60 * 1000,
  LONG: 30 * 60 * 1000,
  SEARCH: 2 * 60 * 1000,
  TRENDING: 10 * 60 * 1000,
  DETAILS: 30 * 60 * 1000,
  DISCOVERY: 15 * 60 * 1000,
  CREDITS: 60 * 60 * 1000,
  VIDEOS: 60 * 60 * 1000,
};

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCache<T>(key: string, data: T, _ttl?: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function clearCache(): void {
  cache.clear();
}

export function generateKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

export const apiCache = {
  get: getCached,
  set: setCache,
  clear: clearCache,
  generateKey,
};
