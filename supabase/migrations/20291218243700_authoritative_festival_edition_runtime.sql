-- Canonical annual-edition live runtime. This binds the existing authoritative schedule
-- to festival_editions_v2; it deliberately does not duplicate stage or slot authority.
CREATE TYPE public.festival_edition_runtime_state AS ENUM ('preparing','ready','gates_open','live','paused','closing','completed','aborted','recovery_required');
ALTER TABLE public.festival_editions_v2 ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS runtime_inputs jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.festival_edition_runtimes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id), edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id),
 schedule_revision_id uuid NOT NULL REFERENCES public.festival_schedule_revisions(id), upgrade_snapshot_id uuid NOT NULL REFERENCES public.festival_edition_upgrade_snapshots(id),
 licence_snapshot jsonb NOT NULL, state public.festival_edition_runtime_state NOT NULL DEFAULT 'preparing', simulated_time timestamptz NOT NULL,
 runtime_seed text NOT NULL, rules_version text NOT NULL DEFAULT 'festival-edition-runtime-v1', weather_sequence jsonb NOT NULL,
 expected_attendance integer NOT NULL CHECK(expected_attendance>=0), admitted_attendance integer NOT NULL DEFAULT 0 CHECK(admitted_attendance>=0),
 site_attendance integer NOT NULL DEFAULT 0 CHECK(site_attendance>=0), departed_attendance integer NOT NULL DEFAULT 0 CHECK(departed_attendance>=0), site_capacity integer NOT NULL CHECK(site_capacity>=0),
 staff_readiness jsonb NOT NULL DEFAULT '{}', supplier_readiness jsonb NOT NULL DEFAULT '{}', sponsor_readiness jsonb NOT NULL DEFAULT '{}', stage_readiness jsonb NOT NULL DEFAULT '{}',
 financial_evidence_status text NOT NULL DEFAULT 'collecting', performance_evidence_status text NOT NULL DEFAULT 'collecting', version integer NOT NULL DEFAULT 1,
 configuration_version integer NOT NULL DEFAULT 1, recovery_state jsonb NOT NULL DEFAULT '{}', audit_metadata jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz, aborted_at timestamptz,
 CHECK(site_attendance<=site_capacity), CHECK(site_attendance+departed_attendance=admitted_attendance), CHECK(admitted_attendance<=expected_attendance)
);
CREATE UNIQUE INDEX festival_edition_one_active_runtime ON public.festival_edition_runtimes(edition_id) WHERE state NOT IN ('completed','aborted');

