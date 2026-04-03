/*
  # Fix RLS Performance and Security Issues

  This migration addresses critical security and performance issues:

  1. **RLS Performance Optimization**
     - Optimizes 50+ RLS policies by wrapping auth function calls in SELECT
     - Prevents re-evaluation of auth functions for each row
     - Improves query performance at scale

  2. **Index Cleanup**
     - Removes 48 unused indexes
     - Drops 2 duplicate indexes
     - Improves write performance and reduces storage

  3. **Function Security**
     - Fixes mutable search_path vulnerabilities in 15 functions
     - Sets explicit search_path for all functions
     - Prevents SQL injection via search_path manipulation
*/

-- ============================================================================
-- PART 1: OPTIMIZE RLS POLICIES
-- ============================================================================

-- profiles table
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- watchlist_items table
DROP POLICY IF EXISTS "Users can view their own watchlist items" ON public.watchlist_items;
CREATE POLICY "Users can view their own watchlist items"
  ON public.watchlist_items FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own watchlist items" ON public.watchlist_items;
CREATE POLICY "Users can insert their own watchlist items"
  ON public.watchlist_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own watchlist items" ON public.watchlist_items;
CREATE POLICY "Users can update their own watchlist items"
  ON public.watchlist_items FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own watchlist items" ON public.watchlist_items;
CREATE POLICY "Users can delete their own watchlist items"
  ON public.watchlist_items FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- tv_show_progress table
DROP POLICY IF EXISTS "Users can view their own TV show progress" ON public.tv_show_progress;
CREATE POLICY "Users can view their own TV show progress"
  ON public.tv_show_progress FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own TV show progress" ON public.tv_show_progress;
CREATE POLICY "Users can insert their own TV show progress"
  ON public.tv_show_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own TV show progress" ON public.tv_show_progress;
CREATE POLICY "Users can update their own TV show progress"
  ON public.tv_show_progress FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own TV show progress" ON public.tv_show_progress;
CREATE POLICY "Users can delete their own TV show progress"
  ON public.tv_show_progress FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- list_items table
DROP POLICY IF EXISTS "Users can view list items in accessible lists" ON public.list_items;
CREATE POLICY "Users can view list items in accessible lists"
  ON public.list_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE custom_lists.id = list_items.list_id
      AND (
        custom_lists.user_id = (select auth.uid())
        OR custom_lists.is_public = true
        OR EXISTS (
          SELECT 1 FROM public.list_shares
          WHERE list_shares.list_id = custom_lists.id
          AND list_shares.shared_with_user_id = (select auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert items in their own lists" ON public.list_items;
CREATE POLICY "Users can insert items in their own lists"
  ON public.list_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE custom_lists.id = list_items.list_id
      AND custom_lists.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update items in editable lists" ON public.list_items;
CREATE POLICY "Users can update items in editable lists"
  ON public.list_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE custom_lists.id = list_items.list_id
      AND custom_lists.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE custom_lists.id = list_items.list_id
      AND custom_lists.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete items in editable lists" ON public.list_items;
CREATE POLICY "Users can delete items in editable lists"
  ON public.list_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE custom_lists.id = list_items.list_id
      AND custom_lists.user_id = (select auth.uid())
    )
  );

-- follows table
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can unfollow others" ON public.follows;
CREATE POLICY "Users can unfollow others"
  ON public.follows FOR DELETE
  TO authenticated
  USING (follower_id = (select auth.uid()));

-- recommendations table
DROP POLICY IF EXISTS "Users can view their sent and received recommendations" ON public.recommendations;
CREATE POLICY "Users can view their sent and received recommendations"
  ON public.recommendations FOR SELECT
  TO authenticated
  USING (from_user_id = (select auth.uid()) OR to_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can send recommendations" ON public.recommendations;
CREATE POLICY "Users can send recommendations"
  ON public.recommendations FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Recipients can update recommendation status" ON public.recommendations;
CREATE POLICY "Recipients can update recommendation status"
  ON public.recommendations FOR UPDATE
  TO authenticated
  USING (to_user_id = (select auth.uid()))
  WITH CHECK (to_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete recommendations they sent" ON public.recommendations;
CREATE POLICY "Users can delete recommendations they sent"
  ON public.recommendations FOR DELETE
  TO authenticated
  USING (from_user_id = (select auth.uid()));

-- custom_lists table
DROP POLICY IF EXISTS "Users can view their own lists" ON public.custom_lists;
CREATE POLICY "Users can view their own lists"
  ON public.custom_lists FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own lists" ON public.custom_lists;
CREATE POLICY "Users can insert their own lists"
  ON public.custom_lists FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own lists" ON public.custom_lists;
CREATE POLICY "Users can update their own lists"
  ON public.custom_lists FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own lists" ON public.custom_lists;
CREATE POLICY "Users can delete their own lists"
  ON public.custom_lists FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- user_settings table
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;
CREATE POLICY "Users can delete own settings"
  ON public.user_settings FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- global_share_permissions table
DROP POLICY IF EXISTS "Users can read permissions involving them" ON public.global_share_permissions;
CREATE POLICY "Users can read permissions involving them"
  ON public.global_share_permissions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()) OR can_share_with_user_id = (select auth.uid()));

-- notifications table
DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
CREATE POLICY "Users can read their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- list_shares table
DROP POLICY IF EXISTS "Users can view shares for their lists" ON public.list_shares;
CREATE POLICY "Users can view shares for their lists"
  ON public.list_shares FOR SELECT
  TO authenticated
  USING (
    shared_with_user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.custom_lists
      WHERE custom_lists.id = list_shares.list_id
      AND custom_lists.user_id = (select auth.uid())
    )
  );

