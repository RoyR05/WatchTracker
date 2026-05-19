import type { Genre, WatchProvider } from '../../services/tmdb';
import { GenreMultiSelect } from './GenreMultiSelect';
import { ProviderMultiSelect } from './ProviderMultiSelect';

interface FilterPanelProps {
  genres: Genre[];
  providers: WatchProvider[];
  selectedGenres: number[];
  selectedProviders: Array<number | string>;
  dateFrom: string;
  dateTo: string;
  minRating: number;
  sortBy: string;
  onGenresChange: (ids: number[]) => void;
  onProvidersChange: (ids: Array<number | string>) => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onMinRatingChange: (v: number) => void;
  onSortByChange: (v: string) => void;
  onClear: () => void;
}

const selectClass =
  'px-4 py-2 bg-gray-800 border border-gray-700 rounded-full text-sm text-white hover:border-primary-500 focus:outline-none focus:border-primary-500 transition-colors';

export function FilterPanel({
  genres,
  providers,
  selectedGenres,
  selectedProviders,
  dateFrom,
  dateTo,
  minRating,
  sortBy,
  onGenresChange,
  onProvidersChange,
  onDateFromChange,
  onDateToChange,
  onMinRatingChange,
  onSortByChange,
  onClear,
}: FilterPanelProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-6 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Genres</h3>
        <GenreMultiSelect
          genres={genres}
          selected={selectedGenres}
          onChange={onGenresChange}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">
          Streaming availability
        </h3>
        <ProviderMultiSelect
          providers={providers}
          selected={selectedProviders}
          onChange={onProvidersChange}
        />
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Released from
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => onDateFromChange(e.target.value)}
            className={selectClass}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Released to
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={e => onDateToChange(e.target.value)}
            className={selectClass}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Minimum rating
          </label>
          <select
            value={minRating}
            onChange={e => onMinRatingChange(Number(e.target.value))}
            className={selectClass}
          >
            <option value={0}>Any</option>
            <option value={5}>5+</option>
            <option value={6}>6+</option>
            <option value={7}>7+</option>
            <option value={8}>8+</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Sort by
          </label>
          <select
            value={sortBy}
            onChange={e => onSortByChange(e.target.value)}
            className={selectClass}
          >
            <option value="">Tab default</option>
            <option value="popularity.desc">Popularity</option>
            <option value="vote_average.desc">Rating</option>
            <option value="newest">Newest first</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
