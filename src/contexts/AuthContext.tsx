import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  markOnboarded: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately on subscription,
    // so we don't need a separate getSession() call (which would cause a
    // double loadProfile race). Single source of truth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    // Retry once after 2s in case of a transient network failure on app open.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await loadProfileAttempt(userId);
        return;
      } catch (error) {
        if (attempt === 0) {
          console.warn('[Auth] loadProfile failed, retrying in 2s:', error);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          console.error('[Auth] loadProfile failed after retry:', error);
          setLoading(false);
        }
      }
    }
  }

  async function loadProfileAttempt(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: userData } = await supabase.auth.getUser();
        const authUser = userData?.user;
        const displayName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name;
        const email = authUser?.email || '';
        let baseUsername = displayName
          ? displayName.toLowerCase().replace(/\s+/g, '').slice(0, 20)
          : email.split('@')[0] || 'user';
        let username = baseUsername;
        let attempt = 0;
        let profileCreated = false;

        while (attempt < 10) {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([{
              id: userId,
              username: username,
              bio: '',
            }])
            .select()
            .single();

          if (!createError && newProfile) {
            setProfile(newProfile);
            profileCreated = true;
            break;
          }

          if (createError) {
            if (createError.code === '23505') {
              attempt++;
              username = `${baseUsername}${Math.floor(Math.random() * 10000)}`;
              continue;
            } else {
              throw createError;
            }
          }
        }

        if (!profileCreated) {
          throw new Error('Failed to create unique username after 10 attempts');
        }
      } else {
        setProfile(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, username: string) {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned from signup');

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          username,
          bio: '',
        }]);

      if (profileError) throw profileError;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signInWithGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      await loadProfile(user.id);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async function markOnboarded() {
    if (!user || !profile || profile.onboarded_at) return;
    const ts = new Date().toISOString();
    setProfile({ ...profile, onboarded_at: ts }); // optimistic — close tour instantly
    try {
      await supabase.from('profiles').update({ onboarded_at: ts }).eq('id', user.id);
    } catch (error) {
      console.error('[Auth] markOnboarded failed:', error);
    }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    markOnboarded,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
