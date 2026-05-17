import { supabase } from '../lib/supabase';
import { tmdbService } from './tmdb';

export interface FollowedPerson {
  id: string;
  person_id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string | null;
  created_at: string;
}

export interface FollowInput {
  person_id: number;
  name: string;
  profile_path?: string | null;
  known_for_department?: string | null;
}

export interface FollowedFeedItem {
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  year: number | null;
  vote_average: number;
  release_date: string;
  person_name: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * DAY_MS;

export const followedPeopleService = {
  async listFollowed(): Promise<FollowedPerson[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('followed_people')
      .select('id, person_id, name, profile_path, known_for_department, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('listFollowed failed:', error);
      return [];
    }
    return (data ?? []) as FollowedPerson[];
  },

  async listFollowedIds(): Promise<Set<number>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();
    const { data, error } = await supabase
      .from('followed_people')
      .select('person_id')
      .eq('user_id', user.id);
    if (error) {
      console.error('listFollowedIds failed:', error);
      return new Set();
    }
    return new Set((data ?? []).map((r) => r.person_id as number));
  },

  async isFollowing(personId: number): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('followed_people')
      .select('id')
      .eq('user_id', user.id)
      .eq('person_id', personId)
      .maybeSingle();
    return !!data;
  },

  async follow(person: FollowInput): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const { error } = await supabase.from('followed_people').upsert(
      {
        user_id: user.id,
        person_id: person.person_id,
        name: person.name,
        profile_path: person.profile_path ?? null,
        known_for_department: person.known_for_department ?? null,
      },
      { onConflict: 'user_id,person_id', ignoreDuplicates: true }
    );
    if (error) {
      console.error('follow failed:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  async unfollow(personId: number): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    const { error } = await supabase
      .from('followed_people')
      .delete()
      .eq('user_id', user.id)
      .eq('person_id', personId);
    if (error) {
      console.error('unfollow failed:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  // Scan followed people's combined credits for upcoming / just-released titles.
  async computeNewReleasesFromFollowed(): Promise<FollowedFeedItem[]> {
    const people = await this.listFollowed();
    if (people.length === 0) return [];

    const now = Date.now();
    const byKey = new Map<string, FollowedFeedItem>();
    const noDate = new Map<string, FollowedFeedItem>();

    // Bounded-concurrency fan-out (chunks of 5) instead of a sequential
    // sleep loop — much faster first build, still gentle on the proxy.
    const CHUNK = 5;
    for (let i = 0; i < people.length; i += CHUNK) {
      const chunk = people.slice(i, i + CHUNK);
      const results = await Promise.all(
        chunk.map(async (p) => {
          try {
            const credits = await tmdbService.getPersonCombinedCredits(p.person_id);
            return { p, credits };
          } catch (err) {
            console.error(`combined_credits failed for ${p.name}:`, err instanceof Error ? err.message : err);
            return null;
          }
        })
      );

      for (const r of results) {
        if (!r) continue;
        const { p, credits } = r;
        const entries = [
          ...((credits.cast as any[]) ?? []),
          ...((credits.crew as any[]) ?? []),
        ];
        for (const e of entries) {
          const mediaType: 'movie' | 'tv' =
            e.media_type === 'tv' ? 'tv' : e.media_type === 'movie' ? 'movie' : ('title' in e ? 'movie' : 'tv');
          const date: string = e.release_date || e.first_air_date || '';
          if (!date) {
            // Include announced-but-undated titles if they have meaningful popularity
            const key = `${e.id}-${mediaType}`;
            if (!byKey.has(key) && !noDate.has(key)) {
              noDate.set(key, {
                tmdb_id: e.id,
                media_type: mediaType,
                title: e.title || e.name || 'Untitled',
                poster_path: e.poster_path ?? null,
                year: null,
                vote_average: e.vote_average ?? 0,
                release_date: '',
                person_name: p.name,
              });
            }
            continue;
          }
          const t = new Date(date).getTime();
          if (Number.isNaN(t)) continue;
          // upcoming OR released within the last 30 days
          if (t < now - THIRTY_DAYS_MS) continue;

          const key = `${e.id}-${mediaType}`;
          if (byKey.has(key)) continue;
          byKey.set(key, {
            tmdb_id: e.id,
            media_type: mediaType,
            title: e.title || e.name || 'Untitled',
            poster_path: e.poster_path ?? null,
            year: date ? new Date(date).getFullYear() : null,
            vote_average: e.vote_average ?? 0,
            release_date: date,
            person_name: p.name,
          });
        }
      }
    }

    const dated = Array.from(byKey.values())
      .sort((a, b) => b.release_date.localeCompare(a.release_date));
    const undated = Array.from(noDate.values())
      .filter(item => !byKey.has(`${item.tmdb_id}-${item.media_type}`))
      .sort((a, b) => b.vote_average - a.vote_average);
    return [...dated, ...undated].slice(0, 40);
  },

  // Daily DB-backed cache. Recomputes at most once per 24h per user.
  async getFollowedFeed(): Promise<FollowedFeedItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: cached } = await supabase
      .from('followed_feed_cache')
      .select('payload, computed_at')
      .eq('user_id', user.id)
      .maybeSingle();

    const fresh =
      cached &&
      cached.computed_at &&
      Date.now() - new Date(cached.computed_at).getTime() < DAY_MS;

    if (fresh) {
      return (cached!.payload as unknown as FollowedFeedItem[]) ?? [];
    }

    const items = await this.computeNewReleasesFromFollowed();
    const { error } = await supabase.from('followed_feed_cache').upsert(
      {
        user_id: user.id,
        payload: items as unknown as any,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) console.error('followed_feed_cache upsert failed:', error);
    return items;
  },
};
