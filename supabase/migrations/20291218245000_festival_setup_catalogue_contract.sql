-- Complete the resumable six-step setup contract introduced by annual-edition realignment.
-- Catalogue values and canonical edition identity are returned by the server; browser strings
-- are never treated as category authority.
CREATE OR REPLACE FUNCTION public._festival_configuration_result(p_company_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object(
  'festivalCompanyId',fc.id,'legalCompanyName',co.name,'publicName',cfg.public_name,
  'shortName',coalesce(cfg.short_name,''),'tagline',coalesce(cfg.tagline,''),'description',coalesce(cfg.description,''),
  'homeCity',CASE WHEN ci.id IS NULL THEN NULL ELSE jsonb_build_object('id',ci.id,'name',ci.name,'country',ci.country,'timezone',ci.timezone) END,
  'festivalScale',cfg.festival_scale,'annualMonth',cfg.annual_month,'countryCode',coalesce(cfg.country_code,ci.country),
  'vibe',cfg.vibe,'siteType',cfg.site_type,'environmentalPolicy',cfg.environmental_policy,
  'festivalEditionId',cfg.festival_edition_id,'editionYear',ed.edition_year,
  'plannedStartDate',cfg.planned_start_date,'plannedEndDate',cfg.planned_end_date,'durationDays',cfg.duration_days,
  'setupStatus',cfg.setup_status,'currentStep',cfg.current_step,'configurationVersion',cfg.configuration_version,
  'updatedAt',cfg.updated_at,'canWrite',true,
  'scales',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',s.key,'displayName',s.display_name,'description',s.description,'minimumCapacity',s.minimum_capacity,'maximumCapacity',s.maximum_capacity,'maximumDurationDays',s.maximum_duration_days,'complexity',s.complexity) ORDER BY s.sort_order),'[]') FROM public.festival_scale_catalogue s WHERE s.active OR s.key=cfg.festival_scale),
  'cities',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'country',c.country,'timezone',c.timezone) ORDER BY c.country,c.name),'[]') FROM public.cities c),
  'vibes',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',x.key,'displayName',x.display_name,'description',x.description) ORDER BY x.sort_order),'[]') FROM public.festival_vibe_catalogue x WHERE x.active OR x.key=cfg.vibe),
  'siteTypes',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',x.key,'displayName',x.display_name,'description',x.description) ORDER BY x.sort_order),'[]') FROM public.festival_site_type_catalogue x WHERE x.active OR x.key=cfg.site_type),
  'environmentalPolicies',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',x.key,'displayName',x.display_name,'description',x.description) ORDER BY x.sort_order),'[]') FROM public.festival_environmental_policy_catalogue x WHERE x.active OR x.key=cfg.environmental_policy)
 )
 FROM public.festival_companies fc JOIN public.companies co ON co.id=fc.company_id
 JOIN public.festival_configurations cfg ON cfg.festival_company_id=fc.id
 LEFT JOIN public.cities ci ON ci.id=cfg.home_city_id
 LEFT JOIN public.festival_editions_v2 ed ON ed.id=cfg.festival_edition_id
 WHERE fc.id=p_company_id
