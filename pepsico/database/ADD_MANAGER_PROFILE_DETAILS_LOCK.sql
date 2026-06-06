-- Adds profile lock flag for manager profile fields
-- Run in Supabase SQL editor

ALTER TABLE IF EXISTS manager_profiles
ADD COLUMN IF NOT EXISTS profile_details_locked BOOLEAN NOT NULL DEFAULT FALSE;
