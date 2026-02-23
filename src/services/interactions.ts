export async function trackInteraction(
  profileId: string,
  tmdbId: number,
  mediaType: string,
  interactionType: string,
  metadata?: any
): Promise<void> {
  console.log('Tracking interaction:', { profileId, tmdbId, mediaType, interactionType, metadata });
}
