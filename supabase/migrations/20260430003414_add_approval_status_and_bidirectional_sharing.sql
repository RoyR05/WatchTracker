/*
  # Add User Approval System and Bidirectional Sharing

  ## Overview
  1. Adds an approval workflow so all new users must be approved by the admin
     before accessing the app.
  2. Adds a broadcast capability so the admin can share to all users.
  3. Adds helper functions for bidirectional share permission management.

  ## Modified Tables

  ### `profiles`
  - `approval_status` (text, default 'pending') - 'pending', 'approved', 'rejected'
  - `approved_by` (uuid, nullable) - Admin who approved the user
  - `approved_at` (timestamptz, nullable) - When user was approved
  - `can_broadcast` (boolean, default false) - Whether user can share to everyone

  ## New Functions

  ### `grant_bidirectional_share(user_a uuid, user_b uuid)`
  Creates share permissions in both directions (A->B and B->A) in one call.

  ### `revoke_bidirectional_share(user_a uuid, user_b uuid)`
  Removes share permissions in both directions.

  ## Modified Functions

  ### `check_can_share(owner_id, recipient_id)`
  Updated to also return true if the owner has `can_broadcast = true`.

  ## Security Notes
  - Only admin can change approval_status
  - Only admin can set can_broadcast
  - Existing admin user is automatically set to 'approved'
  - New index on approval_status for fast pending-user queries
*/

-- Add approval columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approval_status text NOT NULL DEFAULT 'pending'
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

-- Add broadcast capability column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'can_broadcast'
  ) THEN
    ALTER TABLE profiles ADD COLUMN can_broadcast boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Index for fast pending user queries
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);

-- Auto-approve the existing admin user
UPDATE profiles
SET approval_status = 'approved',
    approved_at = now(),
    can_broadcast = true
WHERE id IN (SELECT admin_user_id FROM admin_config);

-- Auto-approve all existing users (they were already using the app)
UPDATE profiles
SET approval_status = 'approved',
    approved_at = now()
WHERE approval_status = 'pending'
  AND id NOT IN (SELECT admin_user_id FROM admin_config);

-- Prevent non-admin users from changing approval_status or can_broadcast
-- by updating the existing profile update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Admin can change anything
      EXISTS (SELECT 1 FROM admin_config WHERE admin_user_id = auth.uid())
      OR (
        -- Non-admin users cannot change approval_status or can_broadcast
        approval_status = (SELECT p.approval_status FROM profiles p WHERE p.id = auth.uid())
        AND can_broadcast = (SELECT p.can_broadcast FROM profiles p WHERE p.id = auth.uid())
      )
    )
  );

-- Allow admin to update any profile (for approval)
CREATE POLICY "Admin can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_config WHERE admin_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_config WHERE admin_user_id = auth.uid()));

-- Update check_can_share to support broadcast
CREATE OR REPLACE FUNCTION check_can_share(owner_id uuid, recipient_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Admin can always share
  IF EXISTS (SELECT 1 FROM admin_config WHERE admin_user_id = owner_id) THEN
    RETURN true;
  END IF;

  -- Users with broadcast can share with anyone
  IF EXISTS (SELECT 1 FROM profiles WHERE id = owner_id AND can_broadcast = true) THEN
    RETURN true;
  END IF;

  -- Check if explicit permission exists
  RETURN EXISTS (
    SELECT 1 FROM global_share_permissions
    WHERE user_id = owner_id
      AND can_share_with_user_id = recipient_id
      AND is_allowed = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant bidirectional share permissions
CREATE OR REPLACE FUNCTION grant_bidirectional_share(user_a uuid, user_b uuid)
RETURNS void AS $$
BEGIN
  -- Insert A -> B
  INSERT INTO global_share_permissions (user_id, can_share_with_user_id, is_allowed)
  VALUES (user_a, user_b, true)
  ON CONFLICT (user_id, can_share_with_user_id)
  DO UPDATE SET is_allowed = true, updated_at = now();

  -- Insert B -> A
  INSERT INTO global_share_permissions (user_id, can_share_with_user_id, is_allowed)
  VALUES (user_b, user_a, true)
  ON CONFLICT (user_id, can_share_with_user_id)
  DO UPDATE SET is_allowed = true, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke bidirectional share permissions
CREATE OR REPLACE FUNCTION revoke_bidirectional_share(user_a uuid, user_b uuid)
RETURNS void AS $$
BEGIN
  -- Remove A -> B
  DELETE FROM global_share_permissions
  WHERE user_id = user_a AND can_share_with_user_id = user_b;

  -- Remove B -> A
  DELETE FROM global_share_permissions
  WHERE user_id = user_b AND can_share_with_user_id = user_a;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