$$;
REVOKE ALL ON FUNCTION public._festival_configuration_result(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.save_festival_configuration(p_festival_company_id uuid,p_expected_version integer,p_configuration jsonb,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public._caller_profile_id(); fc public.festival_companies%ROWTYPE; cfg public.festival_configurations%ROWTYPE; req public.festival_configuration_requests%ROWTYPE;
 h text; result jsonb; city uuid; scale text; vibe text; site text; env text; month int; s date; e date; duration int; requested_step int; name text:=btrim(coalesce(p_configuration->>'publicName',''));
BEGIN
 IF auth.uid() IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001'; END IF;
 SELECT * INTO fc FROM public.festival_companies WHERE id=p_festival_company_id;
 IF NOT FOUND OR (fc.owner_profile_id<>actor AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)) THEN RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_festival_company_id::text||p_idempotency_key::text,0));
 h:=encode(digest(p_configuration::text||'|'||p_expected_version,'sha256'),'hex');
 SELECT * INTO req FROM public.festival_configuration_requests WHERE festival_company_id=p_festival_company_id AND caller_profile_id=actor AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF FOUND THEN
  IF req.payload_hash<>h THEN RAISE EXCEPTION 'festival_configuration_idempotency_conflict' USING ERRCODE='P0001'; END IF;
  IF req.status='succeeded' THEN RETURN req.result; END IF;
 END IF;
 IF coalesce((p_configuration->>'complete')::boolean,false) THEN RAISE EXCEPTION 'festival_configuration_completion_requires_edition' USING ERRCODE='P0001'; END IF;
 IF char_length(name) NOT BETWEEN 3 AND 80 OR char_length(btrim(coalesce(p_configuration->>'shortName','')))>24 OR char_length(btrim(coalesce(p_configuration->>'tagline','')))>120 OR char_length(btrim(coalesce(p_configuration->>'description','')))>1000 THEN RAISE EXCEPTION 'festival_configuration_invalid' USING ERRCODE='P0001'; END IF;
 city:=nullif(p_configuration->>'homeCityId','')::uuid; scale:=nullif(p_configuration->>'festivalScale',''); vibe:=nullif(p_configuration->>'vibe',''); site:=nullif(p_configuration->>'siteType',''); env:=nullif(p_configuration->>'environmentalPolicy',''); month:=nullif(p_configuration->>'annualMonth','')::int;
 IF city IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cities WHERE id=city) THEN RAISE EXCEPTION 'festival_city_invalid' USING ERRCODE='P0001'; END IF;
 IF scale IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.festival_scale_catalogue WHERE key=scale AND active) THEN RAISE EXCEPTION 'festival_scale_invalid' USING ERRCODE='P0001'; END IF;
 IF vibe IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.festival_vibe_catalogue WHERE key=vibe AND active) THEN RAISE EXCEPTION 'festival_vibe_invalid' USING ERRCODE='P0001'; END IF;
 IF site IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.festival_site_type_catalogue WHERE key=site AND active) THEN RAISE EXCEPTION 'festival_site_type_invalid' USING ERRCODE='P0001'; END IF;
 IF env IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.festival_environmental_policy_catalogue WHERE key=env AND active) THEN RAISE EXCEPTION 'festival_environmental_policy_invalid' USING ERRCODE='P0001'; END IF;
 IF month IS NOT NULL AND month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'festival_annual_month_invalid' USING ERRCODE='P0001'; END IF;
 s:=nullif(p_configuration->>'plannedStartDate','')::date; e:=nullif(p_configuration->>'plannedEndDate','')::date;
 IF (s IS NULL)<>(e IS NULL) THEN RAISE EXCEPTION 'festival_dates_invalid' USING ERRCODE='P0001'; END IF;
 IF s IS NOT NULL THEN duration:=e-s+1; IF s<CURRENT_DATE OR duration<1 OR NOT EXISTS(SELECT 1 FROM public.festival_scale_catalogue WHERE key=scale AND active AND maximum_duration_days>=duration) THEN RAISE EXCEPTION 'festival_dates_invalid' USING ERRCODE='P0001'; END IF; END IF;
 requested_step:=greatest(1,least(6,coalesce((p_configuration->>'currentStep')::int,1)));
 INSERT INTO public.festival_configurations(festival_company_id,public_name,description) VALUES(fc.id,btrim(fc.public_name),fc.description) ON CONFLICT(festival_company_id) DO NOTHING;
 SELECT * INTO cfg FROM public.festival_configurations WHERE festival_company_id=fc.id FOR UPDATE;
 IF cfg.configuration_version<>p_expected_version OR cfg.completed_at IS NOT NULL THEN RAISE EXCEPTION 'festival_configuration_stale' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.festival_configuration_requests(festival_company_id,caller_profile_id,idempotency_key,payload_hash) VALUES(fc.id,actor,p_idempotency_key,h);
 UPDATE public.festival_configurations SET public_name=name,short_name=nullif(btrim(p_configuration->>'shortName'),''),tagline=nullif(btrim(p_configuration->>'tagline'),''),description=nullif(btrim(p_configuration->>'description'),''),home_city_id=city,festival_scale=scale,annual_month=month,country_code=(SELECT country FROM public.cities WHERE id=city),vibe=vibe,site_type=site,environmental_policy=env,planned_start_date=s,planned_end_date=e,duration_days=duration,current_step=requested_step,setup_status=CASE WHEN s IS NOT NULL THEN 'schedule_complete' WHEN city IS NOT NULL THEN 'identity_complete' ELSE 'in_progress' END,configuration_version=configuration_version+1,updated_at=now() WHERE id=cfg.id AND configuration_version=p_expected_version;
 INSERT INTO public.festival_configuration_audit(festival_company_id,configuration_id,actor_profile_id,event_type,previous_version,new_version,changed_fields) VALUES(fc.id,cfg.id,actor,'configuration_updated',cfg.configuration_version,cfg.configuration_version+1,ARRAY['identity','annual_pattern','location','vibe','site','scale','environmental_policy','schedule']);
 result:=public._festival_configuration_result(fc.id); UPDATE public.festival_configuration_requests SET status='succeeded',result=result,completed_at=now() WHERE festival_company_id=fc.id AND caller_profile_id=actor AND idempotency_key=p_idempotency_key; RETURN result;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'festival_name_conflict' USING ERRCODE='P0001'; END $$;
REVOKE ALL ON FUNCTION public.save_festival_configuration(uuid,integer,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_festival_configuration(uuid,integer,jsonb,uuid) TO authenticated;
COMMENT ON FUNCTION public.save_festival_configuration(uuid,integer,jsonb,uuid) IS 'Resumable draft-only six-step setup save. Atomic completion is exclusively complete_festival_setup_with_edition.';
NOTIFY pgrst,'reload schema';
