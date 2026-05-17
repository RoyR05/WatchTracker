import { Link } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';

interface CreditCardProps {
  personId: number;
  name: string;
  role: string;
  profilePath: string | null;
  isFollowed: boolean;
  onToggleFollow: () => void;
}

export function CreditCard({
  personId,
  name,
  role,
  profilePath,
  isFollowed,
  onToggleFollow,
}: CreditCardProps) {
  return (
    <Link
      to={`/person/${personId}`}
      className="relative block w-36 flex-none bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all group"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFollow();
        }}
        aria-label={isFollowed ? `Unfollow ${name}` : `Follow ${name}`}
        title={isFollowed ? 'Following — tap to unfollow' : 'Follow'}
        className={`absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-colors ${
          isFollowed
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-black/60 text-white hover:bg-primary-600'
        }`}
      >
        {isFollowed ? '✓' : '+'}
      </button>
      <img
        src={tmdbService.getImageUrl(profilePath ?? null, 'w342')}
        alt={name}
        loading="lazy"
        className="w-full h-44 object-cover group-hover:opacity-75 transition-opacity"
      />
      <div className="p-3">
        <p className="font-semibold text-white text-sm truncate group-hover:text-primary-400 transition-colors">
          {name}
        </p>
        <p className="text-gray-400 text-xs truncate">{role}</p>
      </div>
    </Link>
  );
}
