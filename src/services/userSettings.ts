import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type UserSettings = Database['public']['Tables']['user_settings']['Row'];
type UserSettingsInsert = Database['public']['Tables']['user_settings']['Insert'];
type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update'];

let cachedSettings: UserSettings | null = null;
let cacheUserId: string | null = null;

export const userSettingsService = {
  async getSettings(): Promise<UserSettings | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      if (cachedSettings && cacheUserId === user.id) {
        return cachedSettings;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error getting user settings:', error);
        return null;
      }

      if (!data) {
        const newSettings = await this.createDefaultSettings();
        cachedSettings = newSettings;
        cacheUserId = user.id;
        return newSettings;
      }

      cachedSettings = data;
      cacheUserId = user.id;
      return data;
    } catch (error) {
      console.error('Error getting user settings:', error);
      return null;
    }
  },

  async createDefaultSettings(): Promise<UserSettings | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          english_only_filter: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating default settings:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating default settings:', error);
      return null;
    }
  },

  async updateSettings(updates: UserSettingsUpdate): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data, error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating settings:', error);
        return { success: false, error: error.message };
      }

      if (data) {
        cachedSettings = data;
        cacheUserId = user.id;
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating settings:', error);
      return { success: false, error: 'Failed to update settings' };
    }
  },

  clearCache(): void {
    cachedSettings = null;
    cacheUserId = null;
  },

  async setEnglishOnlyFilter(enabled: boolean): Promise<{ success: boolean; error?: string }> {
    return this.updateSettings({ english_only_filter: enabled });
  },

  async getEnglishOnlyFilter(): Promise<boolean> {
    const settings = await this.getSettings();
    return settings?.english_only_filter ?? false;
  }
};
