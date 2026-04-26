/*
  # Add Plex Integration Tables

  1. New Tables
    - `plex_server_config`
      - `id` (integer, constrained to 1 - single row)
      - `plex_server_url` (text) - URL of the Plex Media Server
      - `library_movie_section_id` (text, nullable) - Plex library section ID for movies
      - `library_tv_section_id` (text, nullable) - Plex library section ID for TV shows
      - `updated_at` (timestamptz)

    - `plex_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to profiles.id) - user who submitted the request
      - `profile_id` (uuid, FK to user_profiles.id, nullable) - profile used when submitting
      - `tmdb_id` (integer) - TMDB content ID
      - `media_type` (text, check: movie/tv)
      - `title` (text) - content title for display
      - `poster_path` (text, nullable) - poster image path
      - `status` (text, check: pending/approved/added/rejected/bad_file) - request status
      - `admin_notes` (text, nullable) - admin response notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `resolved_at` (timestamptz, nullable) - when the request was resolved

  2. Security
    - Enable RLS on both tables
    - `plex_server_config`: only admin can read/write
    - `plex_requests`: authenticated users can insert and read own rows; admin can read/update all

  3. Notes
    - Unique constraint on (tmdb_id, media_type) in plex_requests to prevent duplicate requests
    - Admin is determined by matching user_id against admin_config table
*/

-- Create plex_server_config table (single-row config)
CREATE TABLE IF NOT EXISTS plex_server_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  plex_server_url text NOT NULL DEFAULT '',
  library_movie_section_id text,
  library_tv_section_id text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE plex_server_config ENABLE ROW LEVEL SECURITY;

-- Only admin can read plex server config
CREATE POLICY "Admin can read plex server config"
  ON plex_server_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_config
      WHERE admin_config.admin_user_id = auth.uid()
    )
  );

-- Only admin can insert plex server config
CREATE POLICY "Admin can insert plex server config"
  ON plex_server_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_config
      WHERE admin_config.admin_user_id = auth.uid()
    )
  );

-- Only admin can update plex server config
CREATE POLICY "Admin can update plex server config"
  ON plex_server_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_config
      WHERE admin_config.admin_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_config
      WHERE admin_config.admin_user_id = auth.uid()
    )
  );

-- Create plex_requests table
CREATE TABLE IF NOT EXISTS plex_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  profile_id uuid REFERENCES user_profiles(id),
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type = ANY (ARRAY['movie'::text, 'tv'::text])),
  title text NOT NULL,
  poster_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'added'::text, 'rejected'::text, 'bad_file'::text])),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Unique constraint: one active request per content item
CREATE UNIQUE INDEX IF NOT EXISTS plex_requests_tmdb_media_unique
  ON plex_requests (tmdb_id, media_type)
  WHERE status IN ('pending', 'approved', 'bad_file');

-- Index for user lookups
CREATE INDEX IF NOT EXISTS plex_requests_user_id_idx ON plex_requests (user_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS plex_requests_status_idx ON plex_requests (status);

ALTER TABLE plex_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own requests
CREATE POLICY "Users can read own plex requests"
  ON plex_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admin can read all plex requests
CREATE POLICY "Admin can read all plex requests"
  ON plex_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_config
      WHERE admin_config.admin_user_id = auth.uid()
    )
  );

-- Authenticated users can insert their own requests
CREATE POLICY "Users can insert own plex requests"
  ON plex_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own pending requests
CREATE POLICY "Users can delete own pending plex requests"
  ON plex_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

-- Admin can update any plex request
CREATE POLICY "Admin can update plex requests"
  ON plex_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_config
      WHERE admin_config.admin_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_config
      WHERE admin_config.admin_user_id = auth.uid()
    )
  );