-- binge_sessions table
DROP POLICY IF EXISTS "Users can view their own binge sessions" ON public.binge_sessions;
CREATE POLICY "Users can view their own binge sessions"
  ON public.binge_sessions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own binge sessions" ON public.binge_sessions;
CREATE POLICY "Users can insert their own binge sessions"
  ON public.binge_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own binge sessions" ON public.binge_sessions;
CREATE POLICY "Users can update their own binge sessions"
  ON public.binge_sessions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own binge sessions" ON public.binge_sessions;
CREATE POLICY "Users can delete their own binge sessions"
  ON public.binge_sessions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- episode_reminders table
DROP POLICY IF EXISTS "Users can view their own episode reminders" ON public.episode_reminders;
CREATE POLICY "Users can view their own episode reminders"
  ON public.episode_reminders FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own episode reminders" ON public.episode_reminders;
CREATE POLICY "Users can insert their own episode reminders"
  ON public.episode_reminders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own episode reminders" ON public.episode_reminders;
CREATE POLICY "Users can update their own episode reminders"
  ON public.episode_reminders FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own episode reminders" ON public.episode_reminders;
CREATE POLICY "Users can delete their own episode reminders"
  ON public.episode_reminders FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- user_profiles table
DROP POLICY IF EXISTS "Users can view own profiles" ON public.user_profiles;
CREATE POLICY "Users can view own profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (account_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own profiles" ON public.user_profiles;
CREATE POLICY "Users can create own profiles"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (account_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profiles" ON public.user_profiles;
CREATE POLICY "Users can update own profiles"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (account_id = (select auth.uid()))
  WITH CHECK (account_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own profiles" ON public.user_profiles;
CREATE POLICY "Users can delete own profiles"
  ON public.user_profiles FOR DELETE
  TO authenticated
  USING (account_id = (select auth.uid()));

-- user_interactions table
DROP POLICY IF EXISTS "Users can view own interactions" ON public.user_interactions;
CREATE POLICY "Users can view own interactions"
  ON public.user_interactions FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE account_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create own interactions" ON public.user_interactions;
CREATE POLICY "Users can create own interactions"
  ON public.user_interactions FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE account_id = (select auth.uid())
    )
  );

-- profile_affinity table
DROP POLICY IF EXISTS "Users can view own affinity" ON public.profile_affinity;
CREATE POLICY "Users can view own affinity"
  ON public.profile_affinity FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE account_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can manage own affinity" ON public.profile_affinity;
CREATE POLICY "Users can manage own affinity"
  ON public.profile_affinity FOR ALL
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE account_id = (select auth.uid())
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE account_id = (select auth.uid())
    )
  );

-- user_preferences table
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE account_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE account_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE account_id = (select auth.uid())
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE account_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete own preferences"
  ON public.user_preferences FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE account_id = (select auth.uid())
    )
  );

-- admin_audit_log table
DROP POLICY IF EXISTS "Users can read audit logs about them" ON public.admin_audit_log;
CREATE POLICY "Users can read audit logs about them"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (target_user_id = (select auth.uid()));

-- ============================================================================
-- PART 2: DROP UNUSED AND DUPLICATE INDEXES
-- ============================================================================

