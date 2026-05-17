import { Link } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';

export interface PersonResult {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  known_for?: Array<{ title?: string; name?: string }>;
  media_type: 'person';
}

interface PersonCardProps {
  person: PersonResult;
}

export function PersonCard({ person }: PersonCardProps) {
  const knownForTitles = (person.known_for ?? [])
    .map((k) => k.title || k.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  return (
    <Link to={`/person/${person.id}`} className="group block">
      <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
        <img
          src={tmdbService.getImageUrl(person.profile_path, 'w342')}
          alt={person.name}
          loading="lazy"
          className="w-full aspect-[2/3] object-cover group-hover:opacity-75 transition-opacity"
        />
        <div className="p-3">
          <h3 className="font-semibold text-white text-sm line-clamp-1">{person.name}</h3>
          {person.known_for_department && (
            <p className="text-primary-400 text-xs mt-0.5">{person.known_for_department}</p>
          )}
          {knownForTitles && (
            <p className="text-gray-400 text-xs mt-1 line-clamp-2">{knownForTitles}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
