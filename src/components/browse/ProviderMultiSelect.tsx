import type { WatchProvider } from '../../services/tmdb';
import { tmdbService } from '../../services/tmdb';

interface ProviderMultiSelectProps {
  providers: WatchProvider[];
  selected: Array<number | string>;
  onChange: (ids: Array<number | string>) => void;
}

export function ProviderMultiSelect({
  providers,
  selected,
  onChange,
}: ProviderMultiSelectProps) {
  function toggle(id: number | string) {
    if (selected.includes(id)) {
      onChange(selected.filter(p => p !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (providers.length === 0) {
    return <p className="text-gray-500 text-sm">Streaming services unavailable.</p>;
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {providers.map(p => {
        const active = selected.includes(p.provider_id);
        return (
          <button
            key={p.provider_id}
            type="button"
            onClick={() => toggle(p.provider_id)}
            className={`flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active
                ? 'bg-primary-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {p.logo_path ? (
              <img
                src={tmdbService.getImageUrl(p.logo_path, 'w342')}
                alt=""
                className="w-6 h-6 rounded-md object-cover"
                loading="lazy"
              />
            ) : (
              <span className="w-6 h-6 rounded-md bg-gray-600" />
            )}
            {p.provider_name}
          </button>
        );
      })}
    </div>
  );
}
