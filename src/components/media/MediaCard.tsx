import { Link } from 'react-router-dom';

interface MediaCardProps {
  id: number;
  title: string;
  posterPath: string | null;
  mediaType: 'movie' | 'tv';
  releaseDate?: string;
  voteAverage?: number;
}

export function MediaCard({ id, title, posterPath, mediaType, releaseDate, voteAverage }: MediaCardProps) {
  const imageUrl = posterPath
    ? `https://image.tmdb.org/t/p/w500${posterPath}`
    : 'https://via.placeholder.com/500x750?text=No+Image';

  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

  return (
    <Link
      to={`/${mediaType}/${id}`}
      className="group relative block bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-1"
    >
      <div className="aspect-[2/3] relative">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {voteAverage !== undefined && voteAverage > 0 && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm font-bold">
            {voteAverage.toFixed(1)}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-white font-semibold text-sm line-clamp-2 group-hover:text-blue-400 transition-colors">
          {title}
        </h3>
        {year && (
          <p className="text-gray-400 text-xs mt-1">{year}</p>
        )}
      </div>
    </Link>
  );
}
