-- Phase 39: Plex remote-play device permissions
-- Maps app users to specific Plex client identifiers (TVs, players)
-- that the admin has explicitly assigned to them.

CREATE TABLE plex_device_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_identifier text NOT NULL,
  friendly_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_identifier)
);

ALTER TABLE plex_device_permissions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own device assignments
CREATE POLICY "users_read_own_devices" ON plex_device_permissions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin can read, insert, update, and delete all device assignments
CREATE POLICY "admin_all_devices" ON plex_device_permissions
  FOR ALL USING (is_current_user_admin());
