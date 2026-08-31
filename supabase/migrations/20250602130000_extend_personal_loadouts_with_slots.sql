-- Historical ordering note:
-- public.profiles does not exist yet at this timestamp. Keep only the enum
-- declaration here and create the dependent slot table later in
-- 20260831180000_finalize_personal_loadouts.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'pedal_chain_stage'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.pedal_chain_stage AS ENUM (
      'input','preamp','drive','modulation','ambient','utility',
      'loop','multi_fx','expression','output'
    );
  END IF;
END $$;
