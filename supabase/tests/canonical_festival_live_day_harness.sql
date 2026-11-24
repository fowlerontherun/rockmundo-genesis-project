-- Run after canonical_festival_live_day_fixture.sql and its migration on an empty disposable DB.
BEGIN;
DO $$
DECLARE
 owner_id uuid := gen_random_uuid();
 visitor_id uuid := gen_random_uuid();
 company_id uuid := gen_random_uuid();
 edition_id uuid := gen_random_uuid();
 city_id uuid := gen_random_uuid();
 site_id uuid := gen_random_uuid();
 stage_a uuid := gen_random_uuid();
 stage_b uuid := gen_random_uuid();
 runtime_id uuid;
 item_id uuid;
 request_id uuid := gen_random_uuid();
 start_key uuid := gen_random_uuid();
 local_day date := (now() AT TIME ZONE 'Europe/London')::date;
 counts jsonb;
 projection jsonb;
BEGIN
 INSERT INTO public.cities VALUES (city_id,'Europe/London');
 INSERT INTO public.festival_companies VALUES (company_id,owner_id);
 INSERT INTO public.festival_editions_v2(id,festival_company_id,city_id,status,starts_on,ends_on,duration_days)
 VALUES (edition_id,company_id,city_id,'announced',local_day,local_day,1);
 INSERT INTO public.festival_site_plans VALUES (site_id,edition_id,company_id,100);
 INSERT INTO public.festival_site_plan_stages VALUES
 (stage_a,site_id,'Main','ready',1,40),(stage_b,site_id,'Second','ready',2,30);
 INSERT INTO public.festival_launches VALUES (gen_random_uuid(),company_id,'fixture','public','launched');

 IF has_function_privilege('anon','public.start_canonical_festival_live_day(uuid,uuid,integer,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.advance_canonical_festival_live_day(uuid,integer,uuid,text,integer,integer,jsonb,integer)','EXECUTE')
    OR has_table_privilege('authenticated','public.festival_edition_runtimes','UPDATE')
    OR has_table_privilege('authenticated','public.festival_runtime_evidence','SELECT')
    OR has_table_privilege('authenticated','private.festival_edition_stage_crowd_observations','SELECT')
 THEN RAISE EXCEPTION 'fixture privilege leak'; END IF;

 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 projection := public.start_canonical_festival_live_day(company_id,edition_id,1,start_key);
 runtime_id := (projection->>'id')::uuid;
 IF projection->>'state' <> 'gates_open'
    OR public.start_canonical_festival_live_day(company_id,edition_id,1,start_key)->>'id' <> runtime_id::text
 THEN RAISE EXCEPTION 'fixture start or retry failed'; END IF;

 counts := jsonb_build_object(stage_a,15,stage_b,5);
 BEGIN
   PERFORM public.advance_canonical_festival_live_day(runtime_id,1,request_id,'tick',25,0,counts,4);
   RAISE EXCEPTION 'fixture accepted nonconserved attendance';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'festival_live_attendance_not_conserved' THEN RAISE; END IF;
 END;
 PERFORM public.advance_canonical_festival_live_day(runtime_id,1,request_id,'tick',25,0,counts,5);
 PERFORM public.advance_canonical_festival_live_day(runtime_id,1,request_id,'tick',25,0,counts,5);
 PERFORM public.advance_canonical_festival_live_day(runtime_id,2,gen_random_uuid(),'tick',0,0,counts,5);
 projection := public.get_public_festival_edition_live_status('fixture');
 IF jsonb_array_length(projection->'stageCrowds') IS DISTINCT FROM 2
    OR projection::text ~ '"(audienceTotal|observedAudience|otherZones|onsite)"'
    OR projection->'performances' IS DISTINCT FROM '[]'::jsonb
 THEN RAISE EXCEPTION 'fixture public crowd or scheduled-only privacy failed: %',projection; END IF;

 PERFORM set_config('request.jwt.claim.sub',visitor_id::text,true);
 BEGIN
   PERFORM public.advance_canonical_festival_live_day(runtime_id,1,request_id,'tick',25,0,counts,5);
   RAISE EXCEPTION 'fixture cross-owner replay allowed';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'festival_runtime_forbidden' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM public.advance_canonical_festival_live_day(runtime_id,3,gen_random_uuid(),'start_live');
 SELECT (item->>'id')::uuid INTO item_id
 FROM public.festival_edition_runtimes r CROSS JOIN LATERAL jsonb_array_elements(r.generated_schedule->'items') item
 WHERE r.id=runtime_id AND item->>'stageId'=stage_a::text LIMIT 1;
 PERFORM public.record_canonical_festival_stage_action(runtime_id,stage_a,item_id,'ready',gen_random_uuid()::text,4);
 PERFORM public.record_canonical_festival_stage_action(runtime_id,stage_a,item_id,'starting',gen_random_uuid()::text,4);
 PERFORM public.record_canonical_festival_stage_action(runtime_id,stage_a,item_id,'live',gen_random_uuid()::text,4);
 projection := public.get_public_festival_edition_live_status('fixture');
 IF projection #>> '{performances,0,status}' IS DISTINCT FROM 'live' THEN
   RAISE EXCEPTION 'fixture public stage confirmation missing: %',projection;
 END IF;
 PERFORM public.record_canonical_festival_stage_action(runtime_id,stage_a,item_id,'completed',gen_random_uuid()::text,4);
 PERFORM public.advance_canonical_festival_live_day(runtime_id,4,gen_random_uuid(),'pause');
 PERFORM public.advance_canonical_festival_live_day(runtime_id,5,gen_random_uuid(),'resume');
 PERFORM public.advance_canonical_festival_live_day(runtime_id,6,gen_random_uuid(),'close');

 IF EXISTS (SELECT 1 FROM public.fixture_settlements) THEN RAISE EXCEPTION 'fixture settled too early'; END IF;
 PERFORM public.advance_canonical_festival_live_day(runtime_id,7,gen_random_uuid(),'tick',0,25);
 request_id := gen_random_uuid();
 PERFORM public.advance_canonical_festival_live_day(runtime_id,8,request_id,'finish');
 PERFORM public.advance_canonical_festival_live_day(runtime_id,8,request_id,'finish');
 IF (SELECT count(*) FROM public.fixture_settlements) <> 1
    OR (SELECT count(*) FROM public.festival_runtime_evidence WHERE evidence_type='live_day_tick') <> 3
    OR (SELECT count(*) FROM private.festival_edition_stage_crowd_observations) <> 4
 THEN RAISE EXCEPTION 'fixture duplicate or missing settlement/evidence'; END IF;
END;
$$;
ROLLBACK;
