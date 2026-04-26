import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useToast } from '../../contexts/ToastContext';
import { plexService } from '../../services/plex';
import type { PlexSection } from '../../services/plex';

export default function PlexSettingsPage() {
  const toast = useToast();
  const [serverUrl, setServerUrl] = useState('');
  const [movieSectionId, setMovieSectionId] = useState('');
  const [tvSectionId, setTvSectionId] = useState('');
  const [sections, setSections] = useState<PlexSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; serverName?: string; connectionMethod?: string; error?: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const config = await plexService.getPlexConfig();
      if (config) {
        setServerUrl(config.plex_server_url || '');
        setMovieSectionId(config.library_movie_section_id || '');
        setTvSectionId(config.library_tv_section_id || '');
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await plexService.testConnection(serverUrl.trim() || undefined);
      setTestResult(result);
      if (result.success) {
        const method = result.connectionMethod === 'cloud' ? 'via Plex Cloud' : 'directly';
        toast.success(`Connected to ${result.serverName} ${method}`);
      } else {
        toast.error(result.error || 'Connection failed');
      }
    } catch (error) {
      setTestResult({ success: false, error: 'Connection test failed' });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  }

  async function handleLoadSections() {
    setLoadingSections(true);
    try {
      const data = await plexService.getSections();
      setSections(data);
      if (data.length === 0) {
        toast.warning('No library sections found');
      }
    } catch (error) {
      console.error('Error loading sections:', error);
      toast.error('Failed to load library sections');
    } finally {
      setLoadingSections(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await plexService.savePlexConfig({
        plex_server_url: serverUrl.trim() || null,
        library_movie_section_id: movieSectionId || null,
        library_tv_section_id: tvSectionId || null,
      });
      toast.success('Plex settings saved');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
        </div>
      </AdminLayout>
    );
  }

  const movieSections = sections.filter(s => s.type === 'movie');
  const tvSections = sections.filter(s => s.type === 'show');

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Plex Server Settings</h1>

        <div className="space-y-6">
          {/* Server Connection */}
          <div className="bg-gray-800/60 rounded-lg p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-white mb-4">Server Connection</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Plex Server URL <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={e => setServerUrl(e.target.value)}
                  placeholder="Leave blank to auto-discover via Plex Cloud"
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  {serverUrl.trim()
                    ? 'Direct connection will be tried first. If unreachable, Plex Cloud relay will be used as fallback.'
                    : 'Your server will be discovered automatically through Plex Cloud. No port forwarding required.'}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600/30 text-amber-200 hover:bg-amber-600/50 font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {testing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-amber-400"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  Test Connection
                </button>

                {testResult && (
                  <span className={`text-sm font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.success
                      ? `Connected: ${testResult.serverName} (${testResult.connectionMethod === 'cloud' ? 'Plex Cloud' : 'Direct'})`
                      : testResult.error || 'Connection failed'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Library Sections */}
          <div className="bg-gray-800/60 rounded-lg p-6 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Library Sections</h2>
              <button
                onClick={handleLoadSections}
                disabled={loadingSections}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm transition-colors disabled:opacity-50"
              >
                {loadingSections ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-gray-400"></div>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Load Sections
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Select which Plex library sections to search for movies and TV shows. Click "Load Sections" to fetch available libraries from your server.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Movies Library
                </label>
                {sections.length > 0 ? (
                  <select
                    value={movieSectionId}
                    onChange={e => setMovieSectionId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value="">Auto-detect</option>
                    {movieSections.map(s => (
                      <option key={s.id} value={s.id}>{s.title} (ID: {s.id})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={movieSectionId}
                    onChange={e => setMovieSectionId(e.target.value)}
                    placeholder="Section ID (e.g., 1)"
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  TV Shows Library
                </label>
                {sections.length > 0 ? (
                  <select
                    value={tvSectionId}
                    onChange={e => setTvSectionId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value="">Auto-detect</option>
                    {tvSections.map(s => (
                      <option key={s.id} value={s.id}>{s.title} (ID: {s.id})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={tvSectionId}
                    onChange={e => setTvSectionId(e.target.value)}
                    placeholder="Section ID (e.g., 2)"
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Token Info */}
          <div className="bg-gray-800/60 rounded-lg p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-white mb-2">Plex Token</h2>
            <p className="text-sm text-gray-400">
              The PLEX_TOKEN is stored securely as an Edge Function secret. It is automatically configured and cannot be viewed or changed from here.
            </p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Save Settings
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
