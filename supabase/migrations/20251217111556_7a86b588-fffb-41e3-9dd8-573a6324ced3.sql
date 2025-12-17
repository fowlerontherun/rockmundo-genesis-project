-- Add rpm_avatar_url column to profiles table for storing Ready Player Me avatar URLs
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS rpm_avatar_url TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.profiles.rpm_avatar_url IS 'Ready Player Me full-body avatar URL created by the player';