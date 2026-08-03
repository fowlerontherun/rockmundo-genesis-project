CREATE TABLE public.festival_scale_catalogue (
  key text PRIMARY KEY, display_name text NOT NULL, description text NOT NULL,
  minimum_capacity integer NOT NULL CHECK (minimum_capacity >= 0), maximum_capacity integer NOT NULL CHECK (maximum_capacity >= minimum_capacity),
  maximum_duration_days smallint NOT NULL CHECK (maximum_duration_days BETWEEN 1 AND 7), complexity text NOT NULL,
  sort_order smallint NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true
);
INSERT INTO public.festival_scale_catalogue VALUES
 ('local','Local','A community-scale first festival.',500,2500,2,'Low',1,true),
 ('small','Small','A focused regional festival.',2000,7500,3,'Moderate',2,true),
 ('medium','Medium','A multi-day destination event.',6000,20000,4,'High',3,true),
 ('large','Large','A nationally significant festival.',15000,50000,5,'Very high',4,true),
 ('major','Major','A landmark international festival.',40000,120000,7,'Extreme',5,true);

CREATE TABLE public.festival_configurations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), festival_company_id uuid NOT NULL UNIQUE REFERENCES public.festival_companies(id) ON DELETE CASCADE,
 public_name text NOT NULL, short_name text, tagline text, description text, home_city_id uuid REFERENCES public.cities(id), festival_scale text REFERENCES public.festival_scale_catalogue(key),
 planned_start_date date, planned_end_date date, duration_days smallint, setup_status text NOT NULL DEFAULT 'not_started', current_step smallint NOT NULL DEFAULT 1,
 configuration_version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 CONSTRAINT festival_configuration_name CHECK (char_length(btrim(public_name)) BETWEEN 3 AND 80 AND public_name=btrim(public_name)),
 CONSTRAINT festival_configuration_short CHECK (short_name IS NULL OR char_length(short_name) BETWEEN 2 AND 24),
 CONSTRAINT festival_configuration_tagline CHECK (tagline IS NULL OR char_length(tagline)<=120),
 CONSTRAINT festival_configuration_description CHECK (description IS NULL OR char_length(description)<=1000),
 CONSTRAINT festival_configuration_status CHECK (setup_status IN ('not_started','in_progress','identity_complete','schedule_complete','draft_complete','ready_for_planning')),
 CONSTRAINT festival_configuration_step CHECK (current_step BETWEEN 1 AND 4),
 CONSTRAINT festival_configuration_version_positive CHECK (configuration_version >= 1),
 CONSTRAINT festival_configuration_dates CHECK ((planned_start_date IS NULL AND planned_end_date IS NULL AND duration_days IS NULL) OR (planned_start_date IS NOT NULL AND planned_end_date IS NOT NULL AND planned_end_date>=planned_start_date AND duration_days=(planned_end_date-planned_start_date)+1 AND duration_days BETWEEN 1 AND 7))
);
CREATE UNIQUE INDEX festival_configuration_public_name_unique ON public.festival_configurations(lower(public_name));

CREATE TABLE public.festival_configuration_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
 caller_profile_id uuid NOT NULL REFERENCES public.profiles(id), idempotency_key uuid NOT NULL, payload_hash text NOT NULL, result jsonb, status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','succeeded')),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(festival_company_id,caller_profile_id,idempotency_key)
);

CREATE TABLE public.festival_configuration_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
 configuration_id uuid NOT NULL REFERENCES public.festival_configurations(id) ON DELETE CASCADE, actor_profile_id uuid REFERENCES public.profiles(id), event_type text NOT NULL,
 previous_version integer NOT NULL, new_version integer NOT NULL, changed_fields text[] NOT NULL DEFAULT '{}', metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.festival_scale_catalogue TO service_role;
GRANT ALL ON public.festival_configurations TO service_role;
GRANT ALL ON public.festival_configuration_requests TO service_role;
GRANT ALL ON public.festival_configuration_audit TO service_role;

