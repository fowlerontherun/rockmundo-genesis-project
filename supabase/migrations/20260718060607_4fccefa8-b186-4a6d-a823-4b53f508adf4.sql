DROP FUNCTION IF EXISTS public.admin_festival_catalogue() CASCADE;
DROP FUNCTION IF EXISTS public.festival_edition_settlement_readiness(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.festival_owner_edition_options(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_preview_festival_seed(uuid,text,integer) CASCADE;
DROP FUNCTION IF EXISTS public.admin_preview_legacy_festival_migration(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.festival_staff_candidates(uuid,text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_assign_festival_system_act(uuid,uuid,text,text,text,text,text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_transition_festival_edition(uuid, public.festival_edition_status, text, boolean, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_festival_brand(uuid, jsonb, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_create_festival_brand(text, uuid, text, text, text, text, text, uuid, jsonb, text) CASCADE;

CREATE TABLE IF NOT EXISTS public.festival_admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  authority text NOT NULL DEFAULT 'platform_admin',
  festival_id uuid REFERENCES public.festivals(id) ON DELETE SET NULL,
  edition_id uuid REFERENCES public.festival_editions(id) ON DELETE SET NULL,
  operation text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT festival_admin_audit_operation_not_blank CHECK (length(trim(operation)) > 0),
  CONSTRAINT festival_admin_audit_reason_for_overrides CHECK (operation NOT LIKE '%override%' OR length(trim(coalesce(reason,''))) > 0)
);
GRANT SELECT, INSERT ON public.festival_admin_audit_events TO authenticated;
GRANT ALL ON public.festival_admin_audit_events TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS festival_admin_audit_idempotency_idx ON public.festival_admin_audit_events(operation, idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE public.festival_admin_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS festival_admin_audit_admin_read ON public.festival_admin_audit_events;
CREATE POLICY festival_admin_audit_admin_read ON public.festival_admin_audit_events FOR SELECT TO authenticated USING (coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false));

CREATE TABLE IF NOT EXISTS public.festival_edition_management_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('delegated_manager','talent_booker','finance_manager','operations_manager','stage_manager','safety_officer')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, profile_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.festival_edition_management_roles TO authenticated;
GRANT ALL ON public.festival_edition_management_roles TO service_role;
ALTER TABLE public.festival_edition_management_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS festival_edition_roles_read ON public.festival_edition_management_roles;
CREATE POLICY festival_edition_roles_read ON public.festival_edition_management_roles FOR SELECT TO authenticated USING (profile_id = public.current_profile_id_safe() OR EXISTS (SELECT 1 FROM public.festival_editions e WHERE e.id=edition_id AND public.can_manage_festival_brand(e.festival_id)));

ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES public.festival_editions(id) ON DELETE CASCADE;
ALTER TABLE public.festival_stage_slots ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES public.festival_editions(id) ON DELETE CASCADE;
ALTER TABLE public.festival_stage_slots ADD COLUMN IF NOT EXISTS public_status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.festival_stage_slots ADD COLUMN IF NOT EXISTS soundcheck_at timestamptz;
ALTER TABLE public.festival_stage_slots ADD COLUMN IF NOT EXISTS changeover_minutes integer;
ALTER TABLE public.festival_stage_slots ADD COLUMN IF NOT EXISTS headline_eligible boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_festival_stages_edition ON public.festival_stages(edition_id) WHERE edition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_festival_stage_slots_edition ON public.festival_stage_slots(edition_id) WHERE edition_id IS NOT NULL;

ALTER TABLE IF EXISTS public.festival_staff ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES public.festival_editions(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.festival_permits ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES public.festival_editions(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.festival_insurance_policies ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES public.festival_editions(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.festival_expense_ledger ADD COLUMN IF NOT EXISTS edition_id uuid REFERENCES public.festival_editions(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.admin_create_festival_brand(
  p_name text, p_home_city_id uuid DEFAULT NULL, p_description text DEFAULT NULL, p_genre_identity text DEFAULT NULL,
  p_scale text DEFAULT NULL, p_brand_type text DEFAULT 'recurring', p_recurring_policy text DEFAULT 'annual',
  p_owner_profile_id uuid DEFAULT NULL, p_public_metadata jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL
) RETURNS public.festivals LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_actor uuid:=public.current_profile_id_safe(); v_existing public.festivals%ROWTYPE; v_new public.festivals%ROWTYPE;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) THEN RAISE EXCEPTION 'Admin authority required'; END IF;
  IF nullif(trim(p_name),'') IS NULL THEN RAISE EXCEPTION 'Festival brand name is required'; END IF;
  IF p_idempotency_key IS NOT NULL THEN SELECT * INTO v_existing FROM public.festivals WHERE public_metadata->>'admin_brand_idempotency_key'=p_idempotency_key LIMIT 1; IF FOUND THEN RETURN v_existing; END IF; END IF;
  INSERT INTO public.festivals(name, description, city_id, genre, scale, owner_profile_id, status, public_metadata)
  VALUES (p_name, p_description, p_home_city_id, p_genre_identity, p_scale, p_owner_profile_id, 'planning', coalesce(p_public_metadata,'{}'::jsonb) || jsonb_build_object('brand_type',p_brand_type,'recurring_policy',p_recurring_policy,'admin_brand_idempotency_key',p_idempotency_key)) RETURNING * INTO v_new;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, festival_id, operation, target_type, target_id, after_snapshot, reason, idempotency_key)
  VALUES (v_actor, v_new.id, 'brand_created', 'festival_brand', v_new.id, to_jsonb(v_new), 'admin canonical brand creation', p_idempotency_key);
  RETURN v_new;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_update_festival_brand(p_festival_id uuid, p_patch jsonb, p_reason text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS public.festivals LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_old public.festivals%ROWTYPE; v_new public.festivals%ROWTYPE;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) THEN RAISE EXCEPTION 'Admin authority required'; END IF;
  IF p_patch ?| array['start_date','end_date','ticket_price_low','ticket_price_high','expected_attendance','status'] THEN RAISE EXCEPTION 'Occurrence fields must be edited on festival_editions'; END IF;
  SELECT * INTO v_old FROM public.festivals WHERE id=p_festival_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Festival brand not found'; END IF;
  UPDATE public.festivals SET name=coalesce(p_patch->>'name',name), description=coalesce(p_patch->>'description',description), city_id=coalesce((p_patch->>'city_id')::uuid,city_id), genre=coalesce(p_patch->>'genre',genre), scale=coalesce(p_patch->>'scale',scale), public_metadata=public_metadata || coalesce(p_patch->'public_metadata','{}'::jsonb), updated_at=now() WHERE id=p_festival_id RETURNING * INTO v_new;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, festival_id, operation, target_type, target_id, before_snapshot, after_snapshot, reason, idempotency_key) VALUES (public.current_profile_id_safe(), p_festival_id, 'brand_updated', 'festival_brand', p_festival_id, to_jsonb(v_old), to_jsonb(v_new), p_reason, p_idempotency_key);
  RETURN v_new;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_transition_festival_edition(p_edition_id uuid, p_target_status public.festival_edition_status, p_reason text, p_override boolean DEFAULT false, p_metadata jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_editions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_old public.festival_editions%ROWTYPE; v_new public.festival_editions%ROWTYPE;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) THEN RAISE EXCEPTION 'Admin authority required'; END IF;
  IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Lifecycle administration requires a reason'; END IF;
  SELECT * INTO v_old FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Festival edition not found'; END IF;
  IF p_override THEN
    UPDATE public.festival_editions SET status=p_target_status, lifecycle_metadata=lifecycle_metadata || jsonb_build_object('last_admin_override_reason',p_reason), updated_at=now() WHERE id=p_edition_id RETURNING * INTO v_new;
    INSERT INTO public.festival_edition_lifecycle_events(edition_id,from_status,to_status,actor_profile_id,reason,metadata,idempotency_key) VALUES (p_edition_id,v_old.status,p_target_status,public.current_profile_id_safe(),p_reason,coalesce(p_metadata,'{}') || jsonb_build_object('admin_override',true),p_idempotency_key);
  ELSE
    v_new := public.transition_festival_edition(p_edition_id,p_target_status,p_reason,p_metadata,p_idempotency_key);
  END IF;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, festival_id, edition_id, operation, target_type, target_id, before_snapshot, after_snapshot, reason, idempotency_key) VALUES (public.current_profile_id_safe(), v_old.festival_id, p_edition_id, CASE WHEN p_override THEN 'lifecycle_override' ELSE 'lifecycle_transition' END, 'festival_edition', p_edition_id, to_jsonb(v_old), to_jsonb(v_new), p_reason, p_idempotency_key);
  RETURN v_new;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_festival_catalogue()
RETURNS TABLE (
  festival_id uuid, brand_name text, owner_name text, city_name text, current_edition_id uuid, current_edition_title text,
  next_edition_id uuid, completed_edition_id uuid, edition_count bigint, lifecycle_state public.festival_edition_status,
  stage_count bigint, active_contract_count bigint, performance_session_count bigint, outcome_count bigint, attendance integer,
  currency_code text, projected_finance_cents bigint, actual_finance_cents bigint, legacy_mappings bigint, operational_readiness text, data_health_warnings jsonb
) LANGUAGE sql SECURITY DEFINER SET search_path=public AS $fn$
  WITH edition_rollup AS (
    SELECT e.festival_id,
      count(*) edition_count,
      (array_agg(e.id ORDER BY CASE WHEN e.status IN ('live','setup','on_sale','announced','booking','applications_open','planning') THEN 0 ELSE 1 END, e.start_at NULLS LAST))[1] current_edition_id,
      (array_agg(e.title ORDER BY CASE WHEN e.status IN ('live','setup','on_sale','announced','booking','applications_open','planning') THEN 0 ELSE 1 END, e.start_at NULLS LAST))[1] current_edition_title,
      (array_agg(e.id ORDER BY e.start_at NULLS LAST) FILTER (WHERE e.start_at >= now() AND e.status NOT IN ('cancelled','abandoned')))[1] next_edition_id,
      (array_agg(e.id ORDER BY e.completed_at DESC NULLS LAST, e.end_at DESC NULLS LAST) FILTER (WHERE e.status='completed'))[1] completed_edition_id,
      (array_agg(e.status ORDER BY CASE WHEN e.status IN ('live','setup','on_sale','announced','booking','applications_open','planning') THEN 0 ELSE 1 END, e.start_at NULLS LAST))[1] lifecycle_state,
      (array_agg(e.expected_attendance ORDER BY e.start_at DESC NULLS LAST))[1] attendance,
      (array_agg(e.currency_code ORDER BY e.start_at DESC NULLS LAST))[1] currency_code
    FROM public.festival_editions e GROUP BY e.festival_id
  ), counts AS (
    SELECT f.id festival_id,
      (SELECT count(*) FROM public.festival_stages st JOIN public.festival_editions e ON e.id=st.edition_id WHERE e.festival_id=f.id) stage_count,
      (SELECT count(*) FROM public.festival_contracts c WHERE c.festival_id=f.id AND c.status IN ('awaiting_signatures','active','amendment_required')) active_contract_count,
      (SELECT count(*) FROM public.festival_performance_sessions s WHERE s.festival_id=f.id) performance_session_count,
      (SELECT count(*) FROM public.festival_performance_outcomes o JOIN public.festival_editions e ON e.id=o.edition_id WHERE e.festival_id=f.id) outcome_count,
      (SELECT count(*) FROM public.festival_legacy_mappings m JOIN public.festival_editions e ON e.id=m.edition_id WHERE e.festival_id=f.id) legacy_mappings
    FROM public.festivals f
  )
  SELECT f.id, f.name, p.display_name, c.name, er.current_edition_id, er.current_edition_title, er.next_edition_id, er.completed_edition_id,
    coalesce(er.edition_count,0), er.lifecycle_state, coalesce(ct.stage_count,0), coalesce(ct.active_contract_count,0), coalesce(ct.performance_session_count,0), coalesce(ct.outcome_count,0), er.attendance, coalesce(er.currency_code,'USD'), 0::bigint, 0::bigint, coalesce(ct.legacy_mappings,0),
    CASE WHEN coalesce(er.edition_count,0)=0 THEN 'missing_edition' WHEN coalesce(ct.stage_count,0)=0 THEN 'needs_stages' WHEN coalesce(ct.active_contract_count,0)=0 THEN 'needs_contracts' ELSE 'ready' END,
    jsonb_strip_nulls(jsonb_build_array(
      CASE WHEN coalesce(er.edition_count,0)=0 THEN jsonb_build_object('code','brand_without_edition','severity','blocker','message','Brand has no canonical edition') END,
      CASE WHEN er.current_edition_id IS NOT NULL AND coalesce(ct.stage_count,0)=0 THEN jsonb_build_object('code','edition_without_stages','severity','warning','message','Selected edition has no edition-scoped stages') END,
      CASE WHEN coalesce(ct.legacy_mappings,0)>1 THEN jsonb_build_object('code','duplicate_legacy_mapping','severity','warning','message','Multiple legacy mappings need review') END
    ))
  FROM public.festivals f LEFT JOIN public.profiles p ON p.id=f.owner_profile_id LEFT JOIN public.cities c ON c.id=f.city_id LEFT JOIN edition_rollup er ON er.festival_id=f.id LEFT JOIN counts ct ON ct.festival_id=f.id
  WHERE coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false);
$fn$;
GRANT EXECUTE ON FUNCTION public.admin_festival_catalogue() TO authenticated;

CREATE OR REPLACE FUNCTION public.festival_owner_edition_options(p_festival_id uuid)
RETURNS TABLE(id uuid, festival_id uuid, title text, edition_number integer, status public.festival_edition_status, start_at timestamptz, end_at timestamptz, city_name text, currency_code text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $fn$
  SELECT e.id,e.festival_id,e.title,e.edition_number,e.status,e.start_at,e.end_at,c.name,e.currency_code FROM public.festival_editions e LEFT JOIN public.cities c ON c.id=e.city_id WHERE e.festival_id=p_festival_id AND (public.can_manage_festival_brand(e.festival_id) OR EXISTS (SELECT 1 FROM public.festival_edition_management_roles r WHERE r.edition_id=e.id AND r.profile_id=public.current_profile_id_safe() AND r.status='active' AND (r.ends_at IS NULL OR r.ends_at>now()))) ORDER BY e.start_at DESC NULLS LAST, e.edition_number DESC;
$fn$;
GRANT EXECUTE ON FUNCTION public.festival_owner_edition_options(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.festival_edition_settlement_readiness(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_lifecycle text; v_completed bigint; v_missing bigint; v_invalid bigint; v_unsettled bigint; v_pending bigint := 0;
BEGIN
  SELECT status::text INTO v_lifecycle FROM public.festival_editions WHERE id=p_edition_id;
  SELECT count(*) INTO v_completed FROM public.festival_performance_sessions s WHERE s.edition_id=p_edition_id AND s.status='completed';
  SELECT count(*) INTO v_missing FROM public.festival_performance_sessions s LEFT JOIN public.festival_performance_outcomes o ON o.session_id=s.id WHERE s.edition_id=p_edition_id AND s.status='completed' AND o.id IS NULL;
  SELECT count(*) INTO v_invalid FROM public.festival_performance_outcomes o WHERE o.edition_id=p_edition_id AND o.invalidated_at IS NOT NULL;
  SELECT count(*) INTO v_unsettled FROM public.festival_contracts c WHERE c.edition_id=p_edition_id AND c.status IN ('active','awaiting_signatures');
  IF to_regclass('public.festival_pending_career_effects') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.festival_pending_career_effects pe WHERE pe.edition_id=$1 AND pe.status=''pending''' INTO v_pending USING p_edition_id;
  END IF;
  RETURN jsonb_build_object('lifecycle_state',v_lifecycle,'completed_sessions',v_completed,'missing_outcomes',v_missing,'invalidated_outcomes',v_invalid,'unsettled_contracts',v_unsettled,'unresolved_incidents',0,'attendance_finalised',v_lifecycle IN ('settling','completed'),'ledger_readiness','deferred','permit_insurance_issues',0,'pending_effects',v_pending,'blockers',jsonb_build_array(CASE WHEN v_lifecycle NOT IN ('settling','completed') THEN 'edition_not_in_settlement_state' END, CASE WHEN v_missing>0 THEN 'missing_outcomes' END),'warnings',jsonb_build_array(CASE WHEN v_unsettled>0 THEN 'contracts_waiting_for_next_pr_settlement' END),'ready_for_settlement', v_lifecycle IN ('settling','completed') AND v_missing=0 AND v_invalid=0);
END $fn$;
GRANT EXECUTE ON FUNCTION public.festival_edition_settlement_readiness(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_direct_festival_slot_assignment()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND NEW.band_id IS DISTINCT FROM OLD.band_id AND NEW.band_id IS NOT NULL AND NEW.canonical_contract_id IS NULL THEN
    RAISE EXCEPTION 'Bands can only be assigned to festival slots through canonical contracts or audited system-act assignment';
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS tg_prevent_direct_festival_slot_assignment ON public.festival_stage_slots;
CREATE TRIGGER tg_prevent_direct_festival_slot_assignment BEFORE UPDATE OF band_id ON public.festival_stage_slots FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_festival_slot_assignment();

CREATE OR REPLACE FUNCTION public.admin_assign_festival_system_act(p_edition_id uuid, p_slot_id uuid, p_system_act_type text, p_genre text, p_quality_tier text, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_slot public.festival_stage_slots%ROWTYPE; v_name text;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) THEN RAISE EXCEPTION 'Admin authority required'; END IF;
  IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Emergency/system act assignment requires a reason'; END IF;
  SELECT * INTO v_slot FROM public.festival_stage_slots WHERE id=p_slot_id AND edition_id=p_edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Edition slot not found'; END IF;
  v_name := initcap(replace(p_system_act_type,'_',' ')) || ' ' || substr(md5(p_edition_id::text || p_slot_id::text || coalesce(p_idempotency_key,'')),1,6);
  UPDATE public.festival_stage_slots SET is_npc_dj=true,npc_dj_genre=p_genre,npc_dj_quality=CASE p_quality_tier WHEN 'headline' THEN 85 WHEN 'strong' THEN 70 WHEN 'local' THEN 55 ELSE 45 END,npc_dj_name=v_name,status='confirmed',public_status='announced' WHERE id=p_slot_id RETURNING * INTO v_slot;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, festival_id, edition_id, operation, target_type, target_id, after_snapshot, reason, idempotency_key) VALUES (public.current_profile_id_safe(), (SELECT festival_id FROM public.festival_editions WHERE id=p_edition_id), p_edition_id, 'system_act_assigned', 'festival_stage_slot', p_slot_id, to_jsonb(v_slot), p_reason, p_idempotency_key);
  RETURN jsonb_build_object('slot_id',p_slot_id,'system_act_name',v_name,'quality_tier',p_quality_tier);
END $fn$;

CREATE OR REPLACE FUNCTION public.festival_staff_candidates(p_edition_id uuid, p_role text)
RETURNS TABLE(candidate_id text, name text, role text, skill integer, reliability integer, wage_cents bigint, availability text, prior_festival_experience integer, conflicts jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $fn$
  SELECT 'candidate-' || substr(md5(p_edition_id::text || p_role || gs::text),1,12),
    initcap(replace(p_role,'_',' ')) || ' Candidate ' || gs,
    p_role,
    50 + ((abs(hashtext(p_edition_id::text || p_role || gs::text)) % 40)),
    55 + ((abs(hashtext('rel' || p_edition_id::text || gs::text)) % 35)),
    (150000 + ((abs(hashtext('wage' || p_role || gs::text)) % 250000)))::bigint,
    'available',
    (abs(hashtext('exp' || p_role || gs::text)) % 8),
    '[]'::jsonb
  FROM generate_series(1,5) gs;
$fn$;
GRANT EXECUTE ON FUNCTION public.festival_staff_candidates(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_preview_festival_seed(p_country_id uuid DEFAULT NULL, p_strategy text DEFAULT 'balanced', p_year integer DEFAULT extract(year from now())::integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $fn$
  SELECT jsonb_agg(jsonb_build_object('city_id',c.id,'city',c.name,'festival_name',c.name || ' Festival','scale',CASE WHEN coalesce(c.population,0)>1000000 THEN 'major' WHEN coalesce(c.population,0)>300000 THEN 'large' ELSE 'medium' END,'genre','mixed','dates',jsonb_build_object('start',make_date(p_year,6,1),'end',make_date(p_year,6,3)),'capacity',LEAST(GREATEST(coalesce(c.population,100000)/20,5000),75000),'ticket_range',jsonb_build_object('currency','USD','low_cents',3500,'high_cents',15000),'rationale','Canonical seed preview only; apply RPC performs writes','conflict_warnings','[]'::jsonb)) FROM public.cities c WHERE NOT EXISTS (SELECT 1 FROM public.festivals f WHERE f.city_id=c.id) LIMIT 25;
$fn$;
GRANT EXECUTE ON FUNCTION public.admin_preview_festival_seed(uuid,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_preview_legacy_festival_migration(p_game_event_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $fn$
  SELECT jsonb_build_object('source_event',to_jsonb(ge),'participants',(SELECT coalesce(jsonb_agg(to_jsonb(fp)),'[]'::jsonb) FROM public.festival_participants fp WHERE fp.event_id=ge.id),'proposed_brand',ge.title,'conflicts','[]'::jsonb,'mutates_data',false) FROM public.game_events ge WHERE ge.id=p_game_event_id AND ge.event_type='festival';
$fn$;
GRANT EXECUTE ON FUNCTION public.admin_preview_legacy_festival_migration(uuid) TO authenticated;