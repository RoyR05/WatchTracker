import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import ChangePassword from '../components/profile/ChangePassword';
import { userSettingsService } from '../services/userSettings';

const AVAILABLE_GENRES = [
  { id: 28,    name: 'Action' },
  { id: 12,    name: 'Adventure' },
  { id: 16,    name: 'Animation' },
  { id: 35,    name: 'Comedy' },
  { id: 80,    name: 'Crime' },
  { id: 99,    name: 'Documentary' },
  { id: 18,    name: 'Drama' },
  { id: 14,    name: 'Fantasy' },
  { id: 36,    name: 'History' },
  { id: 27,    name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648,  name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878,   name: 'Sci-Fi' },
  { id: 53,    name: 'Thriller' },
  { id: 10752, name: 'War' },
];

export default function ProfilePage() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Discovery preferences
  const [englishOnly, setEnglishOnly] = useState(false);
  const [preferredGenres, setPreferredGenres] = useState<number[]>([]);
  const genreSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const [highlightDiscovery, setHighlightDiscovery] = useState(false);

  // Currently Watching hiatus settings
  const [hiatusHideWeeks, setHiatusHideWeeks] = useState(3);
  const [hiatusShowDays, setHiatusShowDays] = useState(14);

  useEffect(() => {
    userSettingsService.getEnglishOnlyFilter().then(setEnglishOnly);
    userSettingsService.getPreferredGenres().then(setPreferredGenres);
    userSettingsService.getHiatusSettings().then(({ hideWeeks, showDays }) => {
      setHiatusHideWeeks(hideWeeks);
      setHiatusShowDays(showDays);
    });
  }, []);

  // Deep-link from the onboarding tour: /profile#discovery-preferences
  useEffect(() => {
    if (location.hash !== '#discovery-preferences') return;
    const el = document.getElementById('discovery-preferences');
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlightDiscovery(true);
      setTimeout(() => setHighlightDiscovery(false), 2400);
    }, 250);
    return () => clearTimeout(t);
  }, [location.hash]);

  async function toggleEnglishOnly() {
    const newValue = !englishOnly;
    setEnglishOnly(newValue);
    await userSettingsService.setEnglishOnlyFilter(newValue);
  }

  const toggleGenre = useCallback((genreId: number) => {
    setPreferredGenres(prev => {
      const next = prev.includes(genreId)
        ? prev.filter(g => g !== genreId)
        : [...prev, genreId];

      // Auto-save after 500ms debounce
      if (genreSaveTimeout.current) clearTimeout(genreSaveTimeout.current);
      genreSaveTimeout.current = setTimeout(() => {
        userSettingsService.setPreferredGenres(next);
      }, 500);

      return next;
    });
  }, []);

  async function compressImage(file: File, maxBytes = 2 * 1024 * 1024): Promise<File> {
    if (file.size <= maxBytes) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const MAX_DIM = 1000;
      let { width, height } = bitmap;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) { height = Math.round((height / width) * MAX_DIM); width = MAX_DIM; }
        else { width = Math.round((width / height) * MAX_DIM); height = MAX_DIM; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { bitmap.close(); return file; }
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      return await new Promise<File>((resolve) => {
        const tryQuality = (q: number) => {
          canvas.toBlob(blob => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= maxBytes || q <= 0.2) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
            } else {
              tryQuality(q - 0.15);
            }
          }, 'image/jpeg', q);
        };
        tryQuality(0.8);
      });
    } catch {
      return file;
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please select a JPG, PNG, WebP, or GIF image.');
      return;
    }

    const fileToUpload = file.size > 2 * 1024 * 1024
      ? await compressImage(file)
      : file;

    setUploadError('');
    setUploading(true);
    try {
      const ext = fileToUpload.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, fileToUpload, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: profileErr } = await updateProfile({ avatar_url: publicUrl });
      if (profileErr) throw profileErr;

      setAvatarUrl(publicUrl);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
      // reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setUpdating(true);
    try {
      const { error } = await updateProfile({ username, bio });
      if (error) throw error;
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  }

  const initials = (profile?.username || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Profile Settings</h1>

        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Profile Information</h2>

            {/* Avatar */}
            <div className="flex items-center space-x-4 mb-6">
              <div className="relative group flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile photo"
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-gray-600"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">{initials}</span>
                  </div>
                )}

                {/* Hover overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-wait"
                  title="Change photo"
                >
                  {uploading ? (
                    <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-white text-xs mt-1">Change</span>
                    </>
                  )}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">{profile?.username}</h3>
                <p className="text-gray-400 text-sm">Member since {new Date(profile?.created_at || '').toLocaleDateString()}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="mt-1 text-xs text-primary-400 hover:text-primary-300 disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Upload photo'}
                </button>
              </div>
            </div>

            {uploadError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{uploadError}</p>
              </div>
            )}

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-300 mb-1">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={4}
                    placeholder="Tell us about yourself..."
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {updating ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setUsername(profile?.username || '');
                      setBio(profile?.bio || '');
                      setError('');
                    }}
                    className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Bio</h3>
                  <p className="text-white">{profile?.bio || 'No bio yet'}</p>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>

          <ChangePassword />

          {/* Discovery Preferences */}
          <div
            id="discovery-preferences"
            className={`bg-gray-800 rounded-lg p-6 transition-all duration-500 ${
              highlightDiscovery ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-gray-900' : ''
            }`}
          >
            <h2 className="text-lg font-semibold text-white mb-4">Discovery Preferences</h2>

            {/* English Only toggle */}
            <div className="flex items-center justify-between py-3 border-b border-gray-700">
              <div>
                <p className="text-white font-medium">English Only</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  Only show movies and shows in English. Applies to Discovery, Trending, and Feeling Lucky.
                </p>
              </div>
              <button
                onClick={toggleEnglishOnly}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  englishOnly ? 'bg-primary-600' : 'bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  englishOnly ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Genre chips */}
            <div className="pt-4">
              <p className="text-white font-medium mb-1">Favorite Genres</p>
              <p className="text-sm text-gray-400 mb-3">
                Used to personalize Feeling Lucky and Discovery results. Combined with your likes/dislikes.
              </p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_GENRES.map(g => (
                  <button
                    key={g.id}
                    onClick={() => toggleGenre(g.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      preferredGenres.includes(g.id)
                        ? 'bg-primary-600 border-primary-500 text-white'
                        : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
              {preferredGenres.length > 0 && (
                <p className="text-xs text-gray-500 mt-3">
                  {preferredGenres.length} genre{preferredGenres.length !== 1 ? 's' : ''} selected — saved automatically
                </p>
              )}
            </div>
          </div>

          {/* Currently Watching preferences */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Currently Watching</h2>
            <p className="text-sm text-gray-400 mb-4">
              Shows on a long hiatus are automatically hidden from your Dashboard and re-appear as their return date approaches. You can adjust the thresholds below.
            </p>

            <div className="flex items-center justify-between py-3 border-b border-gray-700 gap-4">
              <div>
                <p className="text-white font-medium">Hide after</p>
                <p className="text-sm text-gray-400 mt-0.5">Hide a show when no new episode has aired for this many weeks.</p>
              </div>
              <select
                value={hiatusHideWeeks}
                onChange={async e => {
                  const val = Number(e.target.value);
                  setHiatusHideWeeks(val);
                  await userSettingsService.setHiatusSettings(val, hiatusShowDays);
                }}
                className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 flex-shrink-0"
              >
                {[1, 2, 3, 4, 6, 8].map(w => (
                  <option key={w} value={w}>{w} {w === 1 ? 'week' : 'weeks'}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between py-3 gap-4">
              <div>
                <p className="text-white font-medium">Show back when</p>
                <p className="text-sm text-gray-400 mt-0.5">Re-surface a show this many days before its next episode airs.</p>
              </div>
              <select
                value={hiatusShowDays}
                onChange={async e => {
                  const val = Number(e.target.value);
                  setHiatusShowDays(val);
                  await userSettingsService.setHiatusSettings(hiatusHideWeeks, val);
                }}
                className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 flex-shrink-0"
              >
                {[7, 14, 21, 30].map(d => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Plex</h2>
            <Link
              to="/plex-requests"
              className="flex items-center justify-between px-4 py-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
                <span className="text-white font-medium">My Plex Requests</span>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700/50 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
