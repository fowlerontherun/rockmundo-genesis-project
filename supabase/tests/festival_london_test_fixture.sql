BEGIN;
SET LOCAL app.allow_test_fixtures = 'true';
\i supabase/seeds/festival_london_test.sql
\i supabase/seeds/festival_london_test.sql
DO $$
DECLARE
  v_brand uuid := '11111111-1111-4111-8111-111111111111';
  v_edition uuid := '11111111-1111-4111-8111-111111111112';
  v_count int;
  v_ops jsonb;
  v_fin jsonb;
  v_missing text[];
BEGIN
  IF (SELECT count(*) FROM public.festivals WHERE metadata->>'fixture_key'='RM-LONDON-TEST-FESTIVAL') <> 1 THEN RAISE EXCEPTION 'fixture brand count mismatch'; END IF;
  IF (SELECT count(*) FROM public.festival_editions WHERE id=v_edition AND festival_id=v_brand AND start_at > now()) <> 1 THEN RAISE EXCEPTION 'fixture edition missing or not upcoming'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.festival_editions e JOIN public.cities c ON c.id=e.city_id WHERE e.id=v_edition AND lower(c.name)='london') THEN RAISE EXCEPTION 'fixture edition does not resolve to London'; END IF;
  IF (SELECT count(*) FROM public.cities WHERE lower(name)='london') < 1 THEN RAISE EXCEPTION 'London city missing'; END IF;
  IF (SELECT count(*) FROM public.festival_stages WHERE edition_id=v_edition AND archived_at IS NULL) <> 3 THEN RAISE EXCEPTION 'stage count mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_stages st WHERE st.edition_id=v_edition AND NOT EXISTS (SELECT 1 FROM public.festival_stage_slots sl WHERE sl.stage_id=st.id AND sl.archived_at IS NULL)) THEN RAISE EXCEPTION 'stage without slots'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_stage_slots a JOIN public.festival_stage_slots b ON a.stage_id=b.stage_id AND a.id<b.id WHERE a.edition_id=v_edition AND b.edition_id=v_edition AND tstzrange(a.start_time,a.end_time,'[)') && tstzrange(b.start_time,b.end_time,'[)')) THEN RAISE EXCEPTION 'same-stage slot overlap'; END IF;
  SELECT count(*) INTO v_count FROM public.festival_stage_slots WHERE edition_id=v_edition; IF v_count <> 36 THEN RAISE EXCEPTION 'slot count mismatch %', v_count; END IF;
  IF (SELECT count(*) FROM public.festival_stage_slots WHERE edition_id=v_edition AND status='confirmed') <> 21 THEN RAISE EXCEPTION 'occupied slot count mismatch'; END IF;
  IF (SELECT count(*) FROM public.festival_stage_slots WHERE edition_id=v_edition AND status='open') <> 15 THEN RAISE EXCEPTION 'empty slot count mismatch'; END IF;
  IF (SELECT count(*) FROM public.festival_system_acts WHERE edition_id=v_edition) <> 21 THEN RAISE EXCEPTION 'system act count mismatch'; END IF;
  IF (SELECT capacity FROM public.festival_editions WHERE id=v_edition) <> 10000 THEN RAISE EXCEPTION 'capacity mismatch'; END IF;
  SELECT array_agg(r->>'permit_type') INTO v_missing FROM jsonb_array_elements(public.festival_edition_permit_requirements(v_edition)) r WHERE r->>'status'='required' AND r->>'blocker'='true';
  IF coalesce(array_length(v_missing,1),0) <> 0 THEN RAISE EXCEPTION 'required permits missing %', v_missing; END IF;
  IF jsonb_array_length(coalesce(public.festival_edition_staffing_readiness(v_edition)->'blockers','[]'::jsonb)) <> 0 THEN RAISE EXCEPTION 'canonical staffing blockers %', public.festival_edition_staffing_readiness(v_edition); END IF;
  IF EXISTS (SELECT 1 FROM public.festival_stages st WHERE st.edition_id=v_edition AND NOT EXISTS (SELECT 1 FROM public.festival_staff sf WHERE sf.edition_id=v_edition AND sf.role='stage_manager' AND sf.assignment_scope->>'stage_id'=st.id::text)) THEN RAISE EXCEPTION 'stage manager missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_stages st WHERE st.edition_id=v_edition AND NOT EXISTS (SELECT 1 FROM public.festival_staff sf WHERE sf.edition_id=v_edition AND sf.role='sound_engineer' AND sf.assignment_scope->>'stage_id'=st.id::text)) THEN RAISE EXCEPTION 'sound engineer missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.festival_insurance_policies p JOIN public.festival_editions e ON e.id=p.edition_id WHERE p.edition_id=v_edition AND p.active AND p.policy_status='pending_payment' AND p.effective_from <= e.start_at::date AND p.effective_to >= e.end_at::date) THEN RAISE EXCEPTION 'canonical insurance missing'; END IF;
  v_ops := public.festival_edition_operations_summary(v_edition);
  IF (v_ops->'ticket_summary'->>'capacity')::int <> 10000 OR (v_ops->'ticket_summary'->>'tickets_sold')::int <> 3250 THEN RAISE EXCEPTION 'operations ticket summary mismatch %', v_ops->'ticket_summary'; END IF;
  IF (v_ops->'schedule_summary'->>'occupied_slots')::int <> 21 THEN RAISE EXCEPTION 'operations occupied slots mismatch %', v_ops->'schedule_summary'; END IF;
  v_fin := public.festival_edition_finance_summary(v_edition);
  IF (v_fin->>'budget_cents')::bigint <> 25000000 OR (v_fin->>'committed_cost_cents')::bigint <> 11000000 OR v_fin->>'currency' <> 'GBP' THEN RAISE EXCEPTION 'finance summary mismatch %', v_fin; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_participants fp WHERE fp.festival_id=v_brand) THEN RAISE EXCEPTION 'forbidden legacy festival_participants write'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_festival_editions WHERE id=v_edition) THEN RAISE EXCEPTION 'public projection missing'; END IF;
