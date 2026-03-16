-- Make lifestyle behavior settings character-specific instead of account-wide.
ALTER TABLE public.player_behavior_settings
ADD COLUMN IF NOT EXISTS profile_id uuid;

-- Backfill existing rows to the user's active profile when available,
-- otherwise to any non-dead profile owned by the same user.
UPDATE public.player_behavior_settings pbs
SET profile_id = src.profile_id
FROM (
  SELECT DISTINCT ON (p.user_id)
    p.id AS profile_id,
    p.user_id,
    p.is_active,
    p.created_at
  FROM public.profiles p
  WHERE p.died_at IS NULL
  ORDER BY p.user_id, p.is_active DESC, p.created_at ASC
) src
WHERE pbs.user_id = src.user_id
  AND pbs.profile_id IS NULL;

ALTER TABLE public.player_behavior_settings
ALTER COLUMN profile_id SET NOT NULL;

ALTER TABLE public.player_behavior_settings
ADD CONSTRAINT player_behavior_settings_profile_id_fkey
FOREIGN KEY (profile_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

ALTER TABLE public.player_behavior_settings
DROP CONSTRAINT IF EXISTS unique_user_behavior_settings;

ALTER TABLE public.player_behavior_settings
ADD CONSTRAINT unique_profile_behavior_settings UNIQUE (profile_id);

DROP INDEX IF EXISTS idx_player_behavior_settings_user_id;
CREATE INDEX IF NOT EXISTS idx_player_behavior_settings_profile_id
  ON public.player_behavior_settings(profile_id);
