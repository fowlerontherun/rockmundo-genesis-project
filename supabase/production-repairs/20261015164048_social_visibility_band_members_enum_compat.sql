-- Add the missing social-profile visibility mode used by the frontend.
-- Standalone enum change so it is committed before the new table uses it.
ALTER TYPE public.profile_visibility_scope ADD VALUE IF NOT EXISTS 'band_members';