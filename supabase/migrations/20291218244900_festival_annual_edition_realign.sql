-- Realign replacement Festival planning around the existing canonical festival_editions_v2.
-- Additive only: legacy, runtime, settlement and history tables are intentionally untouched.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.rockmundo_game_year(p_at timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_days integer; v_epoch date := date '2026-01-01';
BEGIN
 SELECT real_world_days_per_game_year INTO v_days FROM public.game_calendar_config WHERE is_active ORDER BY updated_at DESC,id LIMIT 1;
 IF v_days IS NULL OR v_days < 1 THEN RAISE EXCEPTION 'game_calendar_unavailable' USING ERRCODE='P0001'; END IF;
 RETURN greatest(1, floor((p_at::date-v_epoch)::numeric/v_days)::integer+1);
END $$;
REVOKE ALL ON FUNCTION public.rockmundo_game_year(timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rockmundo_game_year(timestamptz) TO authenticated,service_role;
COMMENT ON FUNCTION public.rockmundo_game_year(timestamptz) IS 'Canonical server game-year authority: 2026-01-01 is year 1 and cadence comes from active game_calendar_config.';

ALTER TABLE public.festival_editions_v2
 ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS locked_at timestamptz,
 ADD COLUMN IF NOT EXISTS expected_capacity integer,
 ADD COLUMN IF NOT EXISTS festival_scale text REFERENCES public.festival_scale_catalogue(key),
 ADD COLUMN IF NOT EXISTS creation_source text NOT NULL DEFAULT 'legacy' CHECK (creation_source IN ('setup','next_annual','migration','legacy'));
ALTER TABLE public.festival_editions_v2 DROP CONSTRAINT IF EXISTS festival_editions_v2_duration_matches_dates;
ALTER TABLE public.festival_editions_v2 ADD CONSTRAINT festival_editions_v2_duration_matches_dates CHECK
 ((starts_on IS NULL AND ends_on IS NULL) OR (starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on>=starts_on AND duration_days=(ends_on-starts_on)+1));
ALTER TABLE public.festival_editions_v2 DROP CONSTRAINT IF EXISTS festival_editions_v2_festival_company_id_edition_year_key;
CREATE UNIQUE INDEX IF NOT EXISTS festival_editions_v2_one_live_year
 ON public.festival_editions_v2(festival_company_id,edition_year) WHERE status <> 'cancelled';

CREATE TABLE public.festival_vibe_catalogue(key text PRIMARY KEY,display_name text NOT NULL,description text NOT NULL,sort_order smallint UNIQUE NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE TABLE public.festival_site_type_catalogue(key text PRIMARY KEY,display_name text NOT NULL,description text NOT NULL,sort_order smallint UNIQUE NOT NULL,active boolean NOT NULL DEFAULT true);
CREATE TABLE public.festival_environmental_policy_catalogue(key text PRIMARY KEY,display_name text NOT NULL,description text NOT NULL,sort_order smallint UNIQUE NOT NULL,active boolean NOT NULL DEFAULT true);
INSERT INTO public.festival_vibe_catalogue VALUES ('community','Community','Welcoming and locally rooted.',1,true),('alternative','Alternative','Independent and discovery-led.',2,true),('mainstream','Mainstream','Broad, high-energy appeal.',3,true),('premium','Premium','Curated hospitality-led experience.',4,true);
INSERT INTO public.festival_site_type_catalogue VALUES ('indoor','Indoor','Weather-protected venue approach.',1,true),('outdoor','Outdoor','Open-air festival site.',2,true),('mixed','Mixed','Combined indoor and outdoor site.',3,true);
INSERT INTO public.festival_environmental_policy_catalogue VALUES ('standard','Standard','Meet baseline environmental requirements.',1,true),('responsible','Responsible','Reduce waste and travel impact.',2,true),('regenerative','Regenerative','Invest in measurable positive impact.',3,true);
ALTER TABLE public.festival_vibe_catalogue ENABLE ROW LEVEL SECURITY; ALTER TABLE public.festival_site_type_catalogue ENABLE ROW LEVEL SECURITY; ALTER TABLE public.festival_environmental_policy_catalogue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_vibe_catalogue,public.festival_site_type_catalogue,public.festival_environmental_policy_catalogue FROM PUBLIC,anon,authenticated;

ALTER TABLE public.festival_configurations
 ADD COLUMN IF NOT EXISTS annual_month smallint CHECK(annual_month BETWEEN 1 AND 12),
 ADD COLUMN IF NOT EXISTS country_code text,
 ADD COLUMN IF NOT EXISTS vibe text REFERENCES public.festival_vibe_catalogue(key),
 ADD COLUMN IF NOT EXISTS site_type text REFERENCES public.festival_site_type_catalogue(key),
 ADD COLUMN IF NOT EXISTS environmental_policy text REFERENCES public.festival_environmental_policy_catalogue(key),
 ADD COLUMN IF NOT EXISTS festival_edition_id uuid REFERENCES public.festival_editions_v2(id);
ALTER TABLE public.festival_configurations DROP CONSTRAINT IF EXISTS festival_configuration_step;
ALTER TABLE public.festival_configurations ADD CONSTRAINT festival_configuration_step CHECK(current_step BETWEEN 1 AND 6);

-- Root occurrence aggregates become edition-addressable. Existing unique company keys remain
-- temporarily as compatibility guards; all new canonical writes use edition identity.
ALTER TABLE public.festival_site_plans ADD COLUMN IF NOT EXISTS festival_edition_id uuid REFERENCES public.festival_editions_v2(id);
ALTER TABLE public.festival_ticket_plans ADD COLUMN IF NOT EXISTS festival_edition_id uuid REFERENCES public.festival_editions_v2(id);
ALTER TABLE public.festival_artist_programmes ADD COLUMN IF NOT EXISTS festival_edition_id uuid REFERENCES public.festival_editions_v2(id);
ALTER TABLE public.festival_operations_plans ADD COLUMN IF NOT EXISTS festival_edition_id uuid REFERENCES public.festival_editions_v2(id);
ALTER TABLE public.festival_sponsorship_plans ADD COLUMN IF NOT EXISTS festival_edition_id uuid REFERENCES public.festival_editions_v2(id);
ALTER TABLE public.festival_timetable_plans ADD COLUMN IF NOT EXISTS festival_edition_id uuid REFERENCES public.festival_editions_v2(id);
CREATE UNIQUE INDEX IF NOT EXISTS festival_site_plans_edition_unique ON public.festival_site_plans(festival_edition_id) WHERE festival_edition_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_ticket_plans_edition_unique ON public.festival_ticket_plans(festival_edition_id) WHERE festival_edition_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_artist_programmes_edition_unique ON public.festival_artist_programmes(festival_edition_id) WHERE festival_edition_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_operations_plans_edition_unique ON public.festival_operations_plans(festival_edition_id) WHERE festival_edition_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_sponsorship_plans_edition_unique ON public.festival_sponsorship_plans(festival_edition_id) WHERE festival_edition_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_timetable_plans_edition_unique ON public.festival_timetable_plans(festival_edition_id) WHERE festival_edition_id IS NOT NULL;

CREATE TABLE public.festival_edition_creation_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),action text NOT NULL CHECK(action IN('complete_setup','plan_next')),
 idempotency_key uuid NOT NULL,payload_hash text NOT NULL,status text NOT NULL DEFAULT 'processing' CHECK(status IN('processing','succeeded')),festival_edition_id uuid REFERENCES public.festival_editions_v2(id),result jsonb,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 UNIQUE(festival_company_id,actor_profile_id,action,idempotency_key));
CREATE TABLE public.festival_edition_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id),actor_profile_id uuid REFERENCES public.profiles(id),event_type text NOT NULL,previous_version integer,new_version integer NOT NULL,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.festival_edition_migration_review(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),festival_company_id uuid REFERENCES public.festival_companies(id),source_table text NOT NULL,source_id uuid,classification text NOT NULL CHECK(classification IN('linked','created_migration_edition','ambiguous','unmapped','company_year_conflict')),festival_edition_id uuid REFERENCES public.festival_editions_v2(id),evidence jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(source_table,source_id));
ALTER TABLE public.festival_edition_creation_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE public.festival_edition_audit ENABLE ROW LEVEL SECURITY; ALTER TABLE public.festival_edition_migration_review ENABLE ROW LEVEL SECURITY;
CREATE POLICY festival_edition_audit_owner_read ON public.festival_edition_audit FOR SELECT USING(EXISTS(SELECT 1 FROM public.festival_companies fc WHERE fc.id=festival_company_id AND (fc.owner_profile_id=public._caller_profile_id() OR coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false))));
CREATE POLICY festival_edition_migration_admin_read ON public.festival_edition_migration_review FOR SELECT USING(coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false));
REVOKE ALL ON public.festival_edition_creation_requests,public.festival_edition_audit,public.festival_edition_migration_review FROM PUBLIC,anon,authenticated;

