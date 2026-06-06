ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS dashboard_section_order jsonb,
  ADD COLUMN IF NOT EXISTS dashboard_section_hidden jsonb;