CREATE TABLE public.festival_runtime_configuration_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), runtime_id uuid NOT NULL REFERENCES public.festival_edition_runtimes(id), version integer NOT NULL, configuration jsonb NOT NULL,
 configuration_digest text NOT NULL, correction_reason text, created_by_profile_id uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(runtime_id,version)
);
CREATE TABLE public.festival_runtime_ticks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), runtime_id uuid NOT NULL REFERENCES public.festival_edition_runtimes(id), previous_runtime_version integer NOT NULL, tick_number bigint NOT NULL,
 simulated_start timestamptz NOT NULL, simulated_end timestamptz NOT NULL, claim_token uuid NOT NULL, worker_identity text NOT NULL, rules_version text NOT NULL,
 input_digest text NOT NULL, output_digest text, status text NOT NULL CHECK(status IN('claimed','completed','failed')), retry_count integer NOT NULL DEFAULT 0,
 failure_details jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(runtime_id,tick_number), UNIQUE(runtime_id,claim_token)
);
CREATE TABLE public.festival_runtime_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), runtime_id uuid NOT NULL REFERENCES public.festival_edition_runtimes(id), tick_id uuid REFERENCES public.festival_runtime_ticks(id),
 evidence_type text NOT NULL CHECK(evidence_type IN('arrival_cohort','admission','crowd_movement','stage','artist_readiness','performance','staff','supplier','food_drink_sale','merchandise_sale','sponsor_activation','weather','audience_satisfaction','artist_satisfaction','operational_override')),
 stable_entity_id text NOT NULL, evidence jsonb NOT NULL, deterministic_value numeric, evidence_digest text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(runtime_id,evidence_type,stable_entity_id)
);
CREATE TABLE public.festival_runtime_incident_catalogue (code text NOT NULL, version integer NOT NULL, category text NOT NULL CHECK(category IN('medical','security','crowd','weather','technical','power','sanitation','transport','artist','supplier','staff','fire','lost_child','accessibility')), definition jsonb NOT NULL, PRIMARY KEY(code,version));
CREATE TABLE public.festival_edition_runtime_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), runtime_id uuid NOT NULL REFERENCES public.festival_edition_runtimes(id), catalogue_code text NOT NULL, catalogue_version integer NOT NULL,
 severity text NOT NULL CHECK(severity IN('minor','moderate','major','critical')), location_key text NOT NULL, detected_at timestamptz NOT NULL, detection_source text NOT NULL,
 affected_people integer NOT NULL DEFAULT 0, required_response jsonb NOT NULL, assigned_team jsonb, status text NOT NULL CHECK(status IN('detected','acknowledged','assigned','responding','resolved','handed_over')),
 resolution jsonb, costs_minor bigint NOT NULL DEFAULT 0, probability_evidence jsonb NOT NULL, runtime_effect jsonb NOT NULL, public_notice text, version integer NOT NULL DEFAULT 1,
 FOREIGN KEY(catalogue_code,catalogue_version) REFERENCES public.festival_runtime_incident_catalogue(code,version)
);
CREATE TABLE public.festival_runtime_action_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),runtime_id uuid NOT NULL REFERENCES public.festival_edition_runtimes(id),actor_profile_id uuid REFERENCES public.profiles(id),action text NOT NULL,reason text,expected_version integer,idempotency_key uuid NOT NULL,request_digest text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(runtime_id,idempotency_key));
CREATE TABLE public.festival_runtime_completion_digests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),runtime_id uuid UNIQUE NOT NULL REFERENCES public.festival_edition_runtimes(id),schema_version integer NOT NULL,rules_version text NOT NULL,record_counts jsonb NOT NULL,component_hashes jsonb NOT NULL,runtime_digest text NOT NULL,runtime_version integer NOT NULL,worker_identity text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());

CREATE FUNCTION public._festival_edition_runtime_actor() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.current_profile_id_safe() $$;
CREATE FUNCTION public._festival_edition_runtime_authorised(p_company uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.festival_companies c WHERE c.id=p_company AND c.owner_profile_id=public._festival_edition_runtime_actor()) OR public.is_admin(auth.uid())
$$;
CREATE FUNCTION public._festival_runtime_error(p_code text,p_details jsonb DEFAULT '{}') RETURNS void LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION USING MESSAGE=p_code,DETAIL=p_details::text,ERRCODE='P0001'; END $$;