-- Deterministic compatibility migration: only a company with exactly one plausible edition is linked.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['festival_configurations','festival_site_plans','festival_ticket_plans','festival_artist_programmes','festival_operations_plans','festival_sponsorship_plans','festival_timetable_plans'] LOOP
  EXECUTE format('UPDATE public.%I p SET festival_edition_id=e.id FROM public.festival_editions_v2 e WHERE p.festival_company_id=e.festival_company_id AND p.festival_edition_id IS NULL AND 1=(SELECT count(*) FROM public.festival_editions_v2 x WHERE x.festival_company_id=p.festival_company_id)',t);
  EXECUTE format('INSERT INTO public.festival_edition_migration_review(festival_company_id,source_table,source_id,classification,festival_edition_id,evidence) SELECT p.festival_company_id,%L,p.id,CASE WHEN p.festival_edition_id IS NOT NULL THEN %L WHEN (SELECT count(*) FROM public.festival_editions_v2 x WHERE x.festival_company_id=p.festival_company_id)>1 THEN %L ELSE %L END,p.festival_edition_id,jsonb_build_object(%L,(SELECT count(*) FROM public.festival_editions_v2 x WHERE x.festival_company_id=p.festival_company_id)) FROM public.%I p ON CONFLICT(source_table,source_id) DO NOTHING',t,'linked','ambiguous','unmapped','candidateEditions',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.complete_festival_setup_with_edition(p_festival_company_id uuid,p_expected_version integer,p_configuration jsonb,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public._caller_profile_id(); fc public.festival_companies%ROWTYPE; cfg public.festival_configurations%ROWTYPE; req public.festival_edition_creation_requests%ROWTYPE; ed public.festival_editions_v2%ROWTYPE; h text; s date; e date; d int; gy int; city uuid; scale text; vibe text; site text; env text; month int;
BEGIN
 IF auth.uid() IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_festival_company_id::text||p_idempotency_key::text,0));
 SELECT * INTO fc FROM public.festival_companies WHERE id=p_festival_company_id FOR UPDATE;
 IF NOT FOUND OR (fc.owner_profile_id<>actor AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)) THEN RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001'; END IF;
 h:=encode(digest(p_configuration::text,'sha256'),'hex'); SELECT * INTO req FROM public.festival_edition_creation_requests WHERE festival_company_id=fc.id AND actor_profile_id=actor AND action='complete_setup' AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF FOUND THEN IF req.payload_hash<>h THEN RAISE EXCEPTION 'festival_configuration_idempotency_conflict' USING ERRCODE='P0001'; END IF; IF req.status='succeeded' THEN RETURN req.result||jsonb_build_object('idempotent',true); END IF; ELSE INSERT INTO public.festival_edition_creation_requests(festival_company_id,actor_profile_id,action,idempotency_key,payload_hash) VALUES(fc.id,actor,'complete_setup',p_idempotency_key,h) RETURNING * INTO req; END IF;
 SELECT * INTO cfg FROM public.festival_configurations WHERE festival_company_id=fc.id FOR UPDATE; IF NOT FOUND OR cfg.configuration_version<>p_expected_version THEN RAISE EXCEPTION 'festival_configuration_stale' USING ERRCODE='P0001'; END IF;
 s:=(p_configuration->>'plannedStartDate')::date; e:=(p_configuration->>'plannedEndDate')::date; d:=(e-s)+1; city:=(p_configuration->>'homeCityId')::uuid; scale:=p_configuration->>'festivalScale'; vibe:=p_configuration->>'vibe'; site:=p_configuration->>'siteType'; env:=p_configuration->>'environmentalPolicy'; month:=(p_configuration->>'annualMonth')::int; gy:=public.rockmundo_game_year(s::timestamptz);
 IF s IS NULL OR e<s OR d NOT BETWEEN 1 AND 7 OR month NOT BETWEEN 1 AND 12 OR city IS NULL OR NOT EXISTS(SELECT 1 FROM public.cities WHERE id=city) OR NOT EXISTS(SELECT 1 FROM public.festival_scale_catalogue WHERE key=scale AND active) OR NOT EXISTS(SELECT 1 FROM public.festival_vibe_catalogue WHERE key=vibe AND active) OR NOT EXISTS(SELECT 1 FROM public.festival_site_type_catalogue WHERE key=site AND active) OR NOT EXISTS(SELECT 1 FROM public.festival_environmental_policy_catalogue WHERE key=env AND active) THEN RAISE EXCEPTION 'festival_configuration_invalid' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.festival_editions_v2(festival_company_id,edition_year,name,status,starts_on,ends_on,country_code,city_id,vibe,site_type,duration_days,environmental_policy,festival_scale,creation_source)
 VALUES(fc.id,gy,btrim(p_configuration->>'publicName'),'draft',s,e,(SELECT country FROM public.cities WHERE id=city),city,vibe,site,d,env,scale,'setup') RETURNING * INTO ed;
 UPDATE public.festival_companies SET public_name=btrim(p_configuration->>'publicName'),tagline=nullif(btrim(p_configuration->>'tagline'),''),description=nullif(btrim(p_configuration->>'description'),''),annual_month=month,country_code=ed.country_code,default_city_id=city,default_vibe=vibe,default_site_type=site,default_duration_days=d,environmental_policy=env,setup_completed=true,status='active',updated_at=now() WHERE id=fc.id;
 UPDATE public.festival_configurations SET short_name=nullif(btrim(p_configuration->>'shortName'),''),annual_month=month,country_code=ed.country_code,vibe=vibe,site_type=site,environmental_policy=env,festival_edition_id=ed.id,setup_status='ready_for_planning',current_step=6,configuration_version=configuration_version+1,completed_at=now(),updated_at=now() WHERE id=cfg.id;
 INSERT INTO public.festival_edition_audit(festival_company_id,festival_edition_id,actor_profile_id,event_type,new_version,metadata) VALUES(fc.id,ed.id,actor,'first_annual_edition_created',ed.version,jsonb_build_object('editionYear',gy,'source','setup'));
 req.result:=jsonb_build_object('festivalCompanyId',fc.id,'festivalEditionId',ed.id,'editionYear',gy,'status',ed.status,'idempotent',false); UPDATE public.festival_edition_creation_requests SET status='succeeded',festival_edition_id=ed.id,result=req.result,completed_at=now() WHERE id=req.id; RETURN req.result;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'festival_edition_year_exists' USING ERRCODE='P0001'; END $$;

