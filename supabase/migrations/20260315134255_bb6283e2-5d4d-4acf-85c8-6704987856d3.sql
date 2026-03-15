-- Re-add unlock_cost column to profiles (removed previously, needed for compatibility)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unlock_cost integer NOT NULL DEFAULT 0;

-- Drop the UNIQUE constraint on user_id to allow multiple character profiles per account
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;