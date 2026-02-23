import { supabase } from '../lib/supabase';

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
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  interactionType: InteractionType,
  metadata?: InteractionMetadata
) {
  try {
    const { error } = await supabase
      .from('user_interactions')
      .insert({
        profile_id: profileId,
        tmdb_id: tmdbId,
        media_type: mediaType,
        interaction_type: interactionType,
        metadata: metadata || {}
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error tracking interaction:', error);
  }
}

export async function getProfileInteractions(
  profileId: string,
  interactionType?: InteractionType,
  limit = 100
) {
  try {
    let query = supabase
      .from('user_interactions')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (interactionType) {
      query = query.eq('interaction_type', interactionType);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching interactions:', error);
    return [];
  }
}

export async function getRecentlyViewed(profileId: string, limit = 20) {
  return getProfileInteractions(profileId, 'viewed_detail', limit);
}

export async function updateProfileAffinities(profileId: string) {
  const interactions = await getProfileInteractions(profileId, undefined, 500);

  const genreScores: Record<string, number> = {};
  const actorScores: Record<string, number> = {};
  const directorScores: Record<string, number> = {};
  const decadeScores: Record<string, number> = {};

  const interactionWeights: Record<InteractionType, number> = {
    viewed_detail: 1,
    added_to_watchlist: 3,
    rated: 5,
    completed: 4,
    searched_for: 2,
    clicked_similar: 1
  };

  interactions.forEach(interaction => {
    const weight = interactionWeights[interaction.interaction_type as InteractionType] || 1;
    const metadata = interaction.metadata as InteractionMetadata;

    if (metadata.genre_ids && Array.isArray(metadata.genre_ids)) {
      metadata.genre_ids.forEach((genreId: number) => {
        const key = genreId.toString();
        genreScores[key] = (genreScores[key] || 0) + weight;
      });
    }

    if (metadata.cast && Array.isArray(metadata.cast)) {
      metadata.cast.slice(0, 5).forEach((actor: string) => {
        actorScores[actor] = (actorScores[actor] || 0) + weight;
      });
    }

    if (metadata.director) {
      directorScores[metadata.director] = (directorScores[metadata.director] || 0) + weight;
    }

    if (metadata.release_year || metadata.first_air_year) {
      const year = metadata.release_year || metadata.first_air_year;
      const decade = `${Math.floor(year / 10) * 10}s`;
      decadeScores[decade] = (decadeScores[decade] || 0) + weight;
    }
  });

  const normalize = (scores: Record<string, number>) => {
    const max = Math.max(...Object.values(scores), 1);
    return Object.entries(scores).map(([key, value]) => ({
      key,
      score: (value / max) * 100
    }));
  };

  const allAffinities = [
    ...normalize(genreScores).map(({ key, score }) => ({
      profile_id: profileId,
      affinity_type: 'genre',
      affinity_value: key,
      score
    })),
    ...normalize(actorScores).map(({ key, score }) => ({
      profile_id: profileId,
      affinity_type: 'actor',
      affinity_value: key,
      score
    })),
    ...normalize(directorScores).map(({ key, score }) => ({
      profile_id: profileId,
      affinity_type: 'director',
      affinity_value: key,
      score
    })),
    ...normalize(decadeScores).map(({ key, score }) => ({
      profile_id: profileId,
      affinity_type: 'decade',
      affinity_value: key,
      score
    }))
  ];

  for (const affinity of allAffinities) {
    await supabase
      .from('profile_affinity')
      .upsert({
        ...affinity,
        last_updated_at: new Date().toISOString()
      }, {
        onConflict: 'profile_id,affinity_type,affinity_value'
      });
  }
}

export async function getTopAffinities(
  profileId: string,
  affinityType: 'genre' | 'actor' | 'director' | 'decade',
  limit = 10
) {
  try {
    const { data, error } = await supabase
      .from('profile_affinity')
      .select('*')
      .eq('profile_id', profileId)
      .eq('affinity_type', affinityType)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching affinities:', error);
    return [];
  }
}
