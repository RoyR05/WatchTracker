-- watchlist_items: cache air date schedule from TMDB
ALTER TABLE watchlist_items
  ADD COLUMN IF NOT EXISTS next_air_date date,
  ADD COLUMN IF NOT EXISTS last_air_date date,
  ADD COLUMN IF NOT EXISTS show_status text;

-- user_settings: hiatus threshold preferences
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS hiatus_hide_weeks integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS hiatus_show_days  integer NOT NULL DEFAULT 14;
