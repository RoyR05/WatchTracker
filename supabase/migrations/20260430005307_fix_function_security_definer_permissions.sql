/*
  # Fix Function Security: Search Path and Execute Permissions

  ## Overview
  Addresses two classes of security issues across all SECURITY DEFINER functions:

  1. **Mutable search_path** - Sets `search_path = ''` on functions that need it,
     preventing search_path hijacking attacks.

  2. **Overly permissive EXECUTE grants** - Revokes EXECUTE from `anon` and `public`
     on all SECURITY DEFINER functions. Only grants EXECUTE to `authenticated` where
     needed (for RLS-referenced functions and legitimate RPC calls).

  ## Functions Modified

  ### Search path fixed:
  - `check_can_share`
  - `grant_bidirectional_share`
  - `revoke_bidirectional_share`

  ### Execute revoked from anon/public, granted only to authenticated:
  - `check_can_share` (used in RLS policies)
  - `create_notification` (called via RPC by admin)
  - `grant_bidirectional_share` (called via RPC by admin)
  - `revoke_bidirectional_share` (called via RPC by admin)
  - `is_current_user_admin` (used in RLS policies)
  - `is_list_owner` (used in RLS policies)
  - `is_list_shared_with_me` (used in RLS policies)
  - `log_admin_action` (called via RPC by admin)
  - `validate_share_permission` (trigger function)
  - `update_updated_at_column` (trigger function)
  - `update_user_preferences_updated_at` (trigger function)
  - `update_user_settings_updated_at` (trigger function)
  - `update_binge_session_on_watch` (trigger function)
  - `update_recommendation_timestamps` (trigger function)
  - `get_or_create_binge_session` (both overloads)

  ### Functions dropped (orphaned):
  - `create_primary_profile_for_user()` (zero-arg overload left from removed profile system)

  ## Security Notes
  - Trigger functions still work because triggers run as the table owner, not the calling role
  - RLS policy functions need EXECUTE for `authenticated` since policies evaluate in the caller's context
  - No `anon` role should ever call these functions directly
*/

-- Drop orphaned function (the two-arg version was already dropped; this catches any remaining overload)
DROP FUNCTION IF EXISTS public.create_primary_profile_for_user();

-- =====================================================
-- Fix search_path on the three functions flagged
-- =====================================================

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.revoke_bidirectional_share(user_a uuid, user_b uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM public.global_share_permissions
  WHERE user_id = user_a AND can_share_with_user_id = user_b;

  DELETE FROM public.global_share_permissions
  WHERE user_id = user_b AND can_share_with_user_id = user_a;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =====================================================
-- Revoke EXECUTE from anon and public on all SECURITY DEFINER functions
-- Then grant only to authenticated where needed
-- =====================================================

-- check_can_share
REVOKE EXECUTE ON FUNCTION public.check_can_share(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_can_share(uuid, uuid) TO authenticated;

-- create_notification
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb) TO authenticated;

-- grant_bidirectional_share
REVOKE EXECUTE ON FUNCTION public.grant_bidirectional_share(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.grant_bidirectional_share(uuid, uuid) TO authenticated;

-- revoke_bidirectional_share
REVOKE EXECUTE ON FUNCTION public.revoke_bidirectional_share(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.revoke_bidirectional_share(uuid, uuid) TO authenticated;

-- is_current_user_admin
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- log_admin_action
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, uuid, text, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, uuid, text, jsonb) TO authenticated;

-- validate_share_permission (trigger function - still needs authenticated for trigger context)
REVOKE EXECUTE ON FUNCTION public.validate_share_permission() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.validate_share_permission() TO authenticated;

-- update_updated_at_column (trigger function)
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;

-- update_user_preferences_updated_at (trigger function)
REVOKE EXECUTE ON FUNCTION public.update_user_preferences_updated_at() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_user_preferences_updated_at() TO authenticated;

-- update_user_settings_updated_at (trigger function)
REVOKE EXECUTE ON FUNCTION public.update_user_settings_updated_at() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_user_settings_updated_at() TO authenticated;

-- update_binge_session_on_watch (trigger function)
REVOKE EXECUTE ON FUNCTION public.update_binge_session_on_watch() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_binge_session_on_watch() TO authenticated;

-- update_recommendation_timestamps (trigger function)
REVOKE EXECUTE ON FUNCTION public.update_recommendation_timestamps() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_recommendation_timestamps() TO authenticated;

-- get_or_create_binge_session (two overloads)
REVOKE EXECUTE ON FUNCTION public.get_or_create_binge_session(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_or_create_binge_session(uuid, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_or_create_binge_session(uuid, integer, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_or_create_binge_session(uuid, integer, text, text) TO authenticated;

-- is_list_owner
REVOKE EXECUTE ON FUNCTION public.is_list_owner(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_list_owner(uuid) TO authenticated;

-- is_list_shared_with_me
REVOKE EXECUTE ON FUNCTION public.is_list_shared_with_me(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_list_shared_with_me(uuid) TO authenticated;
