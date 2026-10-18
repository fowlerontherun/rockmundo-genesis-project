-- Read-only regression for duplicate-profile protection after both migrations.
DO $test$
DECLARE definitions integer;
DECLARE duplicates integer;
BEGIN
  SELECT count(*) INTO definitions
  FROM pg_constraint
  WHERE conrelid='public.player_behavior_settings'::regclass
    AND conname='unique_profile_behavior_settings'
    AND contype='u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (profile_id)';
  IF definitions<>1 THEN
    RAISE EXCEPTION 'Per-character settings uniqueness missing or malformed';
  END IF;
  SELECT count(*) INTO duplicates FROM (
    SELECT profile_id FROM public.player_behavior_settings
    GROUP BY profile_id HAVING count(*)>1
  ) repeated;
  IF duplicates<>0 THEN
    RAISE EXCEPTION '% profiles have duplicate behaviour settings',duplicates;
  END IF;
END $test$;
