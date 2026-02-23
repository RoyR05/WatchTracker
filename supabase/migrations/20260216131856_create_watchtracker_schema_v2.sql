/*
  # WatchTracker Database Schema
  
  ## Overview
  Creates the complete database schema for the WatchTracker PWA including user profiles, 
  watchlists, TV show progress tracking, custom lists, and social features.

  ## New Tables
  
  ### `profiles`
  User profile information extending auth.users
  - `id` (uuid, primary key) - References auth.users(id)
  - `username` (text, unique) - User's display name
  - `avatar_url` (text) - Profile picture URL
  - `bio` (text) - User biography
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update timestamp
  
  ### `watchlist_items`
  Tracks user's watching status for movies and TV shows
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - References profiles(id)
  - `tmdb_id` (integer) - TMDB media ID
  - `media_type` (text) - 'movie' or 'tv'
  - `status` (text) - 'watching', 'completed', 'plan_to_watch', 'dropped'
  - `rating` (integer) - User rating (1-10)
  - `notes` (text) - Personal notes
  - `started_at` (timestamptz) - When user started watching
  - `completed_at` (timestamptz) - When user completed watching
  - `created_at` (timestamptz) - Entry creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### `tv_show_progress`
  Tracks episode-level progress for TV shows
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - References profiles(id)
  - `tmdb_id` (integer) - TMDB TV show ID
  - `season_number` (integer) - Season number
  - `episode_number` (integer) - Episode number
  - `watched` (boolean) - Whether episode is watched
  - `watched_at` (timestamptz) - When episode was watched
  - `created_at` (timestamptz) - Entry creation timestamp
  
  ### `custom_lists`
  User-created lists for organizing content
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - References profiles(id)
  - `name` (text) - List name
  - `description` (text) - List description
  - `is_public` (boolean) - Whether list is publicly visible
  - `created_at` (timestamptz) - List creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### `list_items`
  Items within custom lists
  - `id` (uuid, primary key) - Unique identifier
  - `list_id` (uuid) - References custom_lists(id)
  - `tmdb_id` (integer) - TMDB media ID
  - `media_type` (text) - 'movie' or 'tv'
  - `notes` (text) - Item-specific notes
  - `position` (integer) - Order in list
  - `added_at` (timestamptz) - When item was added
  
  ### `follows`
  User following relationships
  - `id` (uuid, primary key) - Unique identifier
  - `follower_id` (uuid) - References profiles(id) - User who follows
  - `following_id` (uuid) - References profiles(id) - User being followed
  - `created_at` (timestamptz) - Follow timestamp
  
  ### `list_shares`
  Shared lists for collaborative watching
  - `id` (uuid, primary key) - Unique identifier
  - `list_id` (uuid) - References custom_lists(id)
  - `shared_with_user_id` (uuid) - References profiles(id)
  - `can_edit` (boolean) - Whether user can edit the list
  - `created_at` (timestamptz) - Share timestamp

  ## Security
  
  All tables have Row Level Security (RLS) enabled with restrictive policies ensuring users 
  can only access their own data or explicitly shared/public data.

  ## Indexes
  
  Performance indexes for common queries on foreign keys and lookup fields
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  bio text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create watchlist_items table
CREATE TABLE IF NOT EXISTS watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  status text NOT NULL DEFAULT 'plan_to_watch' CHECK (status IN ('watching', 'completed', 'plan_to_watch', 'dropped')),
  rating integer CHECK (rating >= 1 AND rating <= 10),
  notes text DEFAULT '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tmdb_id, media_type)
);

ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watchlist items"
  ON watchlist_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watchlist items"
  ON watchlist_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlist items"
  ON watchlist_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watchlist items"
  ON watchlist_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create tv_show_progress table
CREATE TABLE IF NOT EXISTS tv_show_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  season_number integer NOT NULL,
  episode_number integer NOT NULL,
  watched boolean DEFAULT false,
  watched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tmdb_id, season_number, episode_number)
);

ALTER TABLE tv_show_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own TV show progress"
  ON tv_show_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own TV show progress"
  ON tv_show_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own TV show progress"
  ON tv_show_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own TV show progress"
  ON tv_show_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create custom_lists table
CREATE TABLE IF NOT EXISTS custom_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_lists ENABLE ROW LEVEL SECURITY;

-- Create list_shares table (needed before custom_lists policies)
CREATE TABLE IF NOT EXISTS list_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES custom_lists(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_edit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(list_id, shared_with_user_id)
);

ALTER TABLE list_shares ENABLE ROW LEVEL SECURITY;

-- Now create custom_lists policies
CREATE POLICY "Users can view their own lists and public lists"
  ON custom_lists FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR is_public = true 
    OR EXISTS (
      SELECT 1 FROM list_shares 
      WHERE list_shares.list_id = custom_lists.id 
      AND list_shares.shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own lists"
  ON custom_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
  ON custom_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists"
  ON custom_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create list_items table
CREATE TABLE IF NOT EXISTS list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES custom_lists(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv')),
  notes text DEFAULT '',
  position integer DEFAULT 0,
  added_at timestamptz DEFAULT now(),
  UNIQUE(list_id, tmdb_id, media_type)
);

ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view list items in accessible lists"
  ON list_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_lists 
      WHERE custom_lists.id = list_items.list_id 
      AND (
        custom_lists.user_id = auth.uid() 
        OR custom_lists.is_public = true 
        OR EXISTS (
          SELECT 1 FROM list_shares 
          WHERE list_shares.list_id = custom_lists.id 
          AND list_shares.shared_with_user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert items in their own lists"
  ON list_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM custom_lists 
      WHERE custom_lists.id = list_items.list_id 
      AND custom_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in editable lists"
  ON list_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_lists 
      WHERE custom_lists.id = list_items.list_id 
      AND (
        custom_lists.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM list_shares 
          WHERE list_shares.list_id = custom_lists.id 
          AND list_shares.shared_with_user_id = auth.uid()
          AND list_shares.can_edit = true
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM custom_lists 
      WHERE custom_lists.id = list_items.list_id 
      AND (
        custom_lists.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM list_shares 
          WHERE list_shares.list_id = custom_lists.id 
          AND list_shares.shared_with_user_id = auth.uid()
          AND list_shares.can_edit = true
        )
      )
    )
  );

CREATE POLICY "Users can delete items in editable lists"
  ON list_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_lists 
      WHERE custom_lists.id = list_items.list_id 
      AND (
        custom_lists.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM list_shares 
          WHERE list_shares.list_id = custom_lists.id 
          AND list_shares.shared_with_user_id = auth.uid()
          AND list_shares.can_edit = true
        )
      )
    )
  );

-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by everyone"
  ON follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can follow others"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others"
  ON follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- Create list_shares policies
CREATE POLICY "Users can view shares for their lists or shares with them"
  ON list_shares FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_lists 
      WHERE custom_lists.id = list_shares.list_id 
      AND custom_lists.user_id = auth.uid()
    )
    OR shared_with_user_id = auth.uid()
  );

CREATE POLICY "List owners can create shares"
  ON list_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM custom_lists 
      WHERE custom_lists.id = list_shares.list_id 
      AND custom_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "List owners can delete shares"
  ON list_shares FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM custom_lists 
      WHERE custom_lists.id = list_shares.list_id 
      AND custom_lists.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_id ON watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_tmdb_id ON watchlist_items(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_status ON watchlist_items(status);

CREATE INDEX IF NOT EXISTS idx_tv_show_progress_user_id ON tv_show_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_tv_show_progress_tmdb_id ON tv_show_progress(tmdb_id);

CREATE INDEX IF NOT EXISTS idx_custom_lists_user_id ON custom_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_lists_is_public ON custom_lists(is_public);

CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_tmdb_id ON list_items(tmdb_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

CREATE INDEX IF NOT EXISTS idx_list_shares_list_id ON list_shares(list_id);
CREATE INDEX IF NOT EXISTS idx_list_shares_shared_with_user_id ON list_shares(shared_with_user_id);

-- Create function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at 
      BEFORE UPDATE ON profiles 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_watchlist_items_updated_at') THEN
    CREATE TRIGGER update_watchlist_items_updated_at 
      BEFORE UPDATE ON watchlist_items 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_custom_lists_updated_at') THEN
    CREATE TRIGGER update_custom_lists_updated_at 
      BEFORE UPDATE ON custom_lists 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
