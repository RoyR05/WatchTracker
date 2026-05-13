-- ============================================================
-- Phase 6: Social & Plex UX improvements
-- ============================================================

-- 6.1: Prevent duplicate open Plex requests (any user) for same title
-- Fixes the latent .maybeSingle() crash when two users request the same title
CREATE UNIQUE INDEX IF NOT EXISTS plex_requests_open_unique
  ON plex_requests (tmdb_id, media_type)
  WHERE status IN ('pending', 'approved');

-- 6.3: Return only mutual-share friends for the recommend modal
-- Both directions of global_share_permissions must be is_allowed = true
CREATE OR REPLACE FUNCTION get_mutual_share_friends()
RETURNS TABLE(id uuid, username text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.avatar_url
  FROM profiles p
  WHERE EXISTS (
    SELECT 1 FROM global_share_permissions g1
    WHERE g1.user_id = auth.uid()
      AND g1.can_share_with_user_id = p.id
      AND g1.is_allowed = true
  )
  AND EXISTS (
    SELECT 1 FROM global_share_permissions g2
    WHERE g2.user_id = p.id
      AND g2.can_share_with_user_id = auth.uid()
      AND g2.is_allowed = true
  )
  ORDER BY p.username;
$$;

REVOKE ALL ON FUNCTION get_mutual_share_friends() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_mutual_share_friends() TO authenticated;

-- 6.4: Return watchlist status for mutual-share friends who have this title
-- Only returns data for bidirectionally-connected users (respects permission model)
CREATE OR REPLACE FUNCTION get_friends_watchlist_status(p_tmdb_id INTEGER, p_media_type TEXT)
RETURNS TABLE(user_id uuid, status text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wi.user_id, wi.status
  FROM watchlist_items wi
  WHERE wi.tmdb_id = p_tmdb_id
    AND wi.media_type = p_media_type
    AND EXISTS (
      SELECT 1 FROM global_share_permissions g1
      WHERE g1.user_id = auth.uid()
        AND g1.can_share_with_user_id = wi.user_id
        AND g1.is_allowed = true
    )
    AND EXISTS (
      SELECT 1 FROM global_share_permissions g2
      WHERE g2.user_id = wi.user_id
        AND g2.can_share_with_user_id = auth.uid()
        AND g2.is_allowed = true
    );
$$;

REVOKE ALL ON FUNCTION get_friends_watchlist_status(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_friends_watchlist_status(INTEGER, TEXT) TO authenticated;

-- 6.5: Prevent duplicate active recommendations (same sender → recipient → title)
-- Dismissed and watched recs are excluded so re-recommending is allowed after those outcomes
CREATE UNIQUE INDEX IF NOT EXISTS recommendations_active_unique
  ON recommendations (from_user_id, to_user_id, tmdb_id, media_type)
  WHERE status NOT IN ('dismissed', 'watched');

-- 6.7: Notify recipient when a new recommendation is sent
-- Inserts into the existing notifications table (no schema change needed)
CREATE OR REPLACE FUNCTION notify_on_recommendation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_username text;
BEGIN
  SELECT username INTO v_sender_username
  FROM profiles
  WHERE id = NEW.from_user_id;

  INSERT INTO notifications (user_id, notification_type, title, message, metadata)
  VALUES (
    NEW.to_user_id,
    'recommendation',
    v_sender_username || ' recommended something to you',
    COALESCE(NULLIF(NEW.message, ''), 'Check it out on the Recommendations page.'),
    jsonb_build_object(
      'from_user_id', NEW.from_user_id,
      'from_username', v_sender_username,
      'tmdb_id', NEW.tmdb_id,
      'media_type', NEW.media_type,
      'recommendation_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION notify_on_recommendation() FROM PUBLIC;

DROP TRIGGER IF EXISTS recommendation_notify_trigger ON recommendations;
CREATE TRIGGER recommendation_notify_trigger
  AFTER INSERT ON recommendations
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_recommendation();
