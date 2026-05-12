import { supabase } from '../lib/supabase';

export type PreferenceType = 'like' | 'dislike' | 'tag';
export type MediaType = 'movie' | 'tv';

export interface ContentMetadata {
  title: string;
  poster_path?: string | null;
  genres?: Array<{ id: number; name: string }>;
  release_year?: number;
  cast?: Array<{ id: number; name: string; character?: string }>;
  director?: Array<{ id: number; name: string }>;
  runtime?: number;
  overview?: string;
}

export interface UserPreference {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  preference_type: PreferenceType;
  tag_value: string | null;
  content_metadata?: ContentMetadata;
  created_at: string;
  updated_at: string;
}

export interface PreferenceStats {
  likes: number;
  dislikes: number;
  tags: string[];
}

export const preferencesService = {
  async setPreference(
    tmdbId: number,
    mediaType: MediaType,
    preferenceType: 'like' | 'dislike',
    _profileId?: string | null,
    contentMetadata?: ContentMetadata
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const oppositeType = preferenceType === 'like' ? 'dislike' : 'like';

      await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id)
        .eq('tmdb_id', tmdbId)
        .eq('media_type', mediaType)
        .eq('preference_type', oppositeType);

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          tmdb_id: tmdbId,
          media_type: mediaType,
          preference_type: preferenceType,
          tag_value: null,
          content_metadata: contentMetadata || {},
        }, {
          onConflict: 'user_id,tmdb_id,media_type,preference_type,tag_value',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Error setting preference:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting preference:', error);
      return { success: false, error: 'Failed to set preference' };
    }
  },

  async removePreference(
    tmdbId: number,
    mediaType: MediaType,
    preferenceType: 'like' | 'dislike',
    _profileId?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id)
        .eq('tmdb_id', tmdbId)
        .eq('media_type', mediaType)
        .eq('preference_type', preferenceType);

      if (error) {
        console.error('Error removing preference:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing preference:', error);
      return { success: false, error: 'Failed to remove preference' };
    }
  },

  async getPreference(
    tmdbId: number,
    mediaType: MediaType,
    _profileId?: string | null
  ): Promise<'like' | 'dislike' | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_type')
        .eq('user_id', user.id)
        .eq('tmdb_id', tmdbId)
        .eq('media_type', mediaType)
        .in('preference_type', ['like', 'dislike'])
        .maybeSingle();

      if (error || !data) return null;

      return data.preference_type as 'like' | 'dislike';
    } catch (error) {
      console.error('Error getting preference:', error);
      return null;
    }
  },

  async getPreferencesForItems(
    items: Array<{ tmdbId: number; mediaType: MediaType }>,
    userId: string
  ): Promise<Map<string, 'like' | 'dislike'>> {
    const result = new Map<string, 'like' | 'dislike'>();
    if (items.length === 0) return result;

    try {
      const tmdbIds = items.map(i => i.tmdbId);
      const { data, error } = await supabase
        .from('user_preferences')
        .select('tmdb_id, media_type, preference_type')
        .eq('user_id', userId)
        .in('tmdb_id', tmdbIds)
        .in('preference_type', ['like', 'dislike']);

      if (error || !data) return result;

      for (const row of data) {
        result.set(`${row.tmdb_id}-${row.media_type}`, row.preference_type as 'like' | 'dislike');
      }
    } catch (error) {
      console.error('Error batch fetching preferences:', error);
    }
    return result;
  },

  async getPreferences(): Promise<UserPreference[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting preferences:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting preferences:', error);
      return [];
    }
  },

  async getLikedContent(mediaType?: MediaType): Promise<number[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('user_preferences')
        .select('tmdb_id')
        .eq('user_id', user.id)
        .eq('preference_type', 'like');

      if (mediaType) {
        query = query.eq('media_type', mediaType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting liked content:', error);
        return [];
      }

      return data?.map(item => item.tmdb_id) || [];
    } catch (error) {
      console.error('Error getting liked content:', error);
      return [];
    }
  },

  async getDislikedContent(mediaType?: MediaType): Promise<number[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('user_preferences')
        .select('tmdb_id')
        .eq('user_id', user.id)
        .eq('preference_type', 'dislike');

      if (mediaType) {
        query = query.eq('media_type', mediaType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting disliked content:', error);
        return [];
      }

      return data?.map(item => item.tmdb_id) || [];
    } catch (error) {
      console.error('Error getting disliked content:', error);
      return [];
    }
  },

  async addTag(
    tmdbId: number,
    mediaType: MediaType,
    tagValue: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: user.id,
          tmdb_id: tmdbId,
          media_type: mediaType,
          preference_type: 'tag',
          tag_value: tagValue.toLowerCase().trim(),
        });

      if (error) {
        console.error('Error adding tag:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error adding tag:', error);
      return { success: false, error: 'Failed to add tag' };
    }
  },

  async removeTag(
    tmdbId: number,
    mediaType: MediaType,
    tagValue: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id)
        .eq('tmdb_id', tmdbId)
        .eq('media_type', mediaType)
        .eq('preference_type', 'tag')
        .eq('tag_value', tagValue.toLowerCase().trim());

      if (error) {
        console.error('Error removing tag:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing tag:', error);
      return { success: false, error: 'Failed to remove tag' };
    }
  },

  async getTags(
    tmdbId: number,
    mediaType: MediaType
  ): Promise<string[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_preferences')
        .select('tag_value')
        .eq('user_id', user.id)
        .eq('tmdb_id', tmdbId)
        .eq('media_type', mediaType)
        .eq('preference_type', 'tag');

      if (error) {
        console.error('Error getting tags:', error);
        return [];
      }

      return data?.map(item => item.tag_value).filter(Boolean) as string[] || [];
    } catch (error) {
      console.error('Error getting tags:', error);
      return [];
    }
  },

  async getContentByTag(
    tagValue: string,
    mediaType?: MediaType
  ): Promise<number[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('user_preferences')
        .select('tmdb_id')
        .eq('user_id', user.id)
        .eq('preference_type', 'tag')
        .eq('tag_value', tagValue.toLowerCase().trim());

      if (mediaType) {
        query = query.eq('media_type', mediaType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting content by tag:', error);
        return [];
      }

      return data?.map(item => item.tmdb_id) || [];
    } catch (error) {
      console.error('Error getting content by tag:', error);
      return [];
    }
  },

  async getAllTags(): Promise<string[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_preferences')
        .select('tag_value')
        .eq('user_id', user.id)
        .eq('preference_type', 'tag')
        .not('tag_value', 'is', null);

      if (error) {
        console.error('Error getting all tags:', error);
        return [];
      }

      const tagValues = data?.map(item => item.tag_value).filter((tag): tag is string => typeof tag === 'string') || [];
      const uniqueTags = [...new Set(tagValues)];
      return uniqueTags.sort();
    } catch (error) {
      console.error('Error getting all tags:', error);
      return [];
    }
  },

  async getPreferencesForItems(
    items: Array<{ tmdbId: number; mediaType: MediaType }>,
    userId: string
  ): Promise<Map<string, 'like' | 'dislike'>> {
    const map = new Map<string, 'like' | 'dislike'>();
    if (items.length === 0) return map;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('tmdb_id, media_type, preference_type')
        .eq('user_id', userId)
        .in('preference_type', ['like', 'dislike'])
        .in('tmdb_id', items.map(i => i.tmdbId));

      if (error || !data) return map;

      for (const row of data) {
        if (row.preference_type === 'like' || row.preference_type === 'dislike') {
          map.set(`${row.tmdb_id}-${row.media_type}`, row.preference_type);
        }
      }
    } catch (error) {
      console.error('Error batch fetching preferences:', error);
    }

    return map;
  },

  async getPreferenceStats(): Promise<PreferenceStats> {
    try {
      const preferences = await this.getPreferences();

      const likes = preferences.filter(p => p.preference_type === 'like').length;
      const dislikes = preferences.filter(p => p.preference_type === 'dislike').length;
      const tagValues = preferences
        .filter(p => p.preference_type === 'tag' && p.tag_value)
        .map(p => p.tag_value)
        .filter((tag): tag is string => typeof tag === 'string');
      const tags: string[] = Array.from(new Set(tagValues));

      return { likes, dislikes, tags };
    } catch (error) {
      console.error('Error getting preference stats:', error);
      return { likes: 0, dislikes: 0, tags: [] };
    }
  }
};
