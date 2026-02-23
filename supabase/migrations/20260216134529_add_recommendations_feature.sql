/*
  # Add Recommendations Feature
  
  ## Overview
  Enables users to recommend movies and TV shows to their friends and family with
  personal messages and status tracking.

  ## New Tables
  
  ### `recommendations`
  Personal recommendations between users
  - `id` (uuid, primary key) - Unique identifier
  - `from_user_id` (uuid) - References profiles(id) - User sending recommendation
  - `to_user_id` (uuid) - References profiles(id) - User receiving recommendation
  - `tmdb_id` (integer) - TMDB media ID
  - `media_type` (text) - 'movie' or 'tv'
  - `message` (text) - Personal message with recommendation
  - `status` (text) - 'pending', 'viewed', 'added', 'watched', 'dismissed'
  - `created_at` (timestamptz) - When recommendation was sent
  - `viewed_at` (timestamptz) - When recipient viewed it
  - `actioned_at` (timestamptz) - When recipient took action

  ## Security
  
  RLS policies ensure:
  - Users can send recommendations to any other user
  - Users can view recommendations they sent or received
  - Only the recipient can update the status of their received recommendations
  
  ## Indexes
  
  Performance indexes for:
  - Looking up recommendations by sender
  - Looking up recommendations by recipient
  - Filtering by status
*/

-- Create recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'added', 'watched', 'dismissed')),
  created_at timestamptz DEFAULT now(),
  viewed_at timestamptz,
  actioned_at timestamptz,
  CHECK (from_user_id != to_user_id)
);

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- Users can view recommendations they sent or received
CREATE POLICY "Users can view their sent and received recommendations"
  ON recommendations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = from_user_id 
    OR auth.uid() = to_user_id
  );

-- Users can send recommendations to others
CREATE POLICY "Users can send recommendations"
  ON recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

-- Only recipients can update the status of their recommendations
CREATE POLICY "Recipients can update recommendation status"
  ON recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

-- Users can delete recommendations they sent
CREATE POLICY "Users can delete recommendations they sent"
  ON recommendations FOR DELETE
  TO authenticated
  USING (auth.uid() = from_user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recommendations_from_user_id ON recommendations(from_user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_to_user_id ON recommendations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at DESC);

-- Create a function to automatically update viewed_at when status changes from pending
CREATE OR REPLACE FUNCTION update_recommendation_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set viewed_at when status changes from pending
  IF OLD.status = 'pending' AND NEW.status != 'pending' AND NEW.viewed_at IS NULL THEN
    NEW.viewed_at = now();
  END IF;
  
  -- Set actioned_at when status changes to added, watched, or dismissed
  IF NEW.status IN ('added', 'watched', 'dismissed') AND NEW.actioned_at IS NULL THEN
    NEW.actioned_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for recommendation timestamps
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_recommendation_timestamps_trigger') THEN
    CREATE TRIGGER update_recommendation_timestamps_trigger
      BEFORE UPDATE ON recommendations
      FOR EACH ROW
      EXECUTE FUNCTION update_recommendation_timestamps();
  END IF;
END $$;
