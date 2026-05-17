const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const TMDB_PROXY_URL = `${SUPABASE_URL}/functions/v1/tmdb-proxy`;

export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

export interface TVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  genre_ids: number[];
}

export interface MovieDetails extends Movie {
  runtime: number;
  genres: Array<{ id: number; name: string }>;
  status: string;
  tagline?: string;
}

export interface TVShowDetails extends TVShow {
  number_of_seasons: number;
  number_of_episodes: number;
  created_by?: Array<{ id: number; name: string; profile_path: string | null }>;
  next_episode_to_air?: {
    id: number;
    name: string;
    air_date: string;
    episode_number: number;
    season_number: number;
    still_path: string | null;
  } | null;
  genres: Array<{ id: number; name: string }>;
  seasons: Array<{
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    air_date: string;
    poster_path: string | null;
  }>;
  status: string;
  tagline?: string;
}

export interface Season {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  air_date: string;
  poster_path: string | null;
  episodes: Array<{
    id: number;
    name: string;
    overview: string;
    episode_number: number;
    season_number: number;
    air_date: string;
    still_path: string | null;
  }>;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path?: string | null;
}

export interface Credits {
  cast: CastMember[];
  crew: CrewMember[];
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface VideosResponse {
  results: Video[];
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  also_known_as: string[];
}

export interface MovieCredit {
  id: number;
  title: string;
  character?: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
}

export interface TVCredit {
  id: number;
  name: string;
  character?: string;
  poster_path: string | null;
  first_air_date: string;
  vote_average: number;
}

export interface PersonCredits {
  cast: Array<MovieCredit | TVCredit>;
  crew: CrewMember[];
}

async function tmdbFetch(endpoint: string, params: Record<string, string> = {}, retries = 0): Promise<any> {
  const searchParams = new URLSearchParams({ endpoint, ...params });
  const response = await fetch(`${TMDB_PROXY_URL}?${searchParams.toString()}`);

  if (response.status === 429) {
    if (retries < 3) {
      const waitTime = Math.pow(2, retries) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return tmdbFetch(endpoint, params, retries + 1);
    }
    throw new Error('TMDB API rate limit exceeded. Please try again in a few moments.');
  }

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.statusText}`);
  }

  return response.json();
}

export const tmdbService = {
  getImageUrl: (path: string | null, size: 'w342' | 'w500' | 'w780' | 'original' = 'w500') => {
    if (!path) {
      return 'data:image/svg+xml;base64,' + btoa(`
        <svg width="500" height="750" viewBox="0 0 500 750" xmlns="http://www.w3.org/2000/svg">
          <rect width="500" height="750" fill="#1f2937"/>
          <g transform="translate(250, 375)">
            <circle cx="0" cy="-60" r="80" fill="#374151" opacity="0.5"/>
            <polygon points="0,-30 -30,10 30,10" fill="#4b5563" opacity="0.7"/>
            <rect x="-60" y="20" width="120" height="80" rx="8" fill="#374151" opacity="0.5"/>
            <text x="0" y="130" font-family="Arial, sans-serif" font-size="24" fill="#6b7280" text-anchor="middle">No Image</text>
            <text x="0" y="160" font-family="Arial, sans-serif" font-size="18" fill="#4b5563" text-anchor="middle">Available</text>
          </g>
        </svg>
      `.trim());
    }
    return `https://image.tmdb.org/t/p/${size}${path}`;
  },

  searchMulti: async (query: string, page = 1): Promise<{ results: Array<Movie | TVShow>; total_pages: number }> => {
    return tmdbFetch('/search/multi', { query, page: page.toString() });
  },

  getTrending: async (mediaType: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'week', page = 1, englishOnly = false) => {
    if (englishOnly && mediaType !== 'all') {
      return tmdbFetch(`/discover/${mediaType}`, {
        page: page.toString(),
        'with_original_language': 'en',
        'sort_by': 'popularity.desc',
        'vote_count.gte': '100'
      });
    } else if (englishOnly && mediaType === 'all') {
      const [movies, tvShows] = await Promise.all([
        tmdbFetch('/discover/movie', {
          page: page.toString(),
          'with_original_language': 'en',
          'sort_by': 'popularity.desc',
          'vote_count.gte': '100'
        }),
        tmdbFetch('/discover/tv', {
          page: page.toString(),
          'with_original_language': 'en',
          'sort_by': 'popularity.desc',
          'vote_count.gte': '100'
        })
      ]);

      const combined = [
        ...(movies.results || []),
        ...(tvShows.results || [])
      ].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

      return {
        results: combined,
        page: page,
        total_pages: Math.max(movies.total_pages || 1, tvShows.total_pages || 1)
      };
    }

    return tmdbFetch(`/trending/${mediaType}/${timeWindow}`, { page: page.toString() });
  },

  getMovieDetails: async (movieId: number): Promise<MovieDetails> => {
    return tmdbFetch(`/movie/${movieId}`, {});
  },

  getTVShowDetails: async (tvId: number): Promise<TVShowDetails> => {
    return tmdbFetch(`/tv/${tvId}`, {});
  },

  getSeasonDetails: async (tvId: number, seasonNumber: number): Promise<Season> => {
    return tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`, {});
  },

  getPopularMovies: async (page = 1, englishOnly = false) => {
    if (englishOnly) {
      return tmdbFetch('/discover/movie', {
        page: page.toString(),
        'with_original_language': 'en',
        'sort_by': 'popularity.desc'
      });
    }
    return tmdbFetch('/movie/popular', { page: page.toString() });
  },

  getPopularTVShows: async (page = 1, englishOnly = false) => {
    if (englishOnly) {
      return tmdbFetch('/discover/tv', {
        page: page.toString(),
        'with_original_language': 'en',
        'sort_by': 'popularity.desc'
      });
    }
    return tmdbFetch('/tv/popular', { page: page.toString() });
  },

  getTopRatedMovies: async (page = 1) => {
    return tmdbFetch('/movie/top_rated', { page: page.toString() });
  },

  getTopRatedTVShows: async (page = 1) => {
    return tmdbFetch('/tv/top_rated', { page: page.toString() });
  },

  getMovieCredits: async (movieId: number): Promise<Credits> => {
    return tmdbFetch(`/movie/${movieId}/credits`, {});
  },

  getTVShowCredits: async (tvId: number): Promise<Credits> => {
    return tmdbFetch(`/tv/${tvId}/credits`, {});
  },

  getMovieVideos: async (movieId: number): Promise<VideosResponse> => {
    return tmdbFetch(`/movie/${movieId}/videos`, {});
  },

  getTVShowVideos: async (tvId: number): Promise<VideosResponse> => {
    return tmdbFetch(`/tv/${tvId}/videos`, {});
  },

  getPersonDetails: async (personId: number): Promise<PersonDetails> => {
    return tmdbFetch(`/person/${personId}`, {});
  },

  getPersonCombinedCredits: async (personId: number): Promise<PersonCredits> => {
    return tmdbFetch(`/person/${personId}/combined_credits`, {});
  },

  discover: async (
    mediaType: 'movie' | 'tv',
    params: Record<string, string> = {}
  ): Promise<{ results: Array<Movie | TVShow>; total_pages: number }> => {
    return tmdbFetch(`/discover/${mediaType}`, params);
  },

  // Browse a streaming service's catalog (TMDB watch-provider, US region).
  discoverByProvider: async (
    mediaType: 'movie' | 'tv',
    providerId: number,
    page = 1,
    sortBy: 'popularity.desc' | 'primary_release_date.desc' | 'first_air_date.desc' | 'vote_average.desc' = 'popularity.desc',
    minVotes = 20
  ): Promise<{ results: Array<Movie | TVShow>; total_pages: number }> => {
    return tmdbFetch(`/discover/${mediaType}`, {
      page: page.toString(),
      with_watch_providers: providerId.toString(),
      watch_region: 'US',
      sort_by: sortBy,
      'vote_count.gte': minVotes.toString(),
    });
  },

  getUpcomingMovies: async (page = 1, englishOnly = false) => {
    if (englishOnly) {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 90);

      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      return tmdbFetch('/discover/movie', {
        page: page.toString(),
        'with_original_language': 'en',
        'release_date.gte': todayStr,
        'release_date.lte': futureDateStr,
        'sort_by': 'release_date.asc'
      });
    }
    return tmdbFetch('/movie/upcoming', { page: page.toString() });
  },

  getUpcomingTVShows: async (page = 1, englishOnly = false) => {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 90);

    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const params: Record<string, string> = {
      page: page.toString(),
      'first_air_date.gte': todayStr,
      'first_air_date.lte': futureDateStr,
      'sort_by': 'first_air_date.asc'
    };

    if (englishOnly) {
      params['with_original_language'] = 'en';
    }

    return tmdbFetch('/discover/tv', params);
  },

  getAnticipated: async (mediaType: 'movie' | 'tv' | 'all' = 'all', page = 1, englishOnly = false) => {
    if (mediaType === 'movie') {
      return tmdbService.getUpcomingMovies(page, englishOnly);
    } else if (mediaType === 'tv') {
      return tmdbService.getUpcomingTVShows(page, englishOnly);
    } else {
      const [movies, tvShows] = await Promise.all([
        tmdbService.getUpcomingMovies(page, englishOnly),
        tmdbService.getUpcomingTVShows(page, englishOnly)
      ]);

      const combined = [
        ...(movies.results || []),
        ...(tvShows.results || [])
      ].sort((a, b) => {
        const dateA = 'release_date' in a ? a.release_date : 'first_air_date' in a ? a.first_air_date : '';
        const dateB = 'release_date' in b ? b.release_date : 'first_air_date' in b ? b.first_air_date : '';
        return dateA.localeCompare(dateB);
      });

      return {
        results: combined,
        page: page,
        total_pages: Math.max(movies.total_pages || 1, tvShows.total_pages || 1)
      };
    }
  },

  getPopular: async (mediaType: 'movie' | 'tv' | 'all' = 'all', page = 1, englishOnly = false) => {
    if (mediaType === 'movie') {
      return tmdbService.getPopularMovies(page, englishOnly);
    } else if (mediaType === 'tv') {
      return tmdbService.getPopularTVShows(page, englishOnly);
    } else {
      const [movies, tvShows] = await Promise.all([
        tmdbService.getPopularMovies(page, englishOnly),
        tmdbService.getPopularTVShows(page, englishOnly)
      ]);

      const combined = [
        ...(movies.results || []),
        ...(tvShows.results || [])
      ].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));

      return {
        results: combined,
        page: page,
        total_pages: Math.max(movies.total_pages || 1, tvShows.total_pages || 1)
      };
    }
  },
};

