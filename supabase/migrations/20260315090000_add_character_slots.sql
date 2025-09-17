-- Allow multiple character profiles per user with slot metadata
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slot_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unlock_cost integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

WITH ranked_profiles AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS slot_rank
  FROM public.profiles
)
UPDATE public.profiles AS p
SET
  slot_number = ranked_profiles.slot_rank,
  unlock_cost = COALESCE(p.unlock_cost, 0),
  is_active = CASE
    WHEN ranked_profiles.slot_rank = 1 THEN true
    ELSE false
  END
FROM ranked_profiles
WHERE p.id = ranked_profiles.id;

ALTER TABLE public.profiles
  ALTER COLUMN slot_number SET NOT NULL,
  ALTER COLUMN unlock_cost SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_unique_user_slot UNIQUE (user_id, slot_number);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_single_active_per_user
  ON public.profiles (user_id)
  WHERE is_active;

-- Link player skills to specific character profiles
ALTER TABLE public.player_skills DROP CONSTRAINT IF EXISTS player_skills_user_id_key;
ALTER TABLE public.player_skills ADD COLUMN IF NOT EXISTS profile_id uuid;

UPDATE public.player_skills AS ps
SET profile_id = p.id
FROM public.profiles AS p
WHERE ps.profile_id IS NULL
  AND ps.user_id = p.user_id
  AND p.slot_number = 1;

ALTER TABLE public.player_skills
  ALTER COLUMN profile_id SET NOT NULL;

ALTER TABLE public.player_skills
  ADD CONSTRAINT player_skills_profile_id_fkey FOREIGN KEY (profile_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.player_skills
  ADD CONSTRAINT player_skills_unique_profile UNIQUE (profile_id);

-- Track character ownership in the activity feed
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS profile_id uuid;

UPDATE public.activity_feed AS af
SET profile_id = p.id
FROM public.profiles AS p
WHERE af.profile_id IS NULL
  AND af.user_id = p.user_id
  AND p.slot_number = 1;

ALTER TABLE public.activity_feed
  ALTER COLUMN profile_id SET NOT NULL;

ALTER TABLE public.activity_feed
  ADD CONSTRAINT activity_feed_profile_id_fkey FOREIGN KEY (profile_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE;
