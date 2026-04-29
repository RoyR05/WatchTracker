/*
  # Add Plex discovery cache columns

  1. Modified Tables
    - `plex_server_config`
      - `discovered_servers` (jsonb) - cached server URIs and names from plex.tv
      - `discovered_at` (timestamptz) - when discovery was last performed
      - `auto_movie_section_id` (text) - auto-detected movie library section
      - `auto_tv_section_id` (text) - auto-detected TV library section

  2. Purpose
    - Cache plex.tv discovery results to avoid repeated API calls
    - Store auto-detected library sections for faster, more accurate searches
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plex_server_config' AND column_name = 'discovered_servers'
  ) THEN
    ALTER TABLE plex_server_config ADD COLUMN discovered_servers jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plex_server_config' AND column_name = 'discovered_at'
  ) THEN
    ALTER TABLE plex_server_config ADD COLUMN discovered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plex_server_config' AND column_name = 'auto_movie_section_id'
  ) THEN
    ALTER TABLE plex_server_config ADD COLUMN auto_movie_section_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plex_server_config' AND column_name = 'auto_tv_section_id'
  ) THEN
    ALTER TABLE plex_server_config ADD COLUMN auto_tv_section_id text;
  END IF;
END $$;
