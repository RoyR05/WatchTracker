export interface Database {
  public: {
    Tables: {
      watchlist_items: {
        Row: {
          id: string;
          user_id: string;
          media_type: 'movie' | 'tv';
          media_id: number;
          status: 'watching' | 'completed' | 'plan_to_watch' | 'dropped';
          created_at: string;
        };
      };
    };
  };
}
