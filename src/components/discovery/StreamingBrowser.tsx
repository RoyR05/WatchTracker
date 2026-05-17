export const STREAMING_PROVIDERS = [
  { id: 8, name: 'Netflix' },
  { id: 337, name: 'Disney+' },
  { id: 9, name: 'Prime Video' },
  { id: 350, name: 'Apple TV+' },
  { id: 1899, name: 'Max' },
  { id: 15, name: 'Hulu' },
  { id: 531, name: 'Paramount+' },
  { id: 386, name: 'Peacock' },
];

interface StreamingBrowserProps {
  onSelect: (providerId: number, providerName: string) => void;
}

export function StreamingBrowser({ onSelect }: StreamingBrowserProps) {
  return (
    <section>
      <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Browse by Streaming Service</h2>
          <span className="text-sm text-gray-400">What's on each platform</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {STREAMING_PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id, p.name)}
              className="px-4 py-2 rounded-full text-sm font-medium bg-gray-700 text-gray-200 hover:bg-primary-600 hover:text-white transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
