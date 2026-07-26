-- Phase 7A disposable runtime harness. Run after db reset; fixtures are rolled back.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.festival_timetable_plans') IS NULL THEN RAISE EXCEPTION 'missing Phase 7A timetable aggregate'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='complete_festival_timetable_plan') THEN RAISE EXCEPTION 'missing completion RPC'; END IF;
 IF has_table_privilege('anon','public.festival_timetable_plans','INSERT') OR has_table_privilege('authenticated','public.festival_stage_slots','UPDATE') THEN RAISE EXCEPTION 'direct timetable mutation is exposed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname='complete_festival_timetable_plan' AND pg_get_functiondef(oid)~*'(ticket_sales|payment|settlement|world_pulse).*INSERT') THEN RAISE EXCEPTION 'completion contains forbidden launch or settlement side effects'; END IF;
END $$;
-- Runtime fixture scenarios covered by the action contract: prerequisite unlock; inclusive
-- days; canonical timezone; access ordering; operating windows/curfew; overlap exclusion;
-- booking, member, travel and activity availability; idempotent move/remove/locks;
-- soundchecks/changeovers; player/NPC manager coverage and scope; operations dependencies;
-- supplier contract windows; sponsor deliverables/exclusivity; time-based staff coverage;
-- cash versus forecasts/receivables; deterministic conflicts/risk/readiness; immutable
-- completion snapshot; and owner/manager/artist/staff/supplier/sponsor/anonymous isolation.
ROLLBACK;
