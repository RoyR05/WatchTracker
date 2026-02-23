/*
  # Add Simplified Profile System

  ## Overview
  Adds support for multiple adult profiles per account (3-4 profiles max).
  Each profile maintains separate watchlists, progress tracking, and preferences.
  No parental controls or content restrictions - simplified for adult users.

  ## New Tables

  ### `user_profiles`
  - `id` (uuid, primary key) - Unique profile identifier
  - `account_id` (uuid, foreign key to profiles) - Links to main user account
  - `profile_name` (text) - Display name for the profile (e.g., "Sarah", "Tom")
  - `avatar_color` (text) - Hex color code for profile avatar (#3B82F6, etc.)
  - `is_primary` (boolean) - Indicates the default/main profile
  - `created_at` (timestamptz) - Profile creation timestamp
  - Unique constraint on (account_id, profile_name)

  ### `user_interactions`
  - `id` (uuid, primary key)
  - `profile_id` (uuid, foreign key to user_profiles)
  - `tmdb_id` (integer) - TMDB content ID
  - `media_type` (text) - 'movie' or 'tv'
  - `interaction_type` (text) - Type of interaction (viewed_detail, rated, etc.)
  - `metadata` (jsonb) - Additional context (e.g., rating value, search query)
  - `created_at` (timestamptz) - Interaction timestamp

  ### `profile_affinity`
  - `id` (uuid, primary key)
  - `profile_id` (uuid, foreign key to user_profiles)
  - `affinity_type` (text) - Type of affinity (genre, actor, director, decade)
  - `affinity_value` (text) - Specific value (e.g., "Action", "Tom Hanks", "1990s")
  - `score` (decimal) - Affinity strength (0-100)
  - `last_updated_at` (timestamptz) - Last calculation time
  - Unique constraint on (profile_id, affinity_type, affinity_value)

  ## Modified Tables
  - `watchlist_items` - Add `profile_id` column
  - `tv_show_progress` - Add `profile_id` column

  ## Security
  - Enable RLS on all new tables
  - Users can only access their own profiles and related data
  - Profile data is isolated between different profiles

  ## Data Migration
  - Existing users get a primary profile created automatically
  - All existing watchlist and progress data linked to primary profile
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  profile_name text NOT NULL,
  avatar_color text DEFAULT '#3B82F6',
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_profile_name_per_account UNIQUE(account_id, profile_name),
  CONSTRAINT profile_name_length CHECK (char_length(profile_name) >= 1 AND char_length(profile_name) <= 30)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_account ON user_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_primary ON user_profiles(account_id, is_primary) WHERE is_primary = true;

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

CREATE POLICY "Users can create own profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = auth.uid() 
    AND (SELECT COUNT(*) FROM user_profiles WHERE account_id = auth.uid()) < 4
  );

CREATE POLICY "Users can update own profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

CREATE POLICY "Users can delete own profiles"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (account_id = auth.uid() AND is_primary = false);

-- Create user_interactions table
CREATE TABLE IF NOT EXISTS user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  tmdb_id integer NOT NULL,
  media_type text CHECK (media_type IN ('movie', 'tv')) NOT NULL,
  interaction_type text CHECK (interaction_type IN (
    'viewed_detail',
    'added_to_watchlist',
    'rated',
    'completed',
    'searched_for',
    'clicked_similar'
  )) NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interactions_profile ON user_interactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON user_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_tmdb ON user_interactions(tmdb_id, media_type);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON user_interactions(profile_id, interaction_type);

-- Enable RLS on user_interactions
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_interactions
CREATE POLICY "Users can view own interactions"
  ON user_interactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = user_interactions.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own interactions"
  ON user_interactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = user_interactions.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );

-- Create profile_affinity table
CREATE TABLE IF NOT EXISTS profile_affinity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  affinity_type text CHECK (affinity_type IN ('genre', 'actor', 'director', 'decade')) NOT NULL,
  affinity_value text NOT NULL,
  score decimal(5,2) DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  last_updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_affinity UNIQUE(profile_id, affinity_type, affinity_value)
);

CREATE INDEX IF NOT EXISTS idx_affinity_profile_type ON profile_affinity(profile_id, affinity_type);
CREATE INDEX IF NOT EXISTS idx_affinity_score ON profile_affinity(profile_id, score DESC);

-- Enable RLS on profile_affinity
ALTER TABLE profile_affinity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profile_affinity
CREATE POLICY "Users can view own affinity"
  ON profile_affinity FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = profile_affinity.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own affinity"
  ON profile_affinity FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = profile_affinity.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = profile_affinity.profile_id
      AND user_profiles.account_id = auth.uid()
    )
  );

-- Add profile_id to watchlist_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'watchlist_items' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE watchlist_items ADD COLUMN profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE;
    CREATE INDEX idx_watchlist_profile ON watchlist_items(profile_id);
  END IF;
END $$;

-- Add profile_id to tv_show_progress
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tv_show_progress' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE tv_show_progress ADD COLUMN profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE;
    CREATE INDEX idx_tv_progress_profile ON tv_show_progress(profile_id);
  END IF;
END $$;

-- Function to create primary profile for existing users and migrate data
CREATE OR REPLACE FUNCTION create_primary_profile_for_user(p_user_id uuid, p_user_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_profile_id uuid;
  profile_name text;
BEGIN
  -- Extract username from email (before @)
  profile_name := split_part(p_user_email, '@', 1);
  
  -- Capitalize first letter
  profile_name := initcap(profile_name);
  
  -- Create primary profile
  INSERT INTO user_profiles (account_id, profile_name, avatar_color, is_primary)
  VALUES (p_user_id, profile_name, '#3B82F6', true)
  RETURNING id INTO new_profile_id;
  
  -- Link existing watchlist items to primary profile
  UPDATE watchlist_items
  SET profile_id = new_profile_id
  WHERE watchlist_items.user_id = p_user_id AND watchlist_items.profile_id IS NULL;
  
  -- Link existing tv show progress to primary profile
  UPDATE tv_show_progress
  SET profile_id = new_profile_id
  WHERE tv_show_progress.user_id = p_user_id AND tv_show_progress.profile_id IS NULL;
  
  RETURN new_profile_id;
END;
$$;

-- Trigger to auto-create primary profile for new users
CREATE OR REPLACE FUNCTION create_primary_profile_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_profile_id uuid;
  user_email text;
  profile_name text;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;
  
  -- Extract username from email
  profile_name := split_part(user_email, '@', 1);
  profile_name := initcap(profile_name);
  
  -- Create primary profile
  INSERT INTO user_profiles (account_id, profile_name, avatar_color, is_primary)
  VALUES (NEW.id, profile_name, '#3B82F6', true);
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table (runs after user signs up)
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_primary_profile_on_signup();

-- Migrate existing users (create primary profiles for users who don't have one)
DO $$
DECLARE
  user_record RECORD;
  user_email text;
BEGIN
  FOR user_record IN 
    SELECT p.id 
    FROM profiles p
    LEFT JOIN user_profiles up ON up.account_id = p.id AND up.is_primary = true
    WHERE up.id IS NULL
  LOOP
    -- Get user email
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_record.id;
    
    -- Create primary profile and migrate data
    PERFORM create_primary_profile_for_user(user_record.id, COALESCE(user_email, 'user'));
  END LOOP;
END $$;