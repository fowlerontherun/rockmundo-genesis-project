-- Run after migrations in a disposable Supabase database.
BEGIN;

DO $$
DECLARE
  v_settings jsonb;
BEGIN
  IF to_regclass('public.gig_viewer_crowd_settings') IS NULL THEN
    RAISE EXCEPTION 'gig_viewer_crowd_settings table is missing';
  END IF;

  IF to_regprocedure('public.normalize_gig_viewer_crowd_settings(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'crowd settings normalizer is missing';
  END IF;

  IF to_regprocedure('public.admin_set_gig_viewer_crowd_settings(jsonb,text)') IS NULL THEN
    RAISE EXCEPTION 'admin crowd settings save RPC is missing';
  END IF;

  IF to_regprocedure('public.admin_restore_gig_viewer_crowd_settings(text)') IS NULL THEN
    RAISE EXCEPTION 'admin crowd settings restore RPC is missing';
  END IF;

  SELECT settings INTO v_settings
  FROM public.gig_viewer_crowd_settings
  WHERE id = true;

  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'crowd settings singleton was not seeded';
  END IF;

  IF (v_settings ->> 'densityMultiplier')::numeric <> 2 THEN
    RAISE EXCEPTION 'unexpected seeded density multiplier';
  END IF;

  BEGIN
    PERFORM public.normalize_gig_viewer_crowd_settings('{"densityMultiplier":9}'::jsonb);
    RAISE EXCEPTION 'out-of-range density was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'out-of-range density was accepted' THEN
      RAISE;
    END IF;
  END;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'gig_viewer_crowd_settings'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled for gig_viewer_crowd_settings';
  END IF;
END;
$$;

ROLLBACK;
