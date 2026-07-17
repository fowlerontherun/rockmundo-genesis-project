-- Phase 2A scheduling harness: executable smoke assertions for schema/RPC presence.
CREATE OR REPLACE FUNCTION phase2a_assert(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT cond THEN RAISE EXCEPTION '%', msg; END IF; END $$;
SELECT phase2a_assert(to_regclass('public.festival_schedule_revisions') IS NOT NULL, 'schedule revisions table exists');
SELECT phase2a_assert(to_regclass('public.festival_schedule_items') IS NOT NULL, 'schedule items table exists');
SELECT phase2a_assert(to_regclass('public.festival_stage_operating_hours') IS NOT NULL, 'stage operating hours table exists');
SELECT phase2a_assert(to_regprocedure('public.festival_edition_schedule_workspace(uuid)') IS NOT NULL, 'workspace RPC exists');
SELECT phase2a_assert(to_regprocedure('public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text)') IS NOT NULL, 'item mutation RPC exists');
SELECT phase2a_assert(to_regprocedure('public.festival_schedule_preview_template(uuid,uuid,date,text,time,time)') IS NOT NULL, 'template preview RPC exists');
SELECT phase2a_assert(to_regprocedure('public.festival_schedule_apply_template(uuid,uuid,uuid,date,text,time,time,boolean,text)') IS NOT NULL, 'template apply RPC exists');
SELECT phase2a_assert(to_regprocedure('public.festival_schedule_publish(uuid,uuid,boolean,text)') IS NOT NULL, 'publish RPC exists');
SELECT phase2a_assert(to_regprocedure('public.public_festival_edition_schedule(uuid)') IS NOT NULL, 'public projection RPC exists');
DROP FUNCTION phase2a_assert(boolean,text);