CREATE FUNCTION public.prepare_festival_edition_runtime(p_festival_company_id uuid,p_edition_id uuid,p_expected_edition_version integer,p_expected_schedule_revision uuid,p_idempotency_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_editions_v2%ROWTYPE; r public.festival_edition_runtimes%ROWTYPE; sr public.festival_schedule_revisions%ROWTYPE; us public.festival_edition_upgrade_snapshots%ROWTYPE; old_edition uuid; blockers jsonb:='[]'; cfg jsonb; seed text; actor uuid:=public._festival_edition_runtime_actor();
BEGIN
 IF actor IS NULL OR NOT public._festival_edition_runtime_authorised(p_festival_company_id) THEN PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_ACCESS_DENIED'); END IF;
 SELECT * INTO e FROM public.festival_editions_v2 WHERE id=p_edition_id AND festival_company_id=p_festival_company_id FOR UPDATE;
 IF NOT FOUND THEN PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_NOT_FOUND'); END IF;
 SELECT * INTO r FROM public.festival_edition_runtimes WHERE edition_id=e.id AND state NOT IN('completed','aborted'); IF FOUND THEN RETURN jsonb_build_object('runtimeId',r.id,'state',r.state,'version',r.version,'idempotent',true,'blockers','[]'::jsonb); END IF;
 IF p_expected_edition_version<>e.version THEN blockers:=blockers||jsonb_build_object('code','FESTIVAL_RUNTIME_VERSION_CONFLICT','message','Edition version changed'); END IF;
 SELECT m.edition_id INTO old_edition FROM public.festival_public_legacy_bridges b JOIN public.festival_legacy_mappings m ON m.legacy_id=b.legacy_festival_id OR m.legacy_festival_id=b.legacy_festival_id WHERE b.festival_company_id=e.festival_company_id AND b.festival_edition_id=e.id ORDER BY m.created_at DESC LIMIT 1;
 SELECT * INTO sr FROM public.festival_schedule_revisions WHERE id=p_expected_schedule_revision AND edition_id=old_edition AND state IN('published','locked');
 IF NOT FOUND THEN blockers:=blockers||jsonb_build_object('code','FESTIVAL_RUNTIME_SCHEDULE_INVALID','message','A linked published or locked authoritative schedule is required'); END IF;
 IF sr.state='published' AND sr.locked_at IS NULL THEN blockers:=blockers||jsonb_build_object('code','FESTIVAL_RUNTIME_SCHEDULE_INVALID','message','The published schedule must be locked'); END IF;
 SELECT * INTO us FROM public.festival_edition_upgrade_snapshots WHERE edition_id=e.id AND festival_company_id=e.festival_company_id ORDER BY snapshot_version DESC LIMIT 1;
 IF NOT FOUND THEN blockers:=blockers||jsonb_build_object('code','FESTIVAL_RUNTIME_CRITICAL_BLOCKERS','message','Upgrade and licence snapshot is missing'); END IF;
 IF e.status NOT IN('locked','announced','live') OR e.starts_on IS NULL OR e.ends_on IS NULL THEN blockers:=blockers||jsonb_build_object('code','FESTIVAL_RUNTIME_NOT_READY','message','Edition lifecycle or dates are not runnable'); END IF;
 IF jsonb_array_length(blockers)>0 THEN RETURN jsonb_build_object('runtimeId',NULL,'state','preparing','blockers',blockers); END IF;
 seed:=encode(digest(e.id::text||':'||p_expected_schedule_revision::text||':'||p_idempotency_key::text,'sha256'),'hex');
 cfg:=jsonb_build_object('schemaVersion',1,'scheduleRevision',to_jsonb(sr),'stages',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') FROM public.festival_stages s WHERE s.edition_id=old_edition AND s.archived_at IS NULL),'slots',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.starts_at,i.id),'[]') FROM public.festival_schedule_items i WHERE i.revision_id=sr.id),'contracts',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM public.festival_contracts c WHERE c.edition_id=old_edition),'upgrades',to_jsonb(us),'licence',us.licence_snapshot,'capacity',coalesce((e.runtime_inputs->>'capacity')::integer,0),'weather',coalesce(e.runtime_inputs->'weather','[]'),'staffContracts',coalesce(e.runtime_inputs->'staffContracts','[]'),'supplierContracts',coalesce(e.runtime_inputs->'supplierContracts','[]'),'sponsorContracts',coalesce(e.runtime_inputs->'sponsorContracts','[]'),'operationalPlans',coalesce(e.runtime_inputs->'operationalPlans','{}'),'vendorConfiguration',coalesce(e.runtime_inputs->'vendorConfiguration','{}'),'merchandiseConfiguration',coalesce(e.runtime_inputs->'merchandiseConfiguration','{}'),'rulesVersion','festival-edition-runtime-v1','seed',seed);
 INSERT INTO public.festival_edition_runtimes(festival_company_id,edition_id,schedule_revision_id,upgrade_snapshot_id,licence_snapshot,simulated_time,runtime_seed,weather_sequence,expected_attendance,site_capacity,audit_metadata) VALUES(e.festival_company_id,e.id,sr.id,us.id,us.licence_snapshot,e.starts_on::timestamptz,seed,coalesce(e.runtime_inputs->'weather','[]'),coalesce((e.runtime_inputs->>'ticketsSold')::integer,0),coalesce((e.runtime_inputs->>'capacity')::integer,0),jsonb_build_object('preparedBy',actor)) RETURNING * INTO r;
 INSERT INTO public.festival_runtime_configuration_versions(runtime_id,version,configuration,configuration_digest,created_by_profile_id) VALUES(r.id,1,cfg,encode(digest(cfg::text,'sha256'),'hex'),actor);
 INSERT INTO public.festival_runtime_action_audit(runtime_id,actor_profile_id,action,expected_version,idempotency_key,request_digest,result) VALUES(r.id,actor,'prepare',p_expected_edition_version,p_idempotency_key,encode(digest(cfg::text,'sha256'),'hex'),jsonb_build_object('state',r.state));
 RETURN jsonb_build_object('runtimeId',r.id,'state',r.state,'version',r.version,'idempotent',false,'blockers','[]'::jsonb);
EXCEPTION WHEN unique_violation THEN PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_ALREADY_EXISTS'); RETURN NULL; END $$;

CREATE FUNCTION public.transition_festival_edition_runtime(p_runtime_id uuid,p_expected_version integer,p_action text,p_reason text,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.festival_edition_runtimes%ROWTYPE; target public.festival_edition_runtime_state; allowed boolean; existing jsonb; actor uuid:=public._festival_edition_runtime_actor();
BEGIN
 SELECT result INTO existing FROM public.festival_runtime_action_audit WHERE runtime_id=p_runtime_id AND idempotency_key=p_idempotency_key; IF FOUND THEN RETURN existing||jsonb_build_object('idempotent',true); END IF;
 SELECT * INTO r FROM public.festival_edition_runtimes WHERE id=p_runtime_id FOR UPDATE; IF NOT FOUND THEN PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_NOT_FOUND'); END IF;
 IF actor IS NULL OR NOT public._festival_edition_runtime_authorised(r.festival_company_id) THEN PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_ACCESS_DENIED'); END IF;
 IF r.version<>p_expected_version THEN PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_VERSION_CONFLICT'); END IF;
 target:=CASE p_action WHEN 'confirm_ready' THEN 'ready' WHEN 'open_gates' THEN 'gates_open' WHEN 'start_live' THEN 'live' WHEN 'pause' THEN 'paused' WHEN 'resume' THEN 'live' WHEN 'begin_closing' THEN 'closing' WHEN 'complete' THEN 'completed' WHEN 'abort' THEN 'aborted' WHEN 'require_recovery' THEN 'recovery_required' ELSE NULL END;
 allowed:=CASE r.state WHEN 'preparing' THEN target IN('ready','aborted') WHEN 'ready' THEN target IN('gates_open','aborted') WHEN 'gates_open' THEN target IN('live','recovery_required','aborted') WHEN 'live' THEN target IN('paused','closing','recovery_required','aborted') WHEN 'paused' THEN target IN('live','closing','aborted') WHEN 'closing' THEN target IN('completed','recovery_required') WHEN 'recovery_required' THEN target IN('paused','live','aborted') ELSE false END;
 IF target IS NULL OR NOT allowed THEN PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_INVALID_TRANSITION',jsonb_build_object('from',r.state,'action',p_action)); END IF;
 IF p_action IN('abort','complete') AND length(trim(coalesce(p_reason,'')))<5 THEN PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_CRITICAL_BLOCKERS',jsonb_build_object('reason','required')); END IF;
 IF target='completed' AND (r.site_attendance<>0 OR EXISTS(SELECT 1 FROM public.festival_edition_runtime_incidents i WHERE i.runtime_id=r.id AND i.severity='critical' AND i.status NOT IN('resolved','handed_over'))) THEN PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_COMPLETION_BLOCKED'); END IF;
 UPDATE public.festival_edition_runtimes SET state=target,version=version+1,started_at=CASE WHEN target='live' THEN coalesce(started_at,now()) ELSE started_at END,completed_at=CASE WHEN target='completed' THEN now() END,aborted_at=CASE WHEN target='aborted' THEN now() END WHERE id=r.id RETURNING * INTO r;
 existing:=jsonb_build_object('runtimeId',r.id,'state',r.state,'version',r.version,'idempotent',false);
 INSERT INTO public.festival_runtime_action_audit(runtime_id,actor_profile_id,action,reason,expected_version,idempotency_key,request_digest,result) VALUES(r.id,actor,p_action,p_reason,p_expected_version,p_idempotency_key,encode(digest(p_action||coalesce(p_reason,''),'sha256'),'hex'),existing);
 RETURN existing; END $$;

CREATE FUNCTION public.get_festival_edition_runtime_control_room(p_festival_company_id uuid,p_edition_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.festival_edition_runtimes%ROWTYPE; actor uuid:=public._festival_edition_runtime_actor();
BEGIN SELECT * INTO r FROM public.festival_edition_runtimes WHERE festival_company_id=p_festival_company_id AND edition_id=p_edition_id ORDER BY created_at DESC LIMIT 1; IF NOT FOUND THEN RETURN NULL; END IF;
 IF actor IS NULL OR NOT public._festival_edition_runtime_authorised(r.festival_company_id) THEN PERFORM public._festival_runtime_error('FESTIVAL_RUNTIME_ACCESS_DENIED'); END IF;
 RETURN jsonb_build_object('runtimeId',r.id,'festivalCompanyId',r.festival_company_id,'editionId',r.edition_id,'state',r.state,'version',r.version,'simulatedTime',r.simulated_time,'gates',jsonb_build_object('status',CASE WHEN r.state IN('gates_open','live','paused') THEN 'open' ELSE 'closed' END,'queueSize',0,'waitMinutes',0),'attendance',jsonb_build_object('expected',r.expected_attendance,'admitted',r.admitted_attendance,'onsite',r.site_attendance,'departed',r.departed_attendance,'capacity',r.site_capacity),'weather',jsonb_build_object('condition',coalesce(r.weather_sequence->0->>'condition','Preserved forecast'),'temperatureC',coalesce((r.weather_sequence->0->>'temperatureC')::numeric,18),'warning',r.weather_sequence->0->>'warning'),'readiness',jsonb_build_object('staff',coalesce(r.staff_readiness,'{"ready":0,"total":0}'),'suppliers',coalesce(r.supplier_readiness,'{"ready":0,"total":0}'),'sponsors',coalesce(r.sponsor_readiness,'{"ready":0,"total":0}')),'stages','[]'::jsonb,'incidents',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'category',i.catalogue_code,'severity',i.severity,'status',i.status,'location',i.location_key,'summary',coalesce(i.required_response->>'summary','Operational incident'))),'[]') FROM public.festival_edition_runtime_incidents i WHERE i.runtime_id=r.id AND i.status NOT IN('resolved','handed_over')),'sales',jsonb_build_object('foodAndDrinkMinor',coalesce((SELECT sum((e.evidence->>'grossMinor')::bigint) FROM public.festival_runtime_evidence e WHERE e.runtime_id=r.id AND e.evidence_type='food_drink_sale'),0),'merchandiseMinor',coalesce((SELECT sum((e.evidence->>'grossMinor')::bigint) FROM public.festival_runtime_evidence e WHERE e.runtime_id=r.id AND e.evidence_type='merchandise_sale'),0)),'satisfaction',jsonb_build_object('audience',coalesce((SELECT avg((e.evidence->>'score')::numeric) FROM public.festival_runtime_evidence e WHERE e.runtime_id=r.id AND e.evidence_type='audience_satisfaction'),50),'artist',coalesce((SELECT avg((e.evidence->>'score')::numeric) FROM public.festival_runtime_evidence e WHERE e.runtime_id=r.id AND e.evidence_type='artist_satisfaction'),50)),'blockers','[]'::jsonb,'recentEvents','[]'::jsonb,'permissions',jsonb_build_object('role',CASE WHEN public.is_admin(auth.uid()) THEN 'admin' ELSE 'festival_owner' END,'actions',ARRAY['confirm_ready','open_gates','start_live','pause','resume','begin_closing','complete','abort'])); END $$;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['festival_edition_runtimes','festival_runtime_configuration_versions','festival_runtime_ticks','festival_runtime_evidence','festival_runtime_incident_catalogue','festival_edition_runtime_incidents','festival_runtime_action_audit','festival_runtime_completion_digests'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t); END LOOP; END $$;
REVOKE ALL ON FUNCTION public._festival_edition_runtime_actor(),public._festival_edition_runtime_authorised(uuid),public._festival_runtime_error(text,jsonb),public.prepare_festival_edition_runtime(uuid,uuid,integer,uuid,uuid),public.transition_festival_edition_runtime(uuid,integer,text,text,uuid),public.get_festival_edition_runtime_control_room(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_festival_edition_runtime(uuid,uuid,integer,uuid,uuid),public.transition_festival_edition_runtime(uuid,integer,text,text,uuid),public.get_festival_edition_runtime_control_room(uuid,uuid) TO authenticated;
COMMENT ON TABLE public.festival_runtime_evidence IS 'Append-only deterministic runtime evidence. Rewards and final finance are applied only by later performance/effects and settlement workers.';
