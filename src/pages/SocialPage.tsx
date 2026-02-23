import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
  following_profile?: Profile;
  follower_profile?: Profile;
}

export default function SocialPage() {
  const { user } = useAuth();
  const [following, setFollowing] = useState<Follow[]>([]);
  const [followers, setFollowers] = useState<Follow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following');

  useEffect(() => {
    loadSocialData();
  }, [user]);

  async function loadSocialData() {
    try {
      const [followingData, followersData] = await Promise.all([
        supabase
          .from('follows')
          .select('*, following_profile:profiles!follows_following_id_fkey(*)')
          .eq('follower_id', user?.id),
        supabase
          .from('follows')
          .select('*, follower_profile:profiles!follows_follower_id_fkey(*)')
          .eq('following_id', user?.id)
      ]);

      setFollowing(followingData.data || []);
      setFollowers(followersData.data || []);
    } catch (error) {
      console.error('Error loading social data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function searchUsers() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', user?.id)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  }

  async function followUser(userId: string) {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: userId });

      if (error) throw error;
      await loadSocialData();
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      console.error('Error following user:', error);
    }
  }

  async function unfollowUser(userId: string) {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId);

      if (error) throw error;
      await loadSocialData();
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  }

  function isFollowing(userId: string): boolean {
    return following.some((f: any) => f.following_profile?.id === userId);
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Social</h1>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Find Users</h2>
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by username..."
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={searchUsers}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
            >
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {profile.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{profile.username}</p>
                      {profile.bio && <p className="text-sm text-gray-400">{profile.bio}</p>}
                    </div>
                  </div>
                  {isFollowing(profile.id) ? (
                    <button
                      onClick={() => unfollowUser(profile.id)}
                      className="px-4 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium transition-colors"
                    >
                      Unfollow
                    </button>
                  ) : (
                    <button
                      onClick={() => followUser(profile.id)}
                      className="px-4 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      Follow
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex space-x-4 mb-6 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('following')}
              className={`pb-3 px-2 font-medium transition-colors ${
                activeTab === 'following'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Following ({following.length})
            </button>
            <button
              onClick={() => setActiveTab('followers')}
              className={`pb-3 px-2 font-medium transition-colors ${
                activeTab === 'followers'
                  ? 'text-primary-500 border-b-2 border-primary-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Followers ({followers.length})
            </button>
          </div>

          <div className="space-y-2">
            {activeTab === 'following' ? (
              following.length === 0 ? (
                <p className="text-gray-400 text-center py-8">You're not following anyone yet</p>
              ) : (
                following.map((follow: any) => (
                  <div key={follow.id} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {follow.following_profile?.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{follow.following_profile?.username}</p>
                        {follow.following_profile?.bio && (
                          <p className="text-sm text-gray-400">{follow.following_profile.bio}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => unfollowUser(follow.following_id)}
                      className="px-4 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium transition-colors"
                    >
                      Unfollow
                    </button>
                  </div>
                ))
              )
            ) : (
              followers.length === 0 ? (
                <p className="text-gray-400 text-center py-8">You don't have any followers yet</p>
              ) : (
                followers.map((follow: any) => (
                  <div key={follow.id} className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {follow.follower_profile?.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{follow.follower_profile?.username}</p>
                        {follow.follower_profile?.bio && (
                          <p className="text-sm text-gray-400">{follow.follower_profile.bio}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
