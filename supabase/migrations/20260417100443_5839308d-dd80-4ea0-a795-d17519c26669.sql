-- Earlier March migration already creates this profile-scoped uniqueness
-- constraint. Retain its enforcement without re-adding it on a clean replay.
ALTER TABLE public.player_behavior_settings
  DROP CONSTRAINT IF EXISTS unique_user_behavior_settings;

DO $behavior_profile_unique$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.player_behavior_settings'::regclass
      AND conname = 'unique_profile_behavior_settings'
  ) THEN
    ALTER TABLE public.player_behavior_settings
      ADD CONSTRAINT unique_profile_behavior_settings UNIQUE (profile_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.player_behavior_settings'::regclass
      AND conname = 'unique_profile_behavior_settings'
      AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'Expected profile-scoped unique constraint on player_behavior_settings';
  END IF;
END $behavior_profile_unique$;
