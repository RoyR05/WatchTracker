import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PLEX_PROXY_URL = `${SUPABASE_URL}/functions/v1/plex-proxy`;

export interface PlexAvailability {
  available: boolean;
  match?: {
    title: string;
    year: number;
    quality: string | null;
    server?: string;
  };
  serversSearched?: number;
  error?: string;
}

export interface PlexRequest {
  id: string;
  user_id: string;
  profile_id: string | null;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  status: 'pending' | 'approved' | 'added' | 'rejected' | 'bad_file';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface PlexSection {
  id: string;
  title: string;
  type: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export const plexService = {
  async checkAvailability(title: string, year: string | number | null, mediaType: 'movie' | 'tv'): Promise<PlexAvailability> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ action: 'search', title, media_type: mediaType });
    if (year) params.set('year', String(year));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${PLEX_PROXY_URL}?${params}`, { headers, signal: controller.signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Plex check failed (${res.status})`);
      }
      return res.json();
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw new Error('Plex check timed out. Try again.');
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  },

  async testConnection(serverUrl?: string): Promise<{ success: boolean; serverName?: string; connectionMethod?: string; error?: string }> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ action: 'test' });
    if (serverUrl) params.set('server_url', serverUrl);

    const res = await fetch(`${PLEX_PROXY_URL}?${params}`, { headers });
    return res.json();
  },

  async getSections(): Promise<PlexSection[]> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({ action: 'sections' });

    const res = await fetch(`${PLEX_PROXY_URL}?${params}`, { headers });
    if (!res.ok) throw new Error('Failed to load Plex sections');
    const data = await res.json();
    return data.sections || [];
  },

  async submitRequest(
    userId: string,
    profileId: string | null,
    tmdbId: number,
    mediaType: 'movie' | 'tv',
    title: string,
    posterPath: string | null
  ): Promise<PlexRequest> {
    const { data, error } = await supabase
      .from('plex_requests')
      .insert({
        user_id: userId,
        profile_id: profileId,
        tmdb_id: tmdbId,
        media_type: mediaType,
        title,
        poster_path: posterPath,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data as PlexRequest;
  },

  async reportBadFile(
    userId: string,
    profileId: string | null,
    tmdbId: number,
    mediaType: 'movie' | 'tv',
    title: string,
    posterPath: string | null
  ): Promise<PlexRequest> {
    const { data, error } = await supabase
      .from('plex_requests')
      .insert({
        user_id: userId,
        profile_id: profileId,
        tmdb_id: tmdbId,
        media_type: mediaType,
        title,
        poster_path: posterPath,
        status: 'bad_file',
      })
      .select()
      .single();

    if (error) throw error;
    return data as PlexRequest;
  },

  async checkExistingRequest(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<PlexRequest | null> {
    const { data, error } = await supabase
      .from('plex_requests')
      .select('*')
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
      .in('status', ['pending', 'approved', 'bad_file'])
      .maybeSingle();

    if (error) throw error;
    return data as PlexRequest | null;
  },

  async getMyRequests(userId: string): Promise<PlexRequest[]> {
    const { data, error } = await supabase
      .from('plex_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as PlexRequest[];
  },

  async getAllRequests(statusFilter?: string): Promise<(PlexRequest & { profiles?: { username: string } })[]> {
    let query = supabase
      .from('plex_requests')
      .select('*, profiles:user_id(username)')
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async updateRequestStatus(
    requestId: string,
    status: PlexRequest['status'],
    adminNotes?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (adminNotes !== undefined) updates.admin_notes = adminNotes;
    if (['added', 'rejected'].includes(status)) {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('plex_requests')
      .update(updates)
      .eq('id', requestId);

    if (error) throw error;
  },

  async cancelRequest(requestId: string): Promise<void> {
    const { error } = await supabase
      .from('plex_requests')
      .delete()
      .eq('id', requestId);

    if (error) throw error;
  },

  async getPlexConfig() {
    const { data, error } = await supabase
      .from('plex_server_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async savePlexConfig(config: {
    plex_server_url: string | null;
    library_movie_section_id: string | null;
    library_tv_section_id: string | null;
  }) {
    const { error } = await supabase
      .from('plex_server_config')
      .upsert({
        id: 1,
        ...config,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  },
};
