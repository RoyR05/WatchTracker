-- Phase 18D: Daily cache of "new releases from followed people"
CREATE TABLE IF NOT EXISTS followed_feed_cache (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{tmdb_id, media_type, title, poster_path, year, vote_average, release_date, person_name}]
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE followed_feed_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own feed cache select" ON followed_feed_cache
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "own feed cache insert" ON followed_feed_cache
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "own feed cache update" ON followed_feed_cache
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));
