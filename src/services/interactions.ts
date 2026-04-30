export type InteractionType =
  | 'viewed_detail'
  | 'added_to_watchlist'
  | 'rated'
  | 'completed'
  | 'searched_for'
  | 'clicked_similar';

export interface InteractionMetadata {
  rating?: number;
  search_query?: string;
  genre_ids?: number[];
  [key: string]: any;
}

export async function trackInteraction(
  _userId: string,
  _tmdbId: number,
  _mediaType: 'movie' | 'tv',
  _interactionType: InteractionType,
  _metadata?: InteractionMetadata
) {
  // Interaction tracking tables were removed as part of the profile simplification.
  // This function is kept as a stub for call-site compatibility.
}
