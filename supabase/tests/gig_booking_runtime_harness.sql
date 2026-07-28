\set ON_ERROR_STOP on
BEGIN;

-- This harness must run only after the complete migration chain has been applied.
DO $$
DECLARE
  missing text;
BEGIN
  WITH required(table_name, column_name) AS (VALUES
    ('bands','id'), ('bands','leader_id'), ('bands','global_fame'), ('bands','band_balance'), ('bands','popularity'),
    ('venues','id'), ('venues','city_id'), ('venues','capacity'), ('venues','base_payment'),
    ('cities','id'), ('cities','timezone'),
    ('setlists','id'), ('setlists','band_id'), ('setlists','is_active'),
    ('setlist_songs','setlist_id'), ('setlist_songs','song_id'),
    ('band_members','band_id'), ('band_members','profile_id'), ('band_members','user_id'),
    ('band_members','member_status'), ('band_members','is_touring_member'),
    ('gigs','band_id'), ('gigs','venue_id'), ('gigs','scheduled_date'), ('gigs','scheduled_end'),
    ('gigs','booking_request_id'), ('gigs','ticket_operator_id'),
    ('player_scheduled_activities','linked_gig_id'), ('player_scheduled_activities','profile_id'),
    ('player_scheduled_activities','user_id'), ('player_scheduled_activities','scheduled_start'),
    ('player_scheduled_activities','scheduled_end')),
  absent AS (
    SELECT r.* FROM required r LEFT JOIN information_schema.columns c
      ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
    WHERE c.column_name IS NULL
  )
  SELECT string_agg(table_name||'.'||column_name, ', ' ORDER BY table_name,column_name) INTO missing FROM absent;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'gig booking schema contract missing: %', missing; END IF;

  IF position('duration_seconds' IN pg_get_functiondef('public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'book_gig retains unused song duration dependency';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.gigs'::regclass AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'production-like schema has no gig triggers';
  END IF;
END $$;

-- Reuse a fully migrated disposable database's canonical fixtures. The test is
-- executable (not migration string matching) and calls the real RPC, all triggers,
-- and its idempotency path. CI/local setup supplies these IDs after seeding.
DO $$
DECLARE
  v_band_id uuid := nullif(current_setting('app.test_gig_band_id', true),'')::uuid;
  v_venue_id uuid := nullif(current_setting('app.test_gig_venue_id', true),'')::uuid;
  v_setlist_id uuid := nullif(current_setting('app.test_gig_setlist_id', true),'')::uuid;
  v_actor_user_id uuid := nullif(current_setting('app.test_gig_actor_user_id', true),'')::uuid;
  request_id uuid := gen_random_uuid();
  before_balance bigint; after_balance bigint; fee bigint; first_result jsonb; retry_result jsonb;
  gig_id uuid; actor_profile_id uuid; conflict_activity_id uuid;
BEGIN
  IF v_band_id IS NULL OR v_venue_id IS NULL OR v_setlist_id IS NULL OR v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'set app.test_gig_band_id, venue_id, setlist_id, and actor_user_id to migrated disposable fixtures';
  END IF;
  IF (SELECT count(*) FROM public.setlist_songs ss WHERE ss.setlist_id=v_setlist_id) <> 6 THEN
    RAISE EXCEPTION 'fixture must contain exactly six songs';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_actor_user_id::text, true);
  IF EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id=v_band_id
             AND COALESCE(bm.member_status,'active')='active'
             AND COALESCE(bm.is_touring_member,false)=false) THEN
    RAISE EXCEPTION 'fixture must be leader-only (touring/inactive rows are allowed)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.active_band_performing_members(v_band_id) performing
    JOIN public.band_members bm ON bm.profile_id=performing.profile_id
    WHERE bm.band_id=v_band_id AND (COALESCE(bm.member_status,'active')<>'active' OR COALESCE(bm.is_touring_member,false))
  ) THEN RAISE EXCEPTION 'touring or inactive member was treated as performing'; END IF;
  SELECT band_balance INTO before_balance FROM public.bands WHERE id=v_band_id;
  SELECT id INTO actor_profile_id FROM public.profiles WHERE user_id=v_actor_user_id;
  INSERT INTO public.player_scheduled_activities
    (user_id,profile_id,activity_type,scheduled_start,scheduled_end,status,title)
  VALUES (v_actor_user_id,actor_profile_id,'other',(current_date+29)::timestamptz, (current_date+32)::timestamptz,'scheduled','gig booking rollback test')
  RETURNING id INTO conflict_activity_id;
  BEGIN
    PERFORM public.book_gig(v_band_id,v_venue_id,v_setlist_id,current_date+30,'headline',10,gen_random_uuid(),NULL,NULL);
    RAISE EXCEPTION 'expected gig INSERT trigger conflict';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;
  IF (SELECT band_balance FROM public.bands WHERE id=v_band_id) <> before_balance THEN
    RAISE EXCEPTION 'trigger failure did not roll back booking deduction';
  END IF;
  DELETE FROM public.player_scheduled_activities WHERE id=conflict_activity_id;

  first_result := public.book_gig(v_band_id,v_venue_id,v_setlist_id,current_date+30,'headline',10,request_id,NULL,NULL);
  IF first_result IS NULL THEN RAISE EXCEPTION 'book_gig returned null'; END IF;
  gig_id := (first_result->'gig'->>'id')::uuid;
  fee := (first_result->>'booking_fee')::bigint;
  SELECT band_balance INTO after_balance FROM public.bands WHERE id=v_band_id;
  IF after_balance <> before_balance-fee THEN RAISE EXCEPTION 'balance was not deducted exactly once'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.player_scheduled_activities WHERE linked_gig_id=gig_id) THEN
    RAISE EXCEPTION 'active member activities were not created';
  END IF;

  retry_result := public.book_gig(v_band_id,v_venue_id,v_setlist_id,current_date+30,'headline',10,request_id,NULL,NULL);
  IF COALESCE((retry_result->>'already_booked')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'idempotent retry did not return existing booking';
  END IF;
  IF (SELECT band_balance FROM public.bands WHERE id=v_band_id) <> after_balance THEN
    RAISE EXCEPTION 'idempotent retry deducted balance twice';
  END IF;
END $$;

-- The surrounding transaction proves every created gig/activity and deduction is
-- rolled back together, including failures from any INSERT trigger.
ROLLBACK;
