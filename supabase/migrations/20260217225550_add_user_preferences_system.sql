/*
  # User Preferences System

  ## Overview
  This migration adds a comprehensive user preferences system for tracking likes, dislikes,
  and content tagging across movies and TV shows. This enables personalized recommendations
  and content filtering.

  ## New Tables
  
  ### `user_preferences`
  Stores individual user preference actions (likes, dislikes, tags)
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, not null) - References auth.users
  - `profile_id` (uuid, nullable) - References profiles for multi-profile support
  - `tmdb_id` (integer, not null) - TMDB content ID
  - `media_type` (text, not null) - Either 'movie' or 'tv'
  - `preference_type` (text, not null) - Type: 'like', 'dislike', or 'tag'
  - `tag_value` (text, nullable) - Tag name when preference_type is 'tag'
  - `created_at` (timestamptz) - When preference was created
  - `updated_at` (timestamptz) - When preference was last modified

  ## Indexes
  - Composite index on (user_id, profile_id, tmdb_id, media_type) for fast lookups
  - Index on (user_id, preference_type) for filtering by preference type
  - Index on (profile_id, preference_type) for profile-specific queries
  - Index on tag_value for tag-based searches

  ## Security
  - Enable RLS on user_preferences table
  - Users can only view their own preferences
  - Users can only insert their own preferences
  - Users can only update their own preferences
  - Users can only delete their own preferences

  ## Constraints
  - Unique constraint on (user_id, profile_id, tmdb_id, media_type, preference_type, tag_value)
    to prevent duplicate preferences
  - Check constraint to ensure media_type is either 'movie' or 'tv'
  - Check constraint to ensure preference_type is 'like', 'dislike', or 'tag'
  - Check constraint to ensure tag_value is only set when preference_type is 'tag'
*/

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL,
  preference_type text NOT NULL,
  tag_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints
ALTER TABLE user_preferences
  ADD CONSTRAINT check_media_type CHECK (media_type IN ('movie', 'tv'));

ALTER TABLE user_preferences
  ADD CONSTRAINT check_preference_type CHECK (preference_type IN ('like', 'dislike', 'tag'));

ALTER TABLE user_preferences
  ADD CONSTRAINT check_tag_value CHECK (
    (preference_type = 'tag' AND tag_value IS NOT NULL) OR
    (preference_type != 'tag' AND tag_value IS NULL)
  );

-- Create unique constraint to prevent duplicate preferences
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_unique
  ON user_preferences(user_id, COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid), tmdb_id, media_type, preference_type, COALESCE(tag_value, ''));

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_lookup
  ON user_preferences(user_id, profile_id, tmdb_id, media_type);

CREATE INDEX IF NOT EXISTS idx_user_preferences_type
  ON user_preferences(user_id, preference_type);

CREATE INDEX IF NOT EXISTS idx_user_preferences_profile_type
  ON user_preferences(profile_id, preference_type);

CREATE INDEX IF NOT EXISTS idx_user_preferences_tags
  ON user_preferences(tag_value)
  WHERE preference_type = 'tag';

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
  ON user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON user_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own preferences"
  ON user_preferences
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS user_preferences_updated_at ON user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();