CREATE OR REPLACE FUNCTION public.plan_next_festival_edition(p_festival_company_id uuid,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=public._caller_profile_id(); fc public.festival_companies%ROWTYPE; req public.festival_edition_creation_requests%ROWTYPE; ed public.festival_editions_v2%ROWTYPE; y int; h text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE='P0001'; END IF; PERFORM pg_advisory_xact_lock(hashtextextended(p_festival_company_id::text||p_idempotency_key::text,0));
 SELECT * INTO fc FROM public.festival_companies WHERE id=p_festival_company_id FOR UPDATE; IF NOT FOUND OR fc.status<>'active' OR (fc.owner_profile_id<>actor AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)) THEN RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE='P0001'; END IF;
 y:=greatest(public.rockmundo_game_year(),coalesce((SELECT max(edition_year)+1 FROM public.festival_editions_v2 WHERE festival_company_id=fc.id AND status<>'cancelled'),public.rockmundo_game_year())); h:=encode(digest(fc.id::text||'|'||y::text,'sha256'),'hex');
 SELECT * INTO req FROM public.festival_edition_creation_requests WHERE festival_company_id=fc.id AND actor_profile_id=actor AND action='plan_next' AND idempotency_key=p_idempotency_key FOR UPDATE;
 IF FOUND THEN IF req.payload_hash<>h THEN RAISE EXCEPTION 'festival_edition_idempotency_conflict' USING ERRCODE='P0001'; END IF; IF req.status='succeeded' THEN RETURN req.result||jsonb_build_object('idempotent',true); END IF; ELSE INSERT INTO public.festival_edition_creation_requests(festival_company_id,actor_profile_id,action,idempotency_key,payload_hash) VALUES(fc.id,actor,'plan_next',p_idempotency_key,h) RETURNING * INTO req; END IF;
 INSERT INTO public.festival_editions_v2(festival_company_id,edition_year,name,status,country_code,city_id,vibe,site_type,duration_days,environmental_policy,creation_source) VALUES(fc.id,y,fc.public_name,'draft',fc.country_code,fc.default_city_id,fc.default_vibe,fc.default_site_type,fc.default_duration_days,fc.environmental_policy,'next_annual') RETURNING * INTO ed;
 INSERT INTO public.festival_edition_audit(festival_company_id,festival_edition_id,actor_profile_id,event_type,new_version,metadata) VALUES(fc.id,ed.id,actor,'next_annual_edition_planned',1,jsonb_build_object('editionYear',y)); req.result:=jsonb_build_object('festivalCompanyId',fc.id,'festivalEditionId',ed.id,'editionYear',y,'status','draft','idempotent',false); UPDATE public.festival_edition_creation_requests SET status='succeeded',festival_edition_id=ed.id,result=req.result,completed_at=now() WHERE id=req.id; RETURN req.result;
END $$;
REVOKE ALL ON FUNCTION public.complete_festival_setup_with_edition(uuid,integer,jsonb,uuid),public.plan_next_festival_edition(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_festival_setup_with_edition(uuid,integer,jsonb,uuid),public.plan_next_festival_edition(uuid,uuid) TO authenticated;

CREATE OR REPLACE VIEW public.festival_edition_migration_summary WITH (security_invoker=true) AS SELECT classification,count(*) record_count,count(DISTINCT festival_company_id) company_count FROM public.festival_edition_migration_review GROUP BY classification;
GRANT SELECT ON public.festival_edition_migration_summary TO authenticated;
NOTIFY pgrst,'reload schema';
