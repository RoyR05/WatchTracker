/*
  # Switch Remaining SECURITY DEFINER Functions to SECURITY INVOKER

  ## Overview
  Converts the last 6 SECURITY DEFINER functions to SECURITY INVOKER so they
  cannot be used to escalate privileges via PostgREST RPC endpoints.

  All underlying tables already have proper RLS policies that enforce:
  - Admin-only INSERT on notifications and global_share_permissions
  - Admin-only INSERT on admin_audit_log
  - Owner-only INSERT/UPDATE on binge_sessions

  Since RLS is properly configured, these functions no longer need DEFINER
  to bypass it -- the calling user's permissions are sufficient.

  ## Functions Changed
  - `create_notification` -> SECURITY INVOKER (admin RLS on notifications table)
  - `log_admin_action` -> SECURITY INVOKER (admin RLS on admin_audit_log table)
  - `grant_bidirectional_share` -> SECURITY INVOKER (admin RLS on global_share_permissions)
  - `revoke_bidirectional_share` -> SECURITY INVOKER (admin RLS on global_share_permissions)
  - `get_or_create_binge_session(uuid, int)` -> SECURITY INVOKER (owner RLS on binge_sessions)
  - `get_or_create_binge_session(uuid, int, text, text)` -> SECURITY INVOKER (owner RLS on binge_sessions)
*/

-- =====================================================
-- Admin RPC functions: Switch to SECURITY INVOKER
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
  INSERT INTO public.notifications (user_id, notification_type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type text,
  p_target_user_id uuid DEFAULT NULL,
  p_details text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.admin_audit_log (admin_user_id, action_type, target_user_id, details, metadata)
  VALUES (auth.uid(), p_action_type, p_target_user_id, p_details, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

CREATE OR REPLACE FUNCTION public.grant_bidirectional_share(user_a uuid, user_b uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.global_share_permissions (user_id, can_share_with_user_id, is_allowed)
  VALUES (user_a, user_b, true)
  ON CONFLICT (user_id, can_share_with_user_id)
  DO UPDATE SET is_allowed = true, updated_at = now();

  INSERT INTO public.global_share_permissions (user_id, can_share_with_user_id, is_allowed)
  VALUES (user_b, user_a, true)
  ON CONFLICT (user_id, can_share_with_user_id)
  DO UPDATE SET is_allowed = true, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

CREATE OR REPLACE FUNCTION public.revoke_bidirectional_share(user_a uuid, user_b uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM public.global_share_permissions
  WHERE user_id = user_a AND can_share_with_user_id = user_b;

  DELETE FROM public.global_share_permissions
  WHERE user_id = user_b AND can_share_with_user_id = user_a;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- =====================================================
-- User RPC functions: Switch to SECURITY INVOKER
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
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

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
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';