ALTER TABLE public.festival_scale_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_configuration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_configuration_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_scale_catalogue,public.festival_configurations,public.festival_configuration_requests,public.festival_configuration_audit FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public._festival_configuration_result(p_company_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('festivalCompanyId',fc.id,'legalCompanyName',co.name,'publicName',cfg.public_name,'shortName',coalesce(cfg.short_name,''),'tagline',coalesce(cfg.tagline,''),'description',coalesce(cfg.description,''),
 'homeCity',CASE WHEN ci.id IS NULL THEN NULL ELSE jsonb_build_object('id',ci.id,'name',ci.name,'country',ci.country,'timezone',ci.timezone) END,'festivalScale',cfg.festival_scale,
 'plannedStartDate',cfg.planned_start_date,'plannedEndDate',cfg.planned_end_date,'durationDays',cfg.duration_days,'setupStatus',cfg.setup_status,'currentStep',cfg.current_step,
 'configurationVersion',cfg.configuration_version,'updatedAt',cfg.updated_at,'canWrite',true,
 'scales',(SELECT coalesce(jsonb_agg(jsonb_build_object('key',s.key,'displayName',s.display_name,'description',s.description,'minimumCapacity',s.minimum_capacity,'maximumCapacity',s.maximum_capacity,'maximumDurationDays',s.maximum_duration_days,'complexity',s.complexity) ORDER BY s.sort_order),'[]') FROM public.festival_scale_catalogue s WHERE s.active OR s.key=cfg.festival_scale),
 'cities',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'country',c.country,'timezone',c.timezone) ORDER BY c.country,c.name),'[]') FROM public.cities c))
 FROM public.festival_companies fc JOIN public.companies co ON co.id=fc.company_id JOIN public.festival_configurations cfg ON cfg.festival_company_id=fc.id LEFT JOIN public.cities ci ON ci.id=cfg.home_city_id WHERE fc.id=p_company_id
$$;

