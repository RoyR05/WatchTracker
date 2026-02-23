import './Skeleton.css';

export function SkeletonGrid() {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="skeleton-item">
          <div className="skeleton-image"></div>
          <div className="skeleton-text"></div>
        </div>
      ))}
    </div>
  );
}
