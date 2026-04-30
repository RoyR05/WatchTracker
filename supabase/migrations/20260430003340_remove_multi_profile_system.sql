/*
  # Remove Multi-Profile System

  ## Overview
  Removes the Netflix-style multi-profile system since each account represents
  a single person. This simplifies the data model significantly.

  ## Dropped Tables
  - `profile_affinity` - Per-profile content affinity scores
  - `user_interactions` - Per-profile interaction tracking
  - `user_profiles` - Multiple profiles per account

  ## Modified Tables
  - `watchlist_items` - Remove `profile_id` column (data stays via `user_id`)
  - `tv_show_progress` - Remove `profile_id` column (data stays via `user_id`)
  - `plex_requests` - Remove `profile_id` column (data stays via `user_id`)
  - `user_preferences` - Remove `profile_id` column, update RLS to use `user_id`

  ## Dropped Functions
  - `create_primary_profile_for_user()` - No longer needed
  - `create_primary_profile_on_signup()` - No longer needed

  ## Dropped Triggers
  - `on_profile_created` on profiles table

  ## Notes
  - No data loss: all watchlist items and progress records remain
    accessible via their `user_id` column which was always the primary key
  - The `profile_id` columns were nullable and redundant with `user_id`
*/

-- Drop the trigger first (depends on the function)
DROP TRIGGER IF EXISTS on_profile_created ON profiles;

-- Drop functions
DROP FUNCTION IF EXISTS create_primary_profile_for_user(uuid, text);
DROP FUNCTION IF EXISTS create_primary_profile_on_signup();

-- Remove profile_id column from plex_requests
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plex_requests' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE plex_requests DROP COLUMN profile_id;
  END IF;
END $$;

-- Remove profile_id column from watchlist_items
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'watchlist_items' AND column_name = 'profile_id'
  ) THEN
    DROP INDEX IF EXISTS idx_watchlist_profile;
    ALTER TABLE watchlist_items DROP COLUMN profile_id;
  END IF;
END $$;

-- Remove profile_id column from tv_show_progress
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tv_show_progress' AND column_name = 'profile_id'
  ) THEN
    DROP INDEX IF EXISTS idx_tv_progress_profile;
    ALTER TABLE tv_show_progress DROP COLUMN profile_id;
  END IF;
END $$;

-- Fix user_preferences: drop profile-based policies and column, recreate user-based policies
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;

-- Drop the profile-based unique index and lookup index
DROP INDEX IF EXISTS idx_user_preferences_unique;
DROP INDEX IF EXISTS idx_user_preferences_lookup;
DROP INDEX IF EXISTS idx_user_preferences_profile_type;

-- Remove profile_id column from user_preferences
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE user_preferences DROP COLUMN profile_id;
  END IF;
END $$;

-- Recreate unique index using user_id only
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_unique
  ON user_preferences(user_id, tmdb_id, media_type, preference_type, COALESCE(tag_value, ''));

-- Recreate lookup index
CREATE INDEX IF NOT EXISTS idx_user_preferences_lookup
  ON user_preferences(user_id, tmdb_id, media_type);

-- Recreate RLS policies based on user_id
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Now drop the profile tables (dependencies are cleared)
DROP TABLE IF EXISTS profile_affinity;
DROP TABLE IF EXISTS user_interactions;
DROP TABLE IF EXISTS user_profiles;
