-- Phase 44 — store the full first-release date so we can distinguish
-- "available now" vs "coming soon" vs "announced" for plan_to_watch items.
-- Movies: TMDB release_date. TV: TMDB first_air_date.
-- Mirrors the nullable-date pattern of next_air_date/last_air_date (20260518120000_add_hiatus_tracking.sql).
ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS release_date date;
