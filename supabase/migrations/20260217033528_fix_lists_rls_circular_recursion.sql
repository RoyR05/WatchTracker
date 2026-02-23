/*
  # Fix circular RLS recursion between custom_lists and list_shares

  1. Problem
    - custom_lists SELECT policy "Users can view lists shared with them" queries list_shares
    - list_shares SELECT/INSERT/DELETE policies query custom_lists
    - This creates infinite recursion (error 42P17)

  2. Solution
    - Create a SECURITY DEFINER function to check list ownership, bypassing RLS
    - Replace list_shares policies to use the function instead of subquerying custom_lists
    - Replace custom_lists "shared with" policy to use a function instead of subquerying list_shares

  3. Security
    - Functions use SECURITY DEFINER to bypass RLS but only return boolean ownership/membership checks
    - No data is leaked through these helper functions
*/

CREATE OR REPLACE FUNCTION public.is_list_owner(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.custom_lists
    WHERE id = p_list_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_list_shared_with_me(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.list_shares
    WHERE list_id = p_list_id AND shared_with_user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Users can view lists shared with them" ON public.custom_lists;
CREATE POLICY "Users can view lists shared with them"
  ON public.custom_lists
  FOR SELECT
  TO authenticated
  USING (public.is_list_shared_with_me(id));

DROP POLICY IF EXISTS "List owners can create shares" ON public.list_shares;
CREATE POLICY "List owners can create shares"
  ON public.list_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_list_owner(list_id));

DROP POLICY IF EXISTS "List owners can delete shares" ON public.list_shares;
CREATE POLICY "List owners can delete shares"
  ON public.list_shares
  FOR DELETE
  TO authenticated
  USING (public.is_list_owner(list_id));

DROP POLICY IF EXISTS "Users can view shares for their lists" ON public.list_shares;
CREATE POLICY "Users can view shares for their lists"
  ON public.list_shares
  FOR SELECT
  TO authenticated
  USING (public.is_list_owner(list_id) OR shared_with_user_id = auth.uid());
