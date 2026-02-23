interface MediaTypeSwitcherProps {
  value: 'all' | 'movie' | 'tv';
  onChange: (type: 'all' | 'movie' | 'tv') => void;
}

export function MediaTypeSwitcher({ value, onChange }: MediaTypeSwitcherProps) {
  return (
    <div className="relative inline-flex items-center bg-gray-800 rounded-full p-1 border border-gray-700">
      <button
        onClick={() => onChange('all')}
        className={`relative p-2.5 rounded-full transition-all duration-200 group ${
          value === 'all'
            ? 'text-white'
            : 'text-gray-400 hover:text-gray-300'
        }`}
        title="All Media"
        aria-label="All Media"
      >
        {value === 'all' && (
          <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-lg" />
        )}
        <svg className="relative z-10 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>

      <button
        onClick={() => onChange('movie')}
        className={`relative p-2.5 rounded-full transition-all duration-200 group ${
          value === 'movie'
            ? 'text-white'
            : 'text-gray-400 hover:text-gray-300'
        }`}
        title="Movies Only"
        aria-label="Movies Only"
      >
        {value === 'movie' && (
          <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-lg" />
        )}
        <svg className="relative z-10 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      </button>

      <button
        onClick={() => onChange('tv')}
        className={`relative p-2.5 rounded-full transition-all duration-200 group ${
          value === 'tv'
            ? 'text-white'
            : 'text-gray-400 hover:text-gray-300'
        }`}
        title="TV Shows Only"
        aria-label="TV Shows Only"
      >
        {value === 'tv' && (
          <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-lg" />
        )}
        <svg className="relative z-10 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  );
}
