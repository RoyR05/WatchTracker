import { Link } from 'react-router-dom';
import './MediaCard.css';

interface MediaCardProps {
  id: number;
  title: string;
  posterPath: string | null;
  mediaType: 'movie' | 'tv';
  rating: number;
}

export function MediaCard({ id, title, posterPath, mediaType, rating }: MediaCardProps) {
  const imageUrl = posterPath
    ? `https://image.tmdb.org/t/p/w500${posterPath}`
    : 'https://via.placeholder.com/500x750?text=No+Image';

  return (
    <Link to={`/${mediaType}/${id}`} className="media-card">
      <div className="media-card-image">
        <img src={imageUrl} alt={title} />
        <div className="media-card-rating">{rating.toFixed(1)}</div>
      </div>
      <div className="media-card-info">
        <h3>{title}</h3>
      </div>
    </Link>
  );
}
