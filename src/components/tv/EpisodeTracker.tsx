interface EpisodeTrackerProps {
  tvId: number;
  numberOfSeasons: number;
}

export function EpisodeTracker({ tvId: _tvId, numberOfSeasons }: EpisodeTrackerProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 mt-6">
      <h2 className="text-xl font-bold text-white mb-4">Episodes</h2>
      <p className="text-gray-400">
        Episode tracking coming soon ({numberOfSeasons} season{numberOfSeasons !== 1 ? 's' : ''})
      </p>
    </div>
  );
}
