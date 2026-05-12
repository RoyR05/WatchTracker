export const queryKeys = {
  trending: (mediaType: string, timeWindow: string, englishOnly: boolean) =>
    ['trending', mediaType, timeWindow, englishOnly] as const,
  anticipated: (mediaType: string, englishOnly: boolean) =>
    ['anticipated', mediaType, englishOnly] as const,
  popular: (mediaType: string, englishOnly: boolean) =>
    ['popular', mediaType, englishOnly] as const,
  watchlist: (userId: string, status: string) =>
    ['watchlist', userId, status] as const,
};
