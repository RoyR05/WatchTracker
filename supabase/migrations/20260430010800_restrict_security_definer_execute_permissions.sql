/*
  # Restrict SECURITY DEFINER Function Execute Permissions

  ## Overview
  Revokes direct EXECUTE permission from the `authenticated` role on functions
  that should not be callable via PostgREST `/rest/v1/rpc/` by regular users.

  ## Strategy by function category:

  ### Trigger functions (revoke EXECUTE entirely - triggers run as table owner)
  - `update_updated_at_column()`
  - `update_user_preferences_updated_at()`
  - `update_user_settings_updated_at()`
  - `update_binge_session_on_watch()`
  - `update_recommendation_timestamps()`
  - `validate_share_permission()`

  ### Admin-only RPC functions (add internal admin guard, keep EXECUTE for authenticated)
  - `create_notification` - now checks caller is admin
  - `log_admin_action` - now checks caller is admin
  - `grant_bidirectional_share` - now checks caller is admin
  - `revoke_bidirectional_share` - now checks caller is admin

  ### User RPC functions (add ownership guard)
  - `get_or_create_binge_session` (both overloads) - now checks caller owns the session

  ### RLS helper functions (switch to SECURITY INVOKER - safe to expose)
  - `is_current_user_admin()` - read-only, returns bool
  - `check_can_share()` - read-only, returns bool
  - `is_list_owner()` - read-only, returns bool
  - `is_list_shared_with_me()` - read-only, returns bool

  ## Security Notes
  - Trigger functions do not need EXECUTE from any role; they fire as the trigger owner
  - Admin RPCs now raise an exception if a non-admin calls them
  - RLS helpers switched to INVOKER so they can't escalate privileges
*/

-- =====================================================
-- 1. TRIGGER FUNCTIONS: Revoke EXECUTE from authenticated
-- =====================================================

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_preferences_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_settings_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_binge_session_on_watch() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_recommendation_timestamps() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_share_permission() FROM authenticated;

-- =====================================================
-- 2. ADMIN-ONLY RPC FUNCTIONS: Add admin guard inside function body
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_config WHERE admin_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only admin can create notifications';
  END IF;

  INSERT INTO public.notifications (user_id, notification_type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type text,
  p_target_user_id uuid DEFAULT NULL,
  p_details text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_config WHERE admin_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only admin can log actions';
  END IF;

  INSERT INTO public.admin_audit_log (admin_user_id, action_type, target_user_id, details, metadata)
  VALUES (auth.uid(), p_action_type, p_target_user_id, p_details, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.grant_bidirectional_share(user_a uuid, user_b uuid)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_config WHERE admin_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only admin can manage share permissions';
  END IF;

  INSERT INTO public.global_share_permissions (user_id, can_share_with_user_id, is_allowed)
  VALUES (user_a, user_b, true)
  ON CONFLICT (user_id, can_share_with_user_id)
  DO UPDATE SET is_allowed = true, updated_at = now();

  INSERT INTO public.global_share_permissions (user_id, can_share_with_user_id, is_allowed)
  VALUES (user_b, user_a, true)
  ON CONFLICT (user_id, can_share_with_user_id)
  DO UPDATE SET is_allowed = true, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.revoke_bidirectional_share(user_a uuid, user_b uuid)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_config WHERE admin_user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only admin can manage share permissions';
  END IF;

  DELETE FROM public.global_share_permissions
  WHERE user_id = user_a AND can_share_with_user_id = user_b;

  DELETE FROM public.global_share_permissions
  WHERE user_id = user_b AND can_share_with_user_id = user_a;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- 3. USER RPC FUNCTIONS: Add ownership guard
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_or_create_binge_session(p_user_id uuid, p_tmdb_id integer)
RETURNS uuid AS $$
DECLARE
  v_session_id uuid;
  v_last_watched timestamptz;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create binge sessions for other users';
  END IF;

  SELECT id, started_at INTO v_session_id, v_last_watched
  FROM public.binge_sessions
  WHERE user_id = p_user_id
  AND tmdb_id = p_tmdb_id
  AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_session_id IS NULL OR (NOW() - v_last_watched) > INTERVAL '2 hours' THEN
    IF v_session_id IS NOT NULL THEN
      UPDATE public.binge_sessions
      SET ended_at = NOW()
      WHERE id = v_session_id;
    END IF;

    INSERT INTO public.binge_sessions (user_id, tmdb_id, started_at)
    VALUES (p_user_id, p_tmdb_id, NOW())
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_or_create_binge_session(
  p_user_id uuid,
  p_tmdb_id integer,
  p_media_type text,
  p_title text
)
RETURNS uuid AS $$
DECLARE
  v_session_id uuid;
  v_cutoff_time timestamptz;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create binge sessions for other users';
  END IF;

  v_cutoff_time := NOW() - INTERVAL '6 hours';

  SELECT id INTO v_session_id
  FROM public.binge_sessions
  WHERE user_id = p_user_id
  AND tmdb_id = p_tmdb_id
  AND media_type = p_media_type
  AND (ended_at IS NULL OR ended_at > v_cutoff_time)
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    INSERT INTO public.binge_sessions (user_id, tmdb_id, media_type, title, started_at)
    VALUES (p_user_id, p_tmdb_id, p_media_type, p_title, NOW())
    RETURNING id INTO v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- 4. RLS HELPER FUNCTIONS: Switch to SECURITY INVOKER
--    These are safe to expose since they only read data
--    and use auth.uid() which works in invoker context
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE admin_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

CREATE OR REPLACE FUNCTION public.check_can_share(owner_id uuid, recipient_id uuid)
RETURNS boolean AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_config WHERE admin_user_id = owner_id) THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = owner_id AND can_broadcast = true) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.global_share_permissions
    WHERE user_id = owner_id
      AND can_share_with_user_id = recipient_id
      AND is_allowed = true
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

CREATE OR REPLACE FUNCTION public.is_list_owner(p_list_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.custom_lists
    WHERE id = p_list_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

CREATE OR REPLACE FUNCTION public.is_list_shared_with_me(p_list_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.list_shares
    WHERE list_id = p_list_id
    AND shared_with_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';
