-- Allow multiple character profiles per user with slot metadata.
-- Legacy jam_sessions.host_id originally referenced profiles.user_id, which
-- prevents removing the one-profile-per-user uniqueness constraint. Historical
-- jam-session rows were cleared by the earlier Jam Session Phase 1 migration,
-- so clean installs can safely converge host_id to the current character-scoped
-- profiles.id relationship before enabling multiple profile slots.
ALTER TABLE public.jam_sessions
  DROP CONSTRAINT IF EXISTS jam_sessions_host_id_fkey;

-- The five legacy user-level relationships below originally referenced
-- profiles(user_id) only because profiles.user_id was once UNIQUE. Character
-- slots remove that uniqueness: one auth user can now own multiple profiles.
-- Preserve the FK names and their ON UPDATE/DELETE actions, but point these
-- account-level user_id references at the actual auth.users primary key.
--
-- This is a source-only historical replay correction, not an operator repair:
-- never cascade-drop dependent FKs or drop profile rows to force migration.
DO $retarget_profile_user_fks$
DECLARE
  v_user_attnum smallint;
  v_unexpected text[];
  v_fk record;
  v_definition text;
  v_retargeted text;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Character slot migration requires auth.users';
  END IF;
  SELECT attnum INTO v_user_attnum FROM pg_attribute
  WHERE attrelid='public.profiles'::regclass AND attname='user_id' AND NOT attisdropped;
  IF v_user_attnum IS NULL THEN
    RAISE EXCEPTION 'Character slot migration requires profiles.user_id';
  END IF;

  -- Reject unexpected or composite references before changing any constraint.
  -- Explicitly limit this correction to the five verified account-level FKs.
  SELECT array_agg(format('%I.%I.%I', ns.nspname, rel.relname, c.conname)
                   ORDER BY ns.nspname,rel.relname,c.conname)
    INTO v_unexpected
  FROM pg_constraint c
  JOIN pg_class rel ON rel.oid=c.conrelid
  JOIN pg_namespace ns ON ns.oid=rel.relnamespace
  WHERE c.contype='f'
    AND c.confrelid='public.profiles'::regclass
    AND v_user_attnum=ANY(c.confkey)
    AND (
      c.confkey<>ARRAY[v_user_attnum]::smallint[]
      OR format('%s.%s.%s',ns.nspname,rel.relname,c.conname) NOT IN (
        'public.band_members.band_members_user_id_fkey',
        'public.venue_relationships.venue_relationships_user_id_fkey',
        'public.venue_bookings.venue_bookings_user_id_fkey',
        'public.songwriting_projects.songwriting_projects_user_id_fkey',
        'public.songwriting_sessions.songwriting_sessions_user_id_fkey'
      )
    );

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected profiles.user_id FK dependencies: %',v_unexpected
      USING ERRCODE='55000';
  END IF;

  FOR v_fk IN
    SELECT c.oid,c.conrelid,c.conname
    FROM pg_constraint c
    WHERE c.contype='f'
      AND c.confrelid='public.profiles'::regclass
      AND c.confkey=ARRAY[v_user_attnum]::smallint[]
    ORDER BY c.conrelid,c.conname
  LOOP
    v_definition:=pg_get_constraintdef(v_fk.oid);
    v_retargeted:=replace(v_definition,
      'REFERENCES public.profiles(user_id)', 'REFERENCES auth.users(id)');
    v_retargeted:=replace(v_retargeted,
      'REFERENCES profiles(user_id)', 'REFERENCES auth.users(id)');

    IF v_retargeted=v_definition
       OR v_retargeted NOT LIKE 'FOREIGN KEY (user_id) REFERENCES auth.users(id)%' THEN
      RAISE EXCEPTION 'Unrecognized legacy user FK definition: %',v_fk.conname
        USING ERRCODE='55000';
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',
                   v_fk.conrelid::regclass,v_fk.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s',
                   v_fk.conrelid::regclass,v_fk.conname,v_retargeted);
  END LOOP;

  -- Fail closed instead of silently leaving a FK that blocks the uniqueness
  -- drop or would force all future character slots to refer to one profile.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype='f' AND c.confrelid='public.profiles'::regclass
      AND v_user_attnum=ANY(c.confkey)
  ) THEN
    RAISE EXCEPTION 'Character slot user FKs were not fully retargeted'
      USING ERRCODE='55000';
  END IF;
END;
$retarget_profile_user_fks$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;

ALTER TABLE public.jam_sessions
  ADD CONSTRAINT jam_sessions_host_id_fkey
  FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

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
