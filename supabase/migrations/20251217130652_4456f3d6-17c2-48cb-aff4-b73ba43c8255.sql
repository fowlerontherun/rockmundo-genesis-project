-- Add terms acceptance tracking to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) DEFAULT NULL;