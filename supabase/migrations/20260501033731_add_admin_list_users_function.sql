/*
  # Add Admin List Users Function

  ## Problem
  The frontend was using `supabase.auth.admin.listUsers()` which requires the
  service_role key and cannot work from the browser client (anon key only).

  ## Solution
  Create a SECURITY DEFINER function that:
  1. Verifies the caller is an admin
  2. Queries `auth.users` directly (only accessible via SECURITY DEFINER)
  3. Joins with public tables to get user statistics
  4. Returns all data in one efficient query

  ## New Functions
  - `list_users_for_admin()` - Returns user list with stats (admin only)

  ## Security
  - Function is SECURITY DEFINER to access auth.users
  - Checks admin status before returning data
  - Only accessible to authenticated role
*/

CREATE OR REPLACE FUNCTION public.list_users_for_admin()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  profile_count bigint,
  lists_count bigint,
  shares_count bigint
) AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.email, 'No email')::text AS email,
    u.created_at,
    COALESCE(p.cnt, 0) AS profile_count,
    COALESCE(l.cnt, 0) AS lists_count,
    COALESCE(s.cnt, 0) AS shares_count
  FROM auth.users u
  LEFT JOIN (
    SELECT pr.id AS uid, 1::bigint AS cnt
    FROM public.profiles pr
  ) p ON p.uid = u.id
  LEFT JOIN (
    SELECT cl.user_id, COUNT(*)::bigint AS cnt
    FROM public.custom_lists cl
    GROUP BY cl.user_id
  ) l ON l.user_id = u.id
  LEFT JOIN (
    SELECT ls.shared_with_user_id, COUNT(*)::bigint AS cnt
    FROM public.list_shares ls
    GROUP BY ls.shared_with_user_id
  ) s ON s.shared_with_user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