CREATE OR REPLACE FUNCTION public.get_festival_configuration(p_festival_company_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_profile uuid:=public._caller_profile_id(); v_fc public.festival_companies%ROWTYPE;
BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_fc FROM public.festival_companies WHERE id=p_festival_company_id; IF NOT FOUND THEN RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE='P0001'; END IF;
 IF v_fc.owner_profile_id IS DISTINCT FROM v_profile AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.festival_configurations(festival_company_id,public_name,description) VALUES(v_fc.id,btrim(v_fc.public_name),v_fc.description) ON CONFLICT(festival_company_id) DO NOTHING;
 RETURN public._festival_configuration_result(v_fc.id); END $$;

CREATE OR REPLACE FUNCTION public.save_festival_configuration(p_festival_company_id uuid,p_expected_version integer,p_configuration jsonb,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_profile uuid:=public._caller_profile_id(); v_fc public.festival_companies%ROWTYPE; v_cfg public.festival_configurations%ROWTYPE; v_req public.festival_configuration_requests%ROWTYPE; v_hash text; v_name text:=btrim(coalesce(p_configuration->>'publicName','')); v_start date; v_end date; v_duration int; v_scale text:=nullif(p_configuration->>'festivalScale',''); v_city uuid; v_complete boolean:=coalesce((p_configuration->>'complete')::boolean,false); v_result jsonb;
BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001'; END IF;
 SELECT * INTO v_fc FROM public.festival_companies WHERE id=p_festival_company_id; IF NOT FOUND THEN RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE='P0001'; END IF;
 IF v_fc.owner_profile_id IS DISTINCT FROM v_profile AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_festival_company_id::text||p_idempotency_key::text,0)); v_hash:=encode(digest(p_configuration::text||'|'||p_expected_version,'sha256'),'hex');
 SELECT * INTO v_req FROM public.festival_configuration_requests WHERE festival_company_id=p_festival_company_id AND caller_profile_id=v_profile AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF FOUND THEN IF v_req.payload_hash<>v_hash THEN RAISE EXCEPTION 'festival_configuration_idempotency_conflict' USING ERRCODE='P0001'; END IF; IF v_req.status='succeeded' THEN RETURN v_req.result; END IF; END IF;
 IF char_length(v_name) NOT BETWEEN 3 AND 80 THEN RAISE EXCEPTION 'festival_configuration_invalid' USING ERRCODE='P0001'; END IF;
 IF char_length(btrim(coalesce(p_configuration->>'shortName',''))) > 24 OR char_length(btrim(coalesce(p_configuration->>'tagline',''))) > 120 OR char_length(btrim(coalesce(p_configuration->>'description',''))) > 1000 THEN RAISE EXCEPTION 'festival_configuration_invalid' USING ERRCODE='P0001'; END IF;
 IF nullif(p_configuration->>'homeCityId','') IS NOT NULL THEN v_city:=(p_configuration->>'homeCityId')::uuid; IF NOT EXISTS(SELECT 1 FROM public.cities WHERE id=v_city) THEN RAISE EXCEPTION 'festival_city_invalid' USING ERRCODE='P0001'; END IF; END IF;
 IF v_scale IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.festival_scale_catalogue WHERE key=v_scale AND active) THEN RAISE EXCEPTION 'festival_scale_invalid' USING ERRCODE='P0001'; END IF;
 IF nullif(p_configuration->>'plannedStartDate','') IS NOT NULL OR nullif(p_configuration->>'plannedEndDate','') IS NOT NULL THEN v_start:=(p_configuration->>'plannedStartDate')::date; v_end:=(p_configuration->>'plannedEndDate')::date; v_duration:=v_end-v_start+1; IF v_start<CURRENT_DATE OR v_duration<1 OR NOT EXISTS(SELECT 1 FROM public.festival_scale_catalogue WHERE key=v_scale AND active AND maximum_duration_days>=v_duration) THEN RAISE EXCEPTION 'festival_dates_invalid' USING ERRCODE='P0001'; END IF; END IF;
 INSERT INTO public.festival_configurations(festival_company_id,public_name,description) VALUES(v_fc.id,btrim(v_fc.public_name),v_fc.description) ON CONFLICT(festival_company_id) DO NOTHING;
 SELECT * INTO v_cfg FROM public.festival_configurations WHERE festival_company_id=p_festival_company_id FOR UPDATE; IF v_cfg.configuration_version<>p_expected_version THEN RAISE EXCEPTION 'festival_configuration_stale' USING ERRCODE='P0001'; END IF;
 IF v_complete AND (v_city IS NULL OR v_scale IS NULL OR v_start IS NULL) THEN RAISE EXCEPTION 'festival_configuration_invalid' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.festival_configuration_requests(festival_company_id,caller_profile_id,idempotency_key,payload_hash) VALUES(p_festival_company_id,v_profile,p_idempotency_key,v_hash);
 UPDATE public.festival_configurations SET public_name=v_name,short_name=nullif(btrim(p_configuration->>'shortName'),''),tagline=nullif(btrim(p_configuration->>'tagline'),''),description=nullif(btrim(p_configuration->>'description'),''),home_city_id=v_city,festival_scale=v_scale,planned_start_date=v_start,planned_end_date=v_end,duration_days=v_duration,current_step=greatest(1,least(4,coalesce((p_configuration->>'currentStep')::int,1))),setup_status=CASE WHEN v_complete THEN 'ready_for_planning' WHEN v_start IS NOT NULL THEN 'schedule_complete' WHEN v_city IS NOT NULL THEN 'identity_complete' ELSE 'in_progress' END,configuration_version=configuration_version+1,updated_at=now(),completed_at=CASE WHEN v_complete THEN coalesce(completed_at,now()) ELSE NULL END WHERE id=v_cfg.id AND configuration_version=p_expected_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'festival_configuration_stale' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.festival_configuration_audit(festival_company_id,configuration_id,actor_profile_id,event_type,previous_version,new_version,changed_fields) VALUES(p_festival_company_id,v_cfg.id,v_profile,CASE WHEN v_complete THEN 'draft_completed' ELSE 'configuration_updated' END,v_cfg.configuration_version,v_cfg.configuration_version+1,ARRAY['identity','location','schedule']);
 v_result:=public._festival_configuration_result(p_festival_company_id); UPDATE public.festival_configuration_requests SET status='succeeded',result=v_result,completed_at=now() WHERE festival_company_id=p_festival_company_id AND caller_profile_id=v_profile AND idempotency_key=p_idempotency_key; RETURN v_result;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'festival_name_conflict' USING ERRCODE='P0001'; END $$;

REVOKE ALL ON FUNCTION public._festival_configuration_result(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_festival_configuration(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_festival_configuration(uuid,integer,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_festival_configuration(uuid),public.save_festival_configuration(uuid,integer,jsonb,uuid) TO authenticated;
COMMENT ON TABLE public.festival_configurations IS 'Fail-closed festival draft configuration; writes are only accepted by save_festival_configuration.';
COMMENT ON TABLE public.festival_configuration_requests IS 'Caller/company-scoped idempotency receipts.';
NOTIFY pgrst,'reload schema';