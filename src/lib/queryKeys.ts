export const queryKeys = {
  trending: (mediaType: string, timeWindow: string, englishOnly: boolean) =>
    ['trending', mediaType, timeWindow, englishOnly] as const,
  anticipated: (mediaType: string, englishOnly: boolean) =>
    ['anticipated', mediaType, englishOnly] as const,
  popular: (mediaType: string, englishOnly: boolean) =>
    ['popular', mediaType, englishOnly] as const,
  movieDetails: (id: number) => ['movie', id] as const,
  tvDetails: (id: number) => ['tv', id] as const,
  watchlist: (userId: string, status: string) => ['watchlist', userId, status] as const,
  preferences: (userId: string) => ['preferences', userId] as const,
  seasonDetails: (tvId: number, season: number) => ['season', tvId, season] as const,
  movieCredits: (id: number) => ['credits', 'movie', id] as const,
  tvCredits: (id: number) => ['credits', 'tv', id] as const,
  movieVideos: (id: number) => ['videos', 'movie', id] as const,
  tvVideos: (id: number) => ['videos', 'tv', id] as const,
  person: (id: number) => ['person', id] as const,
  personCredits: (id: number) => ['person', id, 'credits'] as const,
};
