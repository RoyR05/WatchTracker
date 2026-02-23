/*
  # Admin System with Global Permissions and Notifications

  ## Overview
  This migration creates a comprehensive admin system that allows a single administrator
  to manage users, control global sharing permissions, send notifications, and track all
  administrative actions through an audit log.

  ## 1. New Tables

  ### admin_config
  - `id` (bigserial, primary key) - Auto-incrementing ID
  - `admin_user_id` (uuid, unique, not null) - References auth.users, identifies the admin
  - `created_at` (timestamptz) - When admin was configured
  - `updated_at` (timestamptz) - Last update timestamp
  - Single row enforced via check constraint

  ### global_share_permissions
  - `id` (bigserial, primary key) - Auto-incrementing ID
  - `user_id` (uuid, not null) - User who wants to share
  - `can_share_with_user_id` (uuid, not null) - User they can share with
  - `is_allowed` (boolean, default true) - Whether sharing is permitted
  - `created_at` (timestamptz) - Permission grant timestamp
  - `updated_at` (timestamptz) - Last modification timestamp
  - Unique constraint on (user_id, can_share_with_user_id)

  ### notifications
  - `id` (bigserial, primary key) - Auto-incrementing ID
  - `user_id` (uuid, not null) - Recipient user
  - `notification_type` (text, not null) - Type: password_reset, permission_granted, etc.
  - `title` (text, not null) - Notification title
  - `message` (text, not null) - Notification message content
  - `is_read` (boolean, default false) - Read status
  - `created_at` (timestamptz) - Notification timestamp
  - `metadata` (jsonb) - Additional data

  ### admin_audit_log
  - `id` (bigserial, primary key) - Auto-incrementing ID
  - `admin_user_id` (uuid, not null) - Admin who performed action
  - `action_type` (text, not null) - Action: user_created, permission_granted, etc.
  - `target_user_id` (uuid) - User affected by action
  - `details` (text) - Human-readable description
  - `metadata` (jsonb) - Additional structured data
  - `created_at` (timestamptz) - Action timestamp

  ## 2. Helper Functions

  ### is_current_user_admin()
  Returns true if the current authenticated user is the admin

  ### check_can_share(owner_id, recipient_id)
  Checks if owner_id has permission to share with recipient_id

  ### log_admin_action(action_type, target_user_id, details, metadata)
  Logs an admin action to the audit log

  ## 3. Triggers

  ### validate_share_permission_trigger
  Before inserting into list_shares, validates global share permission exists

  ## 4. Security
  - Enable RLS on all tables
  - Admin has full access to all tables
  - Users can read their own notifications
  - Users can read audit logs that involve them
  - Global share permissions are readable by authenticated users for checking
*/

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Admin Configuration Table (Single Row)
CREATE TABLE IF NOT EXISTS admin_config (
  id bigserial PRIMARY KEY,
  admin_user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT single_admin CHECK (id = 1)
);

-- Global Share Permissions Table
CREATE TABLE IF NOT EXISTS global_share_permissions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_share_with_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_allowed boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_share_permission UNIQUE (user_id, can_share_with_user_id),
  CONSTRAINT no_self_permission CHECK (user_id != can_share_with_user_id)
);

-- Create index for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_global_share_permissions_user_id ON global_share_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_global_share_permissions_can_share_with ON global_share_permissions(can_share_with_user_id);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;

-- Admin Audit Log Table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id bigserial PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_user_id ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target_user_id ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);

-- =====================================================
-- 2. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_config
    WHERE admin_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user can share with another user
CREATE OR REPLACE FUNCTION check_can_share(owner_id uuid, recipient_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Admin can always share
  IF is_current_user_admin() THEN
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

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_action_type text,
  p_target_user_id uuid DEFAULT NULL,
  p_details text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO admin_audit_log (admin_user_id, action_type, target_user_id, details, metadata)
  VALUES (auth.uid(), p_action_type, p_target_user_id, p_details, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, notification_type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. CREATE TRIGGERS
-- =====================================================

-- Trigger to validate share permissions before creating list_shares
CREATE OR REPLACE FUNCTION validate_share_permission()
RETURNS trigger AS $$
BEGIN
  -- Skip validation for admin
  IF is_current_user_admin() THEN
    RETURN NEW;
  END IF;
  
  -- Check if the owner has permission to share with this user
  IF NOT check_can_share(NEW.list_owner_id, NEW.shared_with_user_id) THEN
    RAISE EXCEPTION 'You do not have permission to share with this user. Please contact the administrator.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger to list_shares
DROP TRIGGER IF EXISTS validate_share_permission_trigger ON list_shares;
CREATE TRIGGER validate_share_permission_trigger
  BEFORE INSERT ON list_shares
  FOR EACH ROW
  EXECUTE FUNCTION validate_share_permission();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
DROP TRIGGER IF EXISTS update_admin_config_updated_at ON admin_config;
CREATE TRIGGER update_admin_config_updated_at
  BEFORE UPDATE ON admin_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_global_share_permissions_updated_at ON global_share_permissions;
CREATE TRIGGER update_global_share_permissions_updated_at
  BEFORE UPDATE ON global_share_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_share_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin Config Policies
CREATE POLICY "Admin can read admin config"
  ON admin_config FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

CREATE POLICY "Admin can update admin config"
  ON admin_config FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Admin can insert admin config"
  ON admin_config FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());

-- Global Share Permissions Policies
CREATE POLICY "Admin can read all share permissions"
  ON global_share_permissions FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

CREATE POLICY "Users can read permissions involving them"
  ON global_share_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR can_share_with_user_id = auth.uid());

CREATE POLICY "Admin can insert share permissions"
  ON global_share_permissions FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Admin can update share permissions"
  ON global_share_permissions FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Admin can delete share permissions"
  ON global_share_permissions FOR DELETE
  TO authenticated
  USING (is_current_user_admin());

-- Notifications Policies
CREATE POLICY "Admin can read all notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Audit Log Policies
CREATE POLICY "Admin can read all audit logs"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (is_current_user_admin());

CREATE POLICY "Users can read audit logs about them"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (target_user_id = auth.uid());

CREATE POLICY "Admin can insert audit logs"
  ON admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());
