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
  profile_id: string | null;
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
    profileId?: string | null,
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
        .eq('preference_type', oppositeType)
        .is('profile_id', profileId || null);

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          profile_id: profileId || null,
          tmdb_id: tmdbId,
          media_type: mediaType,
          preference_type: preferenceType,
          tag_value: null,
          content_metadata: contentMetadata || {},
        }, {
          onConflict: 'user_id,profile_id,tmdb_id,media_type,preference_type,tag_value',
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
    profileId?: string | null
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
        .eq('preference_type', preferenceType)
        .is('profile_id', profileId || null);

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
    profileId?: string | null
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
        .is('profile_id', profileId || null)
        .maybeSingle();

      if (error || !data) return null;

      return data.preference_type as 'like' | 'dislike';
    } catch (error) {
      console.error('Error getting preference:', error);
      return null;
    }
  },

  async getPreferences(
    profileId?: string | null
  ): Promise<UserPreference[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .is('profile_id', profileId || null)
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

  async getLikedContent(
    mediaType?: MediaType,
    profileId?: string | null
  ): Promise<number[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('user_preferences')
        .select('tmdb_id')
        .eq('user_id', user.id)
        .eq('preference_type', 'like')
        .is('profile_id', profileId || null);

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

  async getDislikedContent(
    mediaType?: MediaType,
    profileId?: string | null
  ): Promise<number[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('user_preferences')
        .select('tmdb_id')
        .eq('user_id', user.id)
        .eq('preference_type', 'dislike')
        .is('profile_id', profileId || null);

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
    tagValue: string,
    profileId?: string | null
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
          profile_id: profileId || null,
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
    tagValue: string,
    profileId?: string | null
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
        .eq('tag_value', tagValue.toLowerCase().trim())
        .is('profile_id', profileId || null);

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
    mediaType: MediaType,
    profileId?: string | null
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
        .eq('preference_type', 'tag')
        .is('profile_id', profileId || null);

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
    mediaType?: MediaType,
    profileId?: string | null
  ): Promise<number[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('user_preferences')
        .select('tmdb_id')
        .eq('user_id', user.id)
        .eq('preference_type', 'tag')
        .eq('tag_value', tagValue.toLowerCase().trim())
        .is('profile_id', profileId || null);

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

  async getAllTags(profileId?: string | null): Promise<string[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_preferences')
        .select('tag_value')
        .eq('user_id', user.id)
        .eq('preference_type', 'tag')
        .is('profile_id', profileId || null)
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

  async getPreferenceStats(profileId?: string | null): Promise<PreferenceStats> {
    try {
      const preferences = await this.getPreferences(profileId);

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
