interface Genre {
  id: number;
  name: string;
  icon: string;
  gradient: string;
}

const GENRES: Genre[] = [
  { id: 28, name: 'Action', icon: '💥', gradient: 'from-blue-400 to-cyan-500' },
  { id: 12, name: 'Adventure', icon: '🗺️', gradient: 'from-cyan-400 to-teal-500' },
  { id: 16, name: 'Anime', icon: '🎭', gradient: 'from-pink-400 to-rose-500' },
  { id: 36, name: 'Biography', icon: '📖', gradient: 'from-blue-400 to-indigo-500' },
  { id: 35, name: 'Comedy', icon: '😄', gradient: 'from-orange-400 to-pink-500' },
  { id: 80, name: 'Crime', icon: '🔍', gradient: 'from-cyan-400 to-blue-500' },
  { id: 99, name: 'Documentary', icon: '🎥', gradient: 'from-blue-400 to-purple-500' },
  { id: 18, name: 'Drama', icon: '🎭', gradient: 'from-purple-400 to-pink-500' },
  { id: 14, name: 'Fantasy', icon: '🧙', gradient: 'from-pink-400 to-purple-500' },
  { id: 27, name: 'Horror', icon: '👻', gradient: 'from-teal-400 to-cyan-500' },
  { id: 10752, name: 'Military', icon: '⚔️', gradient: 'from-teal-400 to-green-500' },
  { id: 9648, name: 'Mystery', icon: '🔮', gradient: 'from-purple-400 to-blue-500' },
  { id: 10764, name: 'Reality', icon: '🎬', gradient: 'from-pink-400 to-orange-500' },
  { id: 10749, name: 'Romance', icon: '💕', gradient: 'from-rose-400 to-pink-500' },
  { id: 878, name: 'Science Fiction', icon: '🚀', gradient: 'from-green-400 to-teal-500' },
  { id: 10770, name: 'Sitcom', icon: '📺', gradient: 'from-orange-400 to-rose-500' },
];

interface GenreBrowserProps {
  onGenreSelect: (genreId: number, genreName: string) => void;
}

export function GenreBrowser({ onGenreSelect }: GenreBrowserProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Explore Categories</h2>
        <p className="text-sm text-gray-400">Tap any category to explore</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {GENRES.map((genre) => (
          <button
            key={genre.id}
            onClick={() => onGenreSelect(genre.id, genre.name)}
            className="group relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-300 hover:scale-105 hover:shadow-xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800/0 to-gray-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative flex flex-col items-center justify-center space-y-3">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${genre.gradient} flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                {genre.icon}
              </div>

              <h3 className="text-base font-semibold text-white text-center">
                {genre.name}
              </h3>
            </div>

            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${genre.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
          </button>
        ))}
      </div>
    </div>
  );
}
