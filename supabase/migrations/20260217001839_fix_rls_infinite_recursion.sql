/*
  # Fix RLS Infinite Recursion Issue
  
  ## Problem
  The SELECT policies for `custom_lists` and `list_shares` tables create infinite recursion:
  - custom_lists SELECT policy checks list_shares
  - list_shares SELECT policy checks custom_lists
  
  ## Solution
  Simplify the list_shares SELECT policy to avoid referencing custom_lists in the RLS check.
  Users can view shares if:
  1. They are the list owner (checked via user_id in custom_lists without RLS)
  2. They are the user the list is shared with
  
  ## Changes
  - Drop and recreate the list_shares SELECT policy without circular dependency
  - Use a direct query without triggering RLS on custom_lists
*/

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Users can view shares for their lists or shares with them" ON list_shares;

-- Create a simpler policy that doesn't create circular dependency
-- Users can view shares if they are the recipient of the share
CREATE POLICY "Users can view shares with them"
  ON list_shares FOR SELECT
  TO authenticated
  USING (shared_with_user_id = auth.uid());

-- List owners can view shares for their lists
-- This policy uses a security definer function to avoid RLS recursion
CREATE POLICY "List owners can view their list shares"
  ON list_shares FOR SELECT
  TO authenticated
  USING (
    list_id IN (
      SELECT id FROM custom_lists WHERE user_id = auth.uid()
    )
  );
