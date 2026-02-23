/*
  # User Settings Table

  ## Overview
  This migration adds a user_settings table for storing UI preferences and application
  settings per user. This includes preferences like language filters for discovery content.

  ## New Tables
  
  ### `user_settings`
  Stores user-level application settings and preferences
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, unique, not null) - References auth.users (one settings row per user)
  - `english_only_filter` (boolean, default false) - Filter discovery content to English only
  - `created_at` (timestamptz) - When settings were created
  - `updated_at` (timestamptz) - When settings were last modified

  ## Indexes
  - Unique index on user_id for fast lookups and to enforce one row per user

  ## Security
  - Enable RLS on user_settings table
  - Users can only view their own settings
  - Users can only insert their own settings
  - Users can only update their own settings
  - Users can only delete their own settings
*/

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  english_only_filter boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on user_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user_id
  ON user_settings(user_id);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own settings
CREATE POLICY "Users can view own settings"
  ON user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings"
  ON user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own settings"
  ON user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own settings
CREATE POLICY "Users can delete own settings"
  ON user_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings;
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();