import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface UserProfile {
  id: string;
  account_id: string;
  profile_name: string;
  avatar_color: string;
  is_primary: boolean;
  created_at: string;
}

interface ProfileContextType {
  currentProfile: UserProfile | null;
  profiles: UserProfile[];
  loading: boolean;
  switchProfile: (profileId: string) => Promise<void>;
  createProfile: (name: string, avatarColor: string) => Promise<UserProfile>;
  updateProfile: (profileId: string, updates: Partial<UserProfile>) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
};

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfiles = async () => {
    if (!user) {
      setProfiles([]);
      setCurrentProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('account_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      setProfiles(data || []);

      const savedProfileId = localStorage.getItem('currentProfileId');
      let profileToSet: UserProfile | null = null;

      if (savedProfileId) {
        profileToSet = data?.find(p => p.id === savedProfileId) || null;
      }

      if (!profileToSet) {
        profileToSet = data?.find(p => p.is_primary) || data?.[0] || null;
      }

      setCurrentProfile(profileToSet);
      if (profileToSet) {
        localStorage.setItem('currentProfileId', profileToSet.id);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [user]);

  const switchProfile = async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setCurrentProfile(profile);
      localStorage.setItem('currentProfileId', profileId);
      window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId } }));
    }
  };

  const createProfile = async (name: string, avatarColor: string): Promise<UserProfile> => {
    if (!user) throw new Error('User not authenticated');
    if (profiles.length >= 4) throw new Error('Maximum 4 profiles allowed');

    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        account_id: user.id,
        profile_name: name,
        avatar_color: avatarColor,
        is_primary: false
      })
      .select()
      .single();

    if (error) throw error;

    await loadProfiles();
    return data;
  };

  const updateProfile = async (profileId: string, updates: Partial<UserProfile>) => {
    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', profileId);

    if (error) throw error;

    await loadProfiles();
  };

  const deleteProfile = async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile?.is_primary) {
      throw new Error('Cannot delete primary profile');
    }

    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', profileId);

    if (error) throw error;

    if (currentProfile?.id === profileId) {
      const primaryProfile = profiles.find(p => p.is_primary);
      if (primaryProfile) {
        await switchProfile(primaryProfile.id);
      }
    }

    await loadProfiles();
  };

  const refreshProfiles = async () => {
    await loadProfiles();
  };

  return (
    <ProfileContext.Provider
      value={{
        currentProfile,
        profiles,
        loading,
        switchProfile,
        createProfile,
        updateProfile,
        deleteProfile,
        refreshProfiles
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};
