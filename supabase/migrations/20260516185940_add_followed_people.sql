-- Phase 18B: Follow people (actors / directors / creators)
CREATE TABLE IF NOT EXISTS followed_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id integer NOT NULL,                 -- TMDB person id
  name text NOT NULL,
  profile_path text,
  known_for_department text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, person_id)
);

ALTER TABLE followed_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own follows select" ON followed_people
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "own follows insert" ON followed_people
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "own follows delete" ON followed_people
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_followed_people_user ON followed_people (user_id);
