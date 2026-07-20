BEGIN;
\i supabase/seeds/festival_london_test.sql
\i supabase/seeds/festival_london_test.sql
DO $$
DECLARE
  v_brand uuid := '11111111-1111-4111-8111-111111111111';
  v_edition uuid := '11111111-1111-4111-8111-111111111112';
  v_count int;
  v_ops jsonb;
  v_fin jsonb;
BEGIN
  IF (SELECT count(*) FROM public.festivals WHERE metadata->>'fixture_key'='RM-LONDON-TEST-FESTIVAL') <> 1 THEN RAISE EXCEPTION 'fixture brand count mismatch'; END IF;
  IF (SELECT count(*) FROM public.festival_editions WHERE id=v_edition AND festival_id=v_brand AND start_at > now()) <> 1 THEN RAISE EXCEPTION 'fixture edition missing or not upcoming'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.festival_editions e JOIN public.cities c ON c.id=e.city_id WHERE e.id=v_edition AND lower(c.name)='london') THEN RAISE EXCEPTION 'fixture edition does not resolve to London'; END IF;
  IF (SELECT count(*) FROM public.cities WHERE lower(name)='london') < 1 THEN RAISE EXCEPTION 'London city missing'; END IF;
  IF (SELECT count(*) FROM public.festival_stages WHERE edition_id=v_edition AND archived_at IS NULL) <> 3 THEN RAISE EXCEPTION 'stage count mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_stage_slots a JOIN public.festival_stage_slots b ON a.stage_id=b.stage_id AND a.id<b.id WHERE a.edition_id=v_edition AND b.edition_id=v_edition AND tstzrange(a.start_time,a.end_time,'[)') && tstzrange(b.start_time,b.end_time,'[)')) THEN RAISE EXCEPTION 'same-stage slot overlap'; END IF;
  SELECT count(*) INTO v_count FROM public.festival_stage_slots WHERE edition_id=v_edition; IF v_count <> 24 THEN RAISE EXCEPTION 'slot count mismatch %', v_count; END IF;
  IF (SELECT count(*) FROM public.festival_stage_slots WHERE edition_id=v_edition AND status='confirmed') <> 15 THEN RAISE EXCEPTION 'occupied slot count mismatch'; END IF;
  IF (SELECT count(*) FROM public.festival_stage_slots WHERE edition_id=v_edition AND status='open') <> 9 THEN RAISE EXCEPTION 'empty slot count mismatch'; END IF;
  IF (SELECT count(*) FROM public.festival_system_acts WHERE edition_id=v_edition) <> 15 THEN RAISE EXCEPTION 'system act count mismatch'; END IF;
  IF (SELECT capacity FROM public.festival_editions WHERE id=v_edition) <> 10000 THEN RAISE EXCEPTION 'capacity mismatch'; END IF;
  v_fin := public.festival_edition_finance_summary(v_edition);
  IF (v_fin->>'budget_cents')::bigint <> 25000000 OR (v_fin->>'committed_cost_cents')::bigint <> 11000000 OR v_fin->>'currency' <> 'GBP' THEN RAISE EXCEPTION 'finance summary mismatch %', v_fin; END IF;
  IF (SELECT count(*) FROM public.festival_permits WHERE edition_id=v_edition AND status='approved') <> 4 THEN RAISE EXCEPTION 'permit approvals mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.festival_insurance_policies p JOIN public.festival_editions e ON e.id=p.edition_id WHERE p.edition_id=v_edition AND p.active AND p.policy_status='pending_payment' AND p.effective_from <= e.start_at::date AND p.effective_to >= e.end_at::date) THEN RAISE EXCEPTION 'canonical insurance missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_participants fp WHERE fp.festival_id=v_brand) THEN RAISE EXCEPTION 'forbidden legacy festival_participants write'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_festival_editions WHERE id=v_edition) THEN RAISE EXCEPTION 'public projection missing'; END IF;
END $$;
ROLLBACK;
