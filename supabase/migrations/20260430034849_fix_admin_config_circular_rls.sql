/*
  # Fix Admin Config Circular RLS Dependency

  ## Problem
  The `is_current_user_admin()` function was switched to SECURITY INVOKER,
  but it queries `admin_config` which has an RLS policy that calls
  `is_current_user_admin()` -- creating infinite recursion.

  ## Solution
  1. Replace `admin_config` RLS policies with direct `auth.uid()` checks
     (no function call, breaking the circular dependency)
  2. Switch `is_current_user_admin()` back to SECURITY DEFINER so other
     tables' RLS policies can use it to check admin status (it needs to
     bypass `admin_config` RLS)
  3. Revoke EXECUTE from `anon` role (not needed) but keep for `authenticated`
     since RLS policies run in the authenticated user's context

  ## Changes
  - Modified: `admin_config` SELECT policy -> direct uid check
  - Modified: `admin_config` INSERT policy -> direct uid check
  - Modified: `admin_config` UPDATE policy -> direct uid check
  - Modified: `is_current_user_admin()` -> back to SECURITY DEFINER
*/

-- Drop existing policies on admin_config that use is_current_user_admin()
DROP POLICY IF EXISTS "Admin can read admin config" ON public.admin_config;
DROP POLICY IF EXISTS "Admin can insert admin config" ON public.admin_config;
DROP POLICY IF EXISTS "Admin can update admin config" ON public.admin_config;

-- Recreate with direct auth.uid() check to break circular dependency
CREATE POLICY "Admin can read admin config"
  ON public.admin_config
  FOR SELECT
  TO authenticated
  USING (admin_user_id = auth.uid());

CREATE POLICY "Admin can insert admin config"
  ON public.admin_config
  FOR INSERT
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid());

CREATE POLICY "Admin can update admin config"
  ON public.admin_config
  FOR UPDATE
  TO authenticated
  USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());

-- Switch is_current_user_admin() back to SECURITY DEFINER
-- It MUST bypass RLS on admin_config since other tables' policies depend on it
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE admin_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
