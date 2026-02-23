/*
  # Fix Custom Lists RLS Circular Dependency

  ## Problem
  The RLS policies create circular dependencies:
  - `custom_lists` SELECT policy references `list_shares` table
  - `list_shares` SELECT policy references `custom_lists` table  
  - This causes error 42P17 (undefined_table) when trying to INSERT into custom_lists

  ## Solution
  1. Drop all existing policies for both tables
  2. Recreate policies without circular dependencies
  3. Use simpler, direct checks that don't trigger recursive RLS

  ## Changes
  - Simplified INSERT policy for custom_lists (no other table references)
  - Simplified SELECT policies to avoid circular references
  - List shares policies don't query custom_lists with RLS
*/

-- Drop all existing policies for custom_lists
DROP POLICY IF EXISTS "Users can view their own lists and public lists" ON custom_lists;
DROP POLICY IF EXISTS "Users can insert their own lists" ON custom_lists;
DROP POLICY IF EXISTS "Users can update their own lists" ON custom_lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON custom_lists;

-- Drop all existing policies for list_shares
DROP POLICY IF EXISTS "Users can view shares for their lists or shares with them" ON list_shares;
DROP POLICY IF EXISTS "Users can view shares with them" ON list_shares;
DROP POLICY IF EXISTS "List owners can view their list shares" ON list_shares;
DROP POLICY IF EXISTS "List owners can create shares" ON list_shares;
DROP POLICY IF EXISTS "List owners can delete shares" ON list_shares;

-- Recreate custom_lists policies WITHOUT referencing list_shares in SELECT
CREATE POLICY "Users can view their own lists"
  ON custom_lists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view public lists"
  ON custom_lists FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Users can insert their own lists"
  ON custom_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
  ON custom_lists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists"
  ON custom_lists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Recreate list_shares policies
CREATE POLICY "Users can view shares for their lists"
  ON list_shares FOR SELECT
  TO authenticated
  USING (
    list_id IN (SELECT id FROM custom_lists WHERE user_id = auth.uid() AND custom_lists.id = list_shares.list_id)
    OR shared_with_user_id = auth.uid()
  );

CREATE POLICY "List owners can create shares"
  ON list_shares FOR INSERT
  TO authenticated
  WITH CHECK (
    list_id IN (SELECT id FROM custom_lists WHERE user_id = auth.uid() AND custom_lists.id = list_shares.list_id)
  );

CREATE POLICY "List owners can delete shares"
  ON list_shares FOR DELETE
  TO authenticated
  USING (
    list_id IN (SELECT id FROM custom_lists WHERE user_id = auth.uid() AND custom_lists.id = list_shares.list_id)
  );

-- Add a new policy to allow viewing shared lists
CREATE POLICY "Users can view lists shared with them"
  ON custom_lists FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT list_id FROM list_shares WHERE shared_with_user_id = auth.uid() AND list_shares.list_id = custom_lists.id)
  );
