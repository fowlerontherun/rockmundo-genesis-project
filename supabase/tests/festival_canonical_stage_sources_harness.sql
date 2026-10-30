\set ON_ERROR_STOP on
-- Execute on a disposable DB AFTER installing stage event, stage action,
-- crowd ledger and public projection files in that order.
BEGIN;
DO $tests$
DECLARE
  v_slug text;
  v_status jsonb;
BEGIN
  IF to_regclass('private.festival_edition_stage_events') IS NULL
     OR to_regclass('private.festival_edition_stage_action_receipts') IS NULL
     OR to_regclass('private.festival_edition_stage_crowd_observations') IS NULL
  THEN RAISE EXCEPTION 'canonical_stage_tables_absent'; END IF;
  IF to_regprocedure('public.record_canonical_festival_stage_action(uuid,uuid,uuid,text,text,integer)') IS NULL
     OR to_regprocedure('public.get_canonical_festival_stage_control(uuid)') IS NULL
     OR to_regprocedure('public.get_public_festival_edition_live_status(text)') IS NULL
  THEN RAISE EXCEPTION 'canonical_stage_rpcs_absent'; END IF;
  IF has_function_privilege('anon','public.record_canonical_festival_stage_action(uuid,uuid,uuid,text,text,integer)','EXECUTE')
     OR has_function_privilege('anon','public.get_canonical_festival_stage_control(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.record_canonical_festival_stage_action(uuid,uuid,uuid,text,text,integer)','EXECUTE')
  THEN RAISE EXCEPTION 'canonical_stage_rpc_permissions_invalid'; END IF;
  IF has_table_privilege('anon','private.festival_edition_stage_events','SELECT')
     OR has_table_privilege('authenticated','private.festival_edition_stage_events','SELECT')
     OR has_table_privilege('anon','private.festival_edition_stage_crowd_observations','SELECT')
     OR has_table_privilege('authenticated','private.festival_edition_stage_crowd_observations','SELECT')
     OR has_table_privilege('authenticated','private.festival_edition_stage_action_receipts','INSERT')
  THEN RAISE EXCEPTION 'canonical_stage_ledger_privilege_leak'; END IF;
  IF public.get_public_festival_edition_live_status('nonexistent-festival-99999') IS NOT NULL
  THEN RAISE EXCEPTION 'canonical_public_unknown_slug_leak'; END IF;
  SELECT coalesce(l.public_slug,p.public_slug) INTO v_slug
  FROM public.festival_launches l
  LEFT JOIN public.festival_public_profiles p ON p.festival_company_id=l.festival_company_id
  WHERE l.public_visibility IN ('public','unlisted')
    AND l.launch_status IN ('launched','tickets_on_sale','sales_paused','sales_closed')
    AND coalesce(l.public_slug,p.public_slug) IS NOT NULL
  LIMIT 1;
  IF v_slug IS NOT NULL THEN
    v_status:=public.get_public_festival_edition_live_status(v_slug);
    IF v_status IS NOT NULL AND
      (v_status ?| ARRAY['readiness','sales','staff','sponsors','incidents','permissions',
                       'generatedSchedule','observedAudience','exactHeadcount'])
    THEN RAISE EXCEPTION 'canonical_public_private_fields_exposed'; END IF;
    IF v_status->>'currentDay' IS NULL AND
      (v_status->'performances'<>'[]'::jsonb OR v_status->'stageCrowds'<>'[]'::jsonb)
    THEN RAISE EXCEPTION 'canonical_public_old_day_stage_activity_exposed'; END IF;
  END IF;
END;
$tests$;
ROLLBACK;
