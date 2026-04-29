/*
  # Fix function security issues

  1. Search Path Mutable
    - Set immutable search_path on `get_or_create_binge_session` (both overloads)
    - Set immutable search_path on `create_primary_profile_for_user` (both overloads)
    - Set immutable search_path on all other public functions for consistency

  2. Revoke EXECUTE from `anon` on ALL public functions
    - Anonymous users should never call these functions directly

  3. Revoke EXECUTE from `authenticated` on trigger-only functions
    - Trigger functions are invoked by the database engine, not by users
    - Affected: create_primary_profile_for_user(), create_primary_profile_on_signup(),
      update_binge_session_on_watch(), update_recommendation_timestamps(),
      update_updated_at_column(), update_user_preferences_updated_at(),
      update_user_settings_updated_at(), validate_share_permission()

  4. Keep EXECUTE for `authenticated` on RPC functions that the app calls
    - check_can_share, create_notification, create_primary_profile_for_user(uuid,text),
      get_or_create_binge_session (both), is_current_user_admin, is_list_owner,
      is_list_shared_with_me, log_admin_action
*/

-- =============================================================================
-- 1. Fix search_path on all functions to make them immutable
-- =============================================================================

ALTER FUNCTION public.get_or_create_binge_session(p_user_id uuid, p_tmdb_id integer)
  SET search_path = '';

ALTER FUNCTION public.get_or_create_binge_session(p_user_id uuid, p_tmdb_id integer, p_media_type text, p_title text)
  SET search_path = '';

ALTER FUNCTION public.create_primary_profile_for_user()
  SET search_path = '';

ALTER FUNCTION public.create_primary_profile_for_user(p_user_id uuid, p_user_email text)
  SET search_path = '';

ALTER FUNCTION public.create_primary_profile_on_signup()
  SET search_path = '';

ALTER FUNCTION public.check_can_share(owner_id uuid, recipient_id uuid)
  SET search_path = '';

ALTER FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_metadata jsonb)
  SET search_path = '';

ALTER FUNCTION public.is_current_user_admin()
  SET search_path = '';

ALTER FUNCTION public.is_list_owner(p_list_id uuid)
  SET search_path = '';

ALTER FUNCTION public.is_list_shared_with_me(p_list_id uuid)
  SET search_path = '';

ALTER FUNCTION public.log_admin_action(p_action_type text, p_target_user_id uuid, p_details text, p_metadata jsonb)
  SET search_path = '';

ALTER FUNCTION public.update_binge_session_on_watch()
  SET search_path = '';

ALTER FUNCTION public.update_recommendation_timestamps()
  SET search_path = '';

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = '';

ALTER FUNCTION public.update_user_preferences_updated_at()
  SET search_path = '';

ALTER FUNCTION public.update_user_settings_updated_at()
  SET search_path = '';

ALTER FUNCTION public.validate_share_permission()
  SET search_path = '';

-- =============================================================================
-- 2. Revoke EXECUTE from anon on ALL public functions
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.check_can_share(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_primary_profile_for_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_primary_profile_for_user(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_primary_profile_on_signup() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_binge_session(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_binge_session(uuid, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_list_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_list_shared_with_me(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_binge_session_on_watch() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_recommendation_timestamps() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_user_preferences_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_user_settings_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_share_permission() FROM anon;

-- =============================================================================
-- 3. Revoke EXECUTE from authenticated on trigger-only functions
--    (these are invoked by the DB engine via triggers, not by users)
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.create_primary_profile_for_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_primary_profile_on_signup() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_binge_session_on_watch() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_recommendation_timestamps() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_preferences_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_settings_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_share_permission() FROM authenticated;
