/*
  # Add Content Metadata to User Preferences

  ## Overview
  Enhances the user_preferences table to store a snapshot of content metadata
  when users express preferences. This enables better learning and recommendation
  generation without needing to re-fetch from TMDB.

  ## Changes
  
  ### Modified Tables
  - `user_preferences` - Add `content_metadata` column
    - Stores JSONB snapshot of content details
    - Includes: title, genres, cast, director, release_year, poster_path
  
  ### Indexes
  - Add GIN index on content_metadata for efficient JSONB queries
  - Add index on preference_type for filtering
  
  ## Security
  - No RLS changes needed (existing policies apply)
  
  ## Notes
  - This metadata snapshot allows affinity learning without TMDB API calls
  - Enables "why recommended" explanations in future features
*/

-- Add content_metadata column to user_preferences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'content_metadata'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN content_metadata jsonb DEFAULT '{}'::jsonb;
    
    -- Add GIN index for efficient JSONB queries
    CREATE INDEX IF NOT EXISTS idx_preferences_content_metadata 
      ON user_preferences USING GIN (content_metadata);
    
    -- Add index on preference_type for filtering
    CREATE INDEX IF NOT EXISTS idx_preferences_type 
      ON user_preferences(profile_id, preference_type);
    
    -- Add index on created_at for recent preferences
    CREATE INDEX IF NOT EXISTS idx_preferences_created 
      ON user_preferences(created_at DESC);
  END IF;
END $$;

-- Add helpful comment on the column
COMMENT ON COLUMN user_preferences.content_metadata IS 
'JSONB snapshot of content details including: title, genres, cast (array of {id, name}), director (array of {id, name}), release_year, poster_path. Stored to enable learning and recommendations without re-fetching from TMDB.';