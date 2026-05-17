-- Phase 20: track first-run onboarding completion per account
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
