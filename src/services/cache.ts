export enum CacheTTL {
  SHORT = 5 * 60 * 1000,
  MEDIUM = 30 * 60 * 1000,
  LONG = 24 * 60 * 60 * 1000,
  SEARCH = 60 * 60 * 1000,
  TRENDING = 6 * 60 * 60 * 1000,
  DETAILS = 12 * 60 * 60 * 1000,
  DISCOVERY = 6 * 60 * 60 * 1000,
  CREDITS = 12 * 60 * 60 * 1000,
  VIDEOS = 12 * 60 * 60 * 1000,
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class APICache {
  private cache: Map<string, CacheEntry> = new Map();

  generateKey(endpoint: string, params: Record<string, string> = {}): string {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `${endpoint}${paramStr ? '?' + paramStr : ''}`;
  }

  set(key: string, data: any, ttl: number = CacheTTL.MEDIUM) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear() {
    this.cache.clear();
  }
}

export const apiCache = new APICache();
