/*
  # Add metadata columns to watchlist_items

  1. Modified Tables
    - `watchlist_items`
      - Added `title` (text, nullable) - cached title of the media item
      - Added `poster_path` (text, nullable) - cached TMDB poster path
      - Added `media_year` (integer, nullable) - release/first air year

  2. Notes
    - These columns cache basic display data to reduce TMDB API calls
    - All nullable to maintain backward compatibility with existing rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'watchlist_items' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.watchlist_items ADD COLUMN title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'watchlist_items' AND column_name = 'poster_path'
  ) THEN
    ALTER TABLE public.watchlist_items ADD COLUMN poster_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'watchlist_items' AND column_name = 'media_year'
  ) THEN
    ALTER TABLE public.watchlist_items ADD COLUMN media_year integer;
  END IF;
END $$;
