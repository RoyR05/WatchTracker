-- Phase 17: Admin curated-list import
-- Mark admin-curated lists (admin's working list + dedup source; no user-facing browse).
ALTER TABLE custom_lists
  ADD COLUMN IF NOT EXISTS is_curated boolean NOT NULL DEFAULT false;

-- Partial index keeps the "is this title in ANY curated list?" lookup small.
CREATE INDEX IF NOT EXISTS idx_custom_lists_is_curated
  ON custom_lists (is_curated) WHERE is_curated = true;

-- Make the dedup join (filter by tmdb_id + media_type) efficient.
CREATE INDEX IF NOT EXISTS idx_list_items_tmdb_media
  ON list_items (tmdb_id, media_type);
