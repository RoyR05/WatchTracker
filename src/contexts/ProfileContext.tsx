import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProfileContextType {
  currentProfile: Profile | null;
  profiles: Profile[];
  loading: boolean;
  switchProfile: (profileId: string) => void;
  createProfile: (name: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCurrentProfile(null);
      setProfiles([]);
      setLoading(false);
      return;
    }

    loadProfiles();
  }, [user]);

  async function loadProfiles() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setProfiles(data || []);

      const savedProfileId = localStorage.getItem('currentProfileId');
      const profile = savedProfileId
        ? data?.find((p) => p.id === savedProfileId)
        : data?.[0];

      setCurrentProfile(profile || null);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  }

  const switchProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (profile) {
      setCurrentProfile(profile);
      localStorage.setItem('currentProfileId', profileId);
    }
  };

  const createProfile = async (name: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({ user_id: user.id, name })
        .select()
        .single();

      if (error) throw error;

      setProfiles((prev) => [...prev, data]);
      if (!currentProfile) {
        setCurrentProfile(data);
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  };

  const value = {
    currentProfile,
    profiles,
    loading,
    switchProfile,
    createProfile,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
