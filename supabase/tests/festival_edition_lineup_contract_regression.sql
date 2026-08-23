DO $$
DECLARE
  v_read text;
  v_save text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_read
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='_festival_edition_artist_programme_result'
  LIMIT 1;

  SELECT pg_get_functiondef(p.oid) INTO v_save
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='save_festival_edition_artist_programme'
  LIMIT 1;

  IF v_read IS NULL OR v_save IS NULL THEN
    RAISE EXCEPTION 'exact-edition Festival line-up functions are missing';
  END IF;

  IF position('festival_artist_applications' IN v_read)=0
     OR position('festival_artist_invitations' IN v_read)=0
     OR position('festival_artist_offers' IN v_read)=0
     OR position('festival_artist_bookings' IN v_read)=0 THEN
    RAISE EXCEPTION 'Festival line-up projection is not backed by persisted workflow rows';
  END IF;

  IF position('festival_lineup_requires_confirmed_act' IN v_read)=0 THEN
    RAISE EXCEPTION 'Festival line-up projection does not report the confirmed-act blocker';
  END IF;

  IF position('_festival_company_manager_authorized' IN v_save)=0
     OR position('_festival_projection_authorized' IN v_save)>0 THEN
    RAISE EXCEPTION 'Festival line-up save uses the wrong production authority';
  END IF;

  IF v_save !~* 'p_complete\s+AND\s+active_bookings\s*=\s*0' THEN
    RAISE EXCEPTION 'Festival line-up save can complete without a confirmed booking';
  END IF;

  IF has_function_privilege('anon','public.save_festival_edition_artist_programme(uuid,uuid,integer,jsonb,jsonb,uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute Festival line-up save';
  END IF;

  IF NOT has_function_privilege('authenticated','public.save_festival_edition_artist_programme(uuid,uuid,integer,jsonb,jsonb,uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated owners cannot execute Festival line-up save';
  END IF;
END;
$$;
