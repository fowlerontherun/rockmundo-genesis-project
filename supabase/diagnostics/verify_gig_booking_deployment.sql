\set ON_ERROR_STOP on
DO $$
DECLARE v_proc regprocedure; v_definition text;
BEGIN
  FOREACH v_proc IN ARRAY ARRAY[
    'public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text)'::regprocedure,
    'public.active_band_performing_members(uuid)'::regprocedure,
    'public.seed_gig_performers(uuid)'::regprocedure,
    'public.check_gig_member_schedule_conflicts()'::regprocedure,
    'public.calculate_predicted_tickets(uuid,integer,timestamptz)'::regprocedure
  ] LOOP
    v_definition := pg_get_functiondef(v_proc);
    IF v_definition ~ '\mduration_seconds\M' OR v_definition ~ '\mfame\M' THEN
      RAISE EXCEPTION 'verification failed: % retains an absent legacy column', v_proc;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260728160000') THEN
    RAISE EXCEPTION 'verification failed: repair migration 20260728160000 is not installed';
  END IF;
END $$;
SELECT 'gig booking deployment verified' AS result;