DROP INDEX IF EXISTS public.idx_user_preferences_lookup;
DROP INDEX IF EXISTS public.idx_user_preferences_type;
DROP INDEX IF EXISTS public.idx_user_preferences_tags;
DROP INDEX IF EXISTS public.idx_preferences_content_metadata;
DROP INDEX IF EXISTS public.idx_preferences_created;
DROP INDEX IF EXISTS public.idx_watchlist_items_user_id;
DROP INDEX IF EXISTS public.idx_watchlist_items_tmdb_id;
DROP INDEX IF EXISTS public.idx_watchlist_items_status;
DROP INDEX IF EXISTS public.idx_watchlist_profile;
DROP INDEX IF EXISTS public.idx_tv_show_progress_user_id;
DROP INDEX IF EXISTS public.idx_tv_show_progress_tmdb_id;
DROP INDEX IF EXISTS public.idx_tv_progress_profile;
DROP INDEX IF EXISTS public.idx_global_share_permissions_user_id;
DROP INDEX IF EXISTS public.idx_global_share_permissions_can_share_with;
DROP INDEX IF EXISTS public.idx_notifications_user_id;
DROP INDEX IF EXISTS public.idx_notifications_created_at;
DROP INDEX IF EXISTS public.idx_notifications_is_read;
DROP INDEX IF EXISTS public.idx_audit_log_admin_user_id;
DROP INDEX IF EXISTS public.idx_audit_log_target_user_id;
DROP INDEX IF EXISTS public.idx_audit_log_action_type;
DROP INDEX IF EXISTS public.idx_audit_log_created_at;
DROP INDEX IF EXISTS public.idx_custom_lists_user_id;
DROP INDEX IF EXISTS public.idx_custom_lists_is_public;
DROP INDEX IF EXISTS public.idx_list_shares_list_id;
DROP INDEX IF EXISTS public.idx_list_shares_shared_with_user_id;
DROP INDEX IF EXISTS public.idx_list_items_list_id;
DROP INDEX IF EXISTS public.idx_list_items_tmdb_id;
DROP INDEX IF EXISTS public.idx_follows_follower_id;
DROP INDEX IF EXISTS public.idx_follows_following_id;
DROP INDEX IF EXISTS public.idx_recommendations_from_user_id;
DROP INDEX IF EXISTS public.idx_recommendations_to_user_id;
DROP INDEX IF EXISTS public.idx_recommendations_status;
DROP INDEX IF EXISTS public.idx_recommendations_created_at;
DROP INDEX IF EXISTS public.idx_binge_sessions_user_id;
DROP INDEX IF EXISTS public.idx_binge_sessions_tmdb_id;
DROP INDEX IF EXISTS public.idx_binge_sessions_ended_at;
DROP INDEX IF EXISTS public.idx_episode_reminders_user_id;
DROP INDEX IF EXISTS public.idx_episode_reminders_tmdb_id;
DROP INDEX IF EXISTS public.idx_episode_reminders_air_date;
DROP INDEX IF EXISTS public.idx_episode_reminders_reminder_sent;
DROP INDEX IF EXISTS public.idx_user_profiles_account;
DROP INDEX IF EXISTS public.idx_user_profiles_primary;
DROP INDEX IF EXISTS public.idx_interactions_profile;
DROP INDEX IF EXISTS public.idx_interactions_created;
DROP INDEX IF EXISTS public.idx_interactions_tmdb;
DROP INDEX IF EXISTS public.idx_interactions_type;
DROP INDEX IF EXISTS public.idx_affinity_profile_type;
DROP INDEX IF EXISTS public.idx_affinity_score;
DROP INDEX IF EXISTS public.idx_preferences_type;
DROP INDEX IF EXISTS public.idx_user_settings_user_id;

-- ============================================================================
-- PART 3: FIX FUNCTION SEARCH PATHS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE admin_user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_binge_session(
  p_user_id uuid,
  p_tmdb_id integer,
  p_media_type text,
  p_title text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_id uuid;
  v_cutoff_time timestamptz;
BEGIN
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
$$;

CREATE OR REPLACE FUNCTION public.check_can_share(owner_id uuid, recipient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF is_current_user_admin() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.global_share_permissions
    WHERE user_id = owner_id
      AND can_share_with_user_id = recipient_id
      AND is_allowed = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_binge_session_on_watch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  IF NEW.media_type = 'tv' THEN
    v_session_id := get_or_create_binge_session(
      NEW.user_id,
      NEW.tmdb_id,
      NEW.media_type,
      ''
    );

    UPDATE public.binge_sessions
    SET
      episodes_watched = episodes_watched + 1,
      last_watched_at = NOW(),
      ended_at = NULL
    WHERE id = v_session_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type text,
  p_target_user_id uuid DEFAULT NULL,
  p_details text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (admin_user_id, action_type, target_user_id, details, metadata)
  VALUES (auth.uid(), p_action_type, p_target_user_id, p_details, p_metadata);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, notification_type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_primary_profile_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (account_id, name, is_primary)
  VALUES (NEW.user_id, NEW.username, true);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_share_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF is_current_user_admin() THEN
    RETURN NEW;
  END IF;
  
  IF NOT check_can_share(NEW.list_owner_id, NEW.shared_with_user_id) THEN
    RAISE EXCEPTION 'You do not have permission to share with this user. Please contact the administrator.';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_primary_profile_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username text;
BEGIN
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, v_username)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_profiles (account_id, name, is_primary)
  VALUES (NEW.id, v_username, true)
  ON CONFLICT (account_id, is_primary) WHERE is_primary = true DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_recommendation_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    NEW.accepted_at = NOW();
  ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    NEW.rejected_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_list_owner(p_list_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.custom_lists
    WHERE id = p_list_id
    AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_list_shared_with_me(p_list_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.list_shares
    WHERE list_id = p_list_id
    AND shared_with_user_id = auth.uid()
  );
END;
$$;