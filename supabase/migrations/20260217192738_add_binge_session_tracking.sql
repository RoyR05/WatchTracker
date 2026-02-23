/*
  # Add Binge-Watch Session Tracking

  ## Overview
  Adds tables and functions to track binge-watching sessions and provide intelligent 
  episode tracking features including auto-marking, session statistics, and reminders.

  ## New Tables

  ### `binge_sessions`
  Tracks continuous viewing sessions for TV shows
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - References profiles(id)
  - `tmdb_id` (integer) - TMDB TV show ID
  - `started_at` (timestamptz) - When session began
  - `ended_at` (timestamptz) - When session ended (null if ongoing)
  - `episodes_watched` (integer) - Number of episodes in session
  - `total_duration_minutes` (integer) - Total viewing time
  - `created_at` (timestamptz) - Entry creation timestamp

  ### `episode_reminders`
  Stores reminders for upcoming episodes and season finales
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - References profiles(id)
  - `tmdb_id` (integer) - TMDB TV show ID
  - `season_number` (integer) - Season number
  - `episode_number` (integer) - Episode number
  - `air_date` (timestamptz) - When episode airs
  - `is_season_finale` (boolean) - Whether this is a season finale
  - `reminder_sent` (boolean) - Whether reminder was sent
  - `created_at` (timestamptz) - Entry creation timestamp

  ## Security
  Row Level Security enabled with user-specific access policies
*/

-- Create binge_sessions table
CREATE TABLE IF NOT EXISTS binge_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  episodes_watched integer DEFAULT 0,
  total_duration_minutes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE binge_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own binge sessions"
  ON binge_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own binge sessions"
  ON binge_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own binge sessions"
  ON binge_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own binge sessions"
  ON binge_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create episode_reminders table
CREATE TABLE IF NOT EXISTS episode_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  season_number integer NOT NULL,
  episode_number integer NOT NULL,
  air_date timestamptz NOT NULL,
  is_season_finale boolean DEFAULT false,
  reminder_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tmdb_id, season_number, episode_number)
);

ALTER TABLE episode_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own episode reminders"
  ON episode_reminders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own episode reminders"
  ON episode_reminders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own episode reminders"
  ON episode_reminders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own episode reminders"
  ON episode_reminders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_binge_sessions_user_id ON binge_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_binge_sessions_tmdb_id ON binge_sessions(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_binge_sessions_ended_at ON binge_sessions(ended_at);

CREATE INDEX IF NOT EXISTS idx_episode_reminders_user_id ON episode_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_episode_reminders_tmdb_id ON episode_reminders(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_episode_reminders_air_date ON episode_reminders(air_date);
CREATE INDEX IF NOT EXISTS idx_episode_reminders_reminder_sent ON episode_reminders(reminder_sent);

-- Function to get current or create new binge session
CREATE OR REPLACE FUNCTION get_or_create_binge_session(
  p_user_id uuid,
  p_tmdb_id integer
)
RETURNS uuid AS $$
DECLARE
  v_session_id uuid;
  v_last_watched timestamptz;
BEGIN
  -- Find the most recent session for this show
  SELECT id, started_at INTO v_session_id, v_last_watched
  FROM binge_sessions
  WHERE user_id = p_user_id 
    AND tmdb_id = p_tmdb_id 
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  -- If no active session or last session was more than 2 hours ago, create new one
  IF v_session_id IS NULL OR (NOW() - v_last_watched) > INTERVAL '2 hours' THEN
    -- End previous session if exists
    IF v_session_id IS NOT NULL THEN
      UPDATE binge_sessions 
      SET ended_at = NOW() 
      WHERE id = v_session_id;
    END IF;

    -- Create new session
    INSERT INTO binge_sessions (user_id, tmdb_id, started_at)
    VALUES (p_user_id, p_tmdb_id, NOW())
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update binge session when episode is watched
CREATE OR REPLACE FUNCTION update_binge_session_on_watch()
RETURNS TRIGGER AS $$
DECLARE
  v_session_id uuid;
BEGIN
  -- Only process when marking episode as watched
  IF NEW.watched = true AND (OLD.watched IS NULL OR OLD.watched = false) THEN
    -- Get or create binge session
    v_session_id := get_or_create_binge_session(NEW.user_id, NEW.tmdb_id);
    
    -- Update session stats (assuming average 45 min per episode)
    UPDATE binge_sessions
    SET 
      episodes_watched = episodes_watched + 1,
      total_duration_minutes = total_duration_minutes + 45
    WHERE id = v_session_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-update binge session
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'track_binge_session') THEN
    CREATE TRIGGER track_binge_session
      AFTER INSERT OR UPDATE ON tv_show_progress
      FOR EACH ROW
      EXECUTE FUNCTION update_binge_session_on_watch();
  END IF;
END $$;