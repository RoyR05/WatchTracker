export const preferencesService = {
  async updateGenrePreferences(profileId: string, genreIds: number[]): Promise<void> {
    console.log('Updating genre preferences:', { profileId, genreIds });
  },

  async getPreferences(profileId: string) {
    console.log('Getting preferences for:', profileId);
    return {
      genres: [],
      keywords: [],
    };
  },

  async getPreference(tmdbId: number, mediaType: string, profileId: string) {
    console.log('Getting preference:', { tmdbId, mediaType, profileId });
    return null;
  },

  async setPreference(tmdbId: number, mediaType: string, preference: string, profileId: string, metadata?: any): Promise<void> {
    console.log('Setting preference:', { tmdbId, mediaType, preference, profileId, metadata });
  },

  async removePreference(tmdbId: number, mediaType: string, preference: string, profileId: string): Promise<void> {
    console.log('Removing preference:', { tmdbId, mediaType, preference, profileId });
  },
};
