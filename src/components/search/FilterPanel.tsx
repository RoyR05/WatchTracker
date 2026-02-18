import { useState, useEffect } from 'react';
import { tmdbService } from '../../services/tmdb';

export interface SearchFilters {
  mediaType: 'all' | 'movie' | 'tv';
  genres: number[];
  yearFrom?: number;
  yearTo?: number;
  ratingMin?: number;
  runtimeMin?: number;
  runtimeMax?: number;
  language?: string;
}

interface FilterPanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onApply: () => void;
}

interface Genre {
  id: number;
  name: string;
}

const LANGUAGES = [
  { code: '', label: 'All Languages' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
];

export function FilterPanel({ filters, onFiltersChange, onApply }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [movieGenres, setMovieGenres] = useState<Genre[]>([]);
  const [tvGenres, setTVGenres] = useState<Genre[]>([]);

  useEffect(() => {
    async function loadGenres() {
      try {
        const [movieData, tvData] = await Promise.all([
          tmdbService.getMovieGenres(),
          tmdbService.getTVGenres()
        ]);
        setMovieGenres(movieData.genres || []);
        setTVGenres(tvData.genres || []);
      } catch (error) {
        console.error('Failed to load genres:', error);
      }
    }
    loadGenres();
  }, []);

  const currentYear = new Date().getFullYear();
  const availableGenres = filters.mediaType === 'movie' ? movieGenres :
                          filters.mediaType === 'tv' ? tvGenres :
                          [...movieGenres, ...tvGenres].filter((genre, index, self) =>
                            index === self.findIndex((g) => g.id === genre.id)
                          );

  function toggleGenre(genreId: number) {
    const newGenres = filters.genres.includes(genreId)
      ? filters.genres.filter(id => id !== genreId)
      : [...filters.genres, genreId];
    onFiltersChange({ ...filters, genres: newGenres });
  }

  function clearFilters() {
    onFiltersChange({
      mediaType: 'all',
      genres: [],
      yearFrom: undefined,
      yearTo: undefined,
      ratingMin: undefined,
      runtimeMin: undefined,
      runtimeMax: undefined,
      language: undefined
    });
  }

  const hasActiveFilters = filters.genres.length > 0 || filters.yearFrom || filters.yearTo ||
                           filters.ratingMin || filters.runtimeMin || filters.runtimeMax || filters.language;

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="font-medium">Advanced Filters</span>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 text-xs bg-primary-600 rounded-full">
              Active
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-4 p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Media Type</label>
            <div className="flex gap-2">
              {(['all', 'movie', 'tv'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => onFiltersChange({ ...filters, mediaType: type, genres: [] })}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    filters.mediaType === type
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'TV Shows'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Genres {filters.genres.length > 0 && `(${filters.genres.length} selected)`}
            </label>
            <div className="flex flex-wrap gap-2">
              {availableGenres.map(genre => (
                <button
                  key={genre.id}
                  onClick={() => toggleGenre(genre.id)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    filters.genres.includes(genre.id)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
            <select
              value={filters.language || ''}
              onChange={(e) => onFiltersChange({ ...filters, language: e.target.value || undefined })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Year From</label>
              <input
                type="number"
                min="1900"
                max={currentYear}
                value={filters.yearFrom || ''}
                onChange={(e) => onFiltersChange({ ...filters, yearFrom: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="e.g., 2000"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Year To</label>
              <input
                type="number"
                min="1900"
                max={currentYear}
                value={filters.yearTo || ''}
                onChange={(e) => onFiltersChange({ ...filters, yearTo: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="e.g., 2024"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Minimum Rating: {filters.ratingMin || 0}/10
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={filters.ratingMin || 0}
              onChange={(e) => onFiltersChange({ ...filters, ratingMin: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Min Runtime (minutes)</label>
              <input
                type="number"
                min="0"
                max="300"
                value={filters.runtimeMin || ''}
                onChange={(e) => onFiltersChange({ ...filters, runtimeMin: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="e.g., 60"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Runtime (minutes)</label>
              <input
                type="number"
                min="0"
                max="300"
                value={filters.runtimeMax || ''}
                onChange={(e) => onFiltersChange({ ...filters, runtimeMax: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="e.g., 180"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onApply}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Apply Filters
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