END $$;

DO $$
DECLARE
  v_fn text := pg_get_functiondef('public.festival_edition_operations_summary(uuid)'::regprocedure);
  v_internal_priv boolean;
BEGIN
  IF v_fn NOT LIKE '%can_manage_festival_edition(p_edition_id)%' THEN RAISE EXCEPTION 'operations summary missing authorisation guard'; END IF;
  IF v_fn NOT LIKE '%permission_denied%' THEN RAISE EXCEPTION 'operations summary missing structured permission denial'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='can_manage_festival_edition' AND oidvectortypes(proargtypes)='uuid, uuid') THEN RAISE EXCEPTION 'legacy caller-selectable helper still exists'; END IF;
  IF pg_get_function_arguments('public.can_manage_festival_edition(uuid)'::regprocedure) <> 'p_edition_id uuid' THEN RAISE EXCEPTION 'authenticated helper exposes unexpected arguments'; END IF;
  IF has_function_privilege('authenticated','public.can_manage_festival_edition_internal(uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'authenticated can execute explicit-identity helper'; END IF;
  IF has_function_privilege('anon','public.festival_edition_operations_summary(uuid)','EXECUTE') THEN RAISE EXCEPTION 'anon can execute operations summary'; END IF;
  IF NOT has_function_privilege('authenticated','public.festival_edition_operations_summary(uuid)','EXECUTE') THEN RAISE EXCEPTION 'authenticated wrapper execute missing'; END IF;
  SELECT has_function_privilege('authenticated','public.festival_edition_operations_summary_internal(uuid)','EXECUTE') INTO v_internal_priv;
  IF v_internal_priv THEN RAISE EXCEPTION 'authenticated can execute internal operations summary'; END IF;
END $$;

DO $$
DECLARE
  v_edition uuid := '11111111-1111-4111-8111-111111111112';
  v_owner_user uuid := '22222222-2222-4222-8222-222222222201';
  v_unrelated_user uuid := '22222222-2222-4222-8222-222222222202';
  v_manager_user uuid := '22222222-2222-4222-8222-222222222203';
  v_admin_user uuid := '22222222-2222-4222-8222-222222222204';
  v_other_owner_user uuid := '22222222-2222-4222-8222-222222222205';
  v_owner_profile uuid := '33333333-3333-4333-8333-333333333301';
  v_unrelated_profile uuid := '33333333-3333-4333-8333-333333333302';
  v_manager_profile uuid := '33333333-3333-4333-8333-333333333303';
  v_admin_profile uuid := '33333333-3333-4333-8333-333333333304';
  v_other_profile uuid := '33333333-3333-4333-8333-333333333305';
  v_other_brand uuid := '11111111-1111-4111-8111-111111111121';
  v_other_edition uuid := '11111111-1111-4111-8111-111111111122';
  v_ops jsonb;
BEGIN
  INSERT INTO auth.users(id, email) VALUES
    (v_owner_user,'fixture-owner@example.test'),(v_unrelated_user,'fixture-unrelated@example.test'),(v_manager_user,'fixture-manager@example.test'),(v_admin_user,'fixture-admin@example.test'),(v_other_owner_user,'fixture-other@example.test')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles(id,user_id,username,display_name) VALUES
    (v_owner_profile,v_owner_user,'fixture_owner','Fixture Owner'),(v_unrelated_profile,v_unrelated_user,'fixture_unrelated','Fixture Unrelated'),(v_manager_profile,v_manager_user,'fixture_manager','Fixture Manager'),(v_admin_profile,v_admin_user,'fixture_admin','Fixture Admin'),(v_other_profile,v_other_owner_user,'fixture_other','Fixture Other')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.festivals SET owner_profile_id = v_owner_profile WHERE id = '11111111-1111-4111-8111-111111111111';
  INSERT INTO public.user_roles(user_id, role) VALUES (v_admin_user, 'admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.festival_edition_management_roles(edition_id, profile_id, role, status) VALUES (v_edition, v_manager_profile, 'operations_manager', 'active') ON CONFLICT DO NOTHING;

  INSERT INTO public.festivals(id,name,city_id,venue_id,owner_profile_id,status,metadata) SELECT v_other_brand,'Other Fixture Festival',city_id,venue_id,v_other_profile,'planning','{}'::jsonb FROM public.festivals WHERE id='11111111-1111-4111-8111-111111111111' ON CONFLICT DO NOTHING;
  INSERT INTO public.festival_editions(id,festival_id,edition_number,edition_year,title,city_id,venue_id,start_at,end_at,timezone,time_zone,capacity,currency_code,budget_cents,status,lifecycle_metadata,public_metadata)
  SELECT v_other_edition,v_other_brand,1,edition_year,'Other Fixture Edition',city_id,venue_id,start_at,end_at,timezone,time_zone,capacity,currency_code,budget_cents,'planning','{}'::jsonb,'{}'::jsonb FROM public.festival_editions WHERE id=v_edition ON CONFLICT DO NOTHING;

  PERFORM set_config('request.jwt.claim.role','authenticated', true);

  PERFORM set_config('request.jwt.claim.sub', v_unrelated_user::text, true);
  BEGIN PERFORM public.festival_edition_operations_summary(v_edition); RAISE EXCEPTION 'unrelated user unexpectedly read summary'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF public.can_manage_festival_edition(v_edition) THEN RAISE EXCEPTION 'unrelated user can manage edition'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='can_manage_festival_edition' AND oidvectortypes(proargtypes)='uuid, uuid') THEN RAISE EXCEPTION 'ordinary user could target removed actor-id helper'; END IF;
  IF has_function_privilege('authenticated','public.can_manage_festival_edition_internal(uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'ordinary user can execute internal spoof helper'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_owner_user::text, true);
  v_ops := public.festival_edition_operations_summary(v_edition);
  IF (v_ops->'stages') IS NULL THEN RAISE EXCEPTION 'owner summary malformed'; END IF;
  BEGIN PERFORM public.festival_edition_operations_summary(v_other_edition); RAISE EXCEPTION 'owner read another festival'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  PERFORM set_config('request.jwt.claim.sub', v_manager_user::text, true);
  IF public.festival_edition_operations_summary(v_edition)->>'edition_id' <> v_edition::text THEN RAISE EXCEPTION 'manager denied'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin_user::text, true);
  IF public.festival_edition_operations_summary(v_edition)->>'edition_id' <> v_edition::text THEN RAISE EXCEPTION 'admin denied'; END IF;

  PERFORM set_config('request.jwt.claim.role','service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF public.festival_edition_operations_summary(v_edition)->>'edition_id' <> v_edition::text THEN RAISE EXCEPTION 'service role denied'; END IF;

  PERFORM set_config('request.jwt.claim.role','authenticated', true);
  UPDATE public.festival_editions SET capacity=7777, lifecycle_metadata=jsonb_build_object('is_test_fixture','yes','ticket_summary',jsonb_build_object('capacity','','tickets_sold','unknown')) WHERE id=v_other_edition;
  PERFORM set_config('request.jwt.claim.sub', v_other_owner_user::text, true);
  v_ops := public.festival_edition_operations_summary(v_other_edition);
  IF (v_ops->'ticket_summary'->>'capacity')::int <> 7777 THEN RAISE EXCEPTION 'production metadata overrode capacity %', v_ops->'ticket_summary'; END IF;
  IF v_ops->'ticket_summary'->>'tickets_sold' IS NOT NULL THEN RAISE EXCEPTION 'missing ticket source should be null %', v_ops->'ticket_summary'; END IF;
  IF v_ops->'ticket_summary'->>'source' <> 'unavailable' THEN RAISE EXCEPTION 'missing ticket source should be unavailable %', v_ops->'ticket_summary'; END IF;
  UPDATE public.festival_editions SET lifecycle_metadata=jsonb_build_object('is_test_fixture',true,'ticket_summary',jsonb_build_object('capacity',10000,'tickets_sold',-1)) WHERE id=v_other_edition;
  v_ops := public.festival_edition_operations_summary(v_other_edition);
  IF v_ops->'ticket_summary'->>'tickets_sold' IS NOT NULL THEN RAISE EXCEPTION 'negative fixture tickets should be rejected %', v_ops->'ticket_summary'; END IF;
END $$;

ROLLBACK;
