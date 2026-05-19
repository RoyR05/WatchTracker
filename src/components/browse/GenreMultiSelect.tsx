import type { Genre } from '../../services/tmdb';

interface GenreMultiSelectProps {
  genres: Genre[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

export function GenreMultiSelect({ genres, selected, onChange }: GenreMultiSelectProps) {
  function toggle(id: number) {
    if (selected.includes(id)) {
      onChange(selected.filter(g => g !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (genres.length === 0) {
    return <p className="text-gray-500 text-sm">Genres unavailable.</p>;
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {genres.map(g => {
        const active = selected.includes(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => toggle(g.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active
                ? 'bg-primary-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {g.name}
          </button>
        );
      })}
    </div>
  );
}
