-- Complete canonical festival edition operations and legacy migration apply.
-- Additive follow-up to 20291211090000_festival_admin_management.sql.

CREATE TABLE IF NOT EXISTS public.festival_operation_migration_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  festival_id uuid,
  proposed_edition_id uuid REFERENCES public.festival_editions(id) ON DELETE SET NULL,
  issue_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','blocker','critical')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution_status text NOT NULL DEFAULT 'open' CHECK (resolution_status IN ('open','resolved','ignored','historical_only','duplicate')),
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_table, source_id, issue_type)
);
ALTER TABLE public.festival_operation_migration_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS festival_operation_migration_issues_admin ON public.festival_operation_migration_issues;
CREATE POLICY festival_operation_migration_issues_admin ON public.festival_operation_migration_issues FOR ALL TO authenticated
USING (coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false))
WITH CHECK (coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false));

CREATE TABLE IF NOT EXISTS public.festival_system_acts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  slot_id uuid UNIQUE REFERENCES public.festival_stage_slots(id) ON DELETE SET NULL,
  deterministic_key text NOT NULL,
  display_name text NOT NULL,
  act_type text NOT NULL,
  genre text,
  quality_tier text NOT NULL DEFAULT 'local',
  reliability integer NOT NULL DEFAULT 70 CHECK (reliability BETWEEN 0 AND 100),
  equipment_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  internal_seed text NOT NULL,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','removed','moved','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(edition_id, deterministic_key)
);

CREATE TABLE IF NOT EXISTS public.festival_staff_candidates_persistent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deterministic_key text NOT NULL UNIQUE,
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  role text NOT NULL,
  name text NOT NULL,
  skill integer NOT NULL CHECK (skill BETWEEN 0 AND 100),
  reliability integer NOT NULL CHECK (reliability BETWEEN 0 AND 100),
  experience integer NOT NULL DEFAULT 0,
  reputation integer NOT NULL DEFAULT 50 CHECK (reputation BETWEEN 0 AND 100),
  wage_expectation_cents bigint NOT NULL DEFAULT 0 CHECK (wage_expectation_cents >= 0),
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  existing_commitments jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_seed text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.festival_edition_insurance_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  provider text NOT NULL,
  coverage_type text NOT NULL CHECK (coverage_type IN ('basic','standard','premium','all_risk','cancellation','weather','liability')),
  premium_cents bigint NOT NULL CHECK (premium_cents >= 0),
  deductible_cents bigint NOT NULL DEFAULT 0 CHECK (deductible_cents >= 0),
  ceiling_cents bigint NOT NULL CHECK (ceiling_cents >= 0),
  exclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
  riders jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL,
  input_hash text NOT NULL,
  model_version text NOT NULL DEFAULT 'festival-insurance-v1',
  status text NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted','purchased','expired','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(edition_id, provider, coverage_type, input_hash)
);

CREATE TABLE IF NOT EXISTS public.festival_edition_budget_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  original_budget_cents bigint,
  previous_budget_cents bigint,
  new_budget_cents bigint NOT NULL CHECK (new_budget_cents >= 0),
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.festival_edition_poster_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  source_snapshot jsonb NOT NULL,
  poster_url text,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('draft','generated','published','archived')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(edition_id, version_number)
);

ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS archived_reason text;
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS stage_type text NOT NULL DEFAULT 'main';
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS stage_size text;
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS sound_capability text;
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS lighting_capability text;
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS backstage_capability text;
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS weather_protection text;
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS default_changeover_minutes integer NOT NULL DEFAULT 30 CHECK (default_changeover_minutes >= 0);
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS curfew_time time;
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS technical_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS public_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.festival_stage_slots ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.festival_stage_slots ADD COLUMN IF NOT EXISTS archived_reason text;
ALTER TABLE public.festival_stage_slots ADD COLUMN IF NOT EXISTS slot_template text;
ALTER TABLE public.festival_stage_slots ADD COLUMN IF NOT EXISTS reservation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.festival_stage_slots ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.festival_staff ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.festival_staff_candidates_persistent(id) ON DELETE SET NULL;
ALTER TABLE public.festival_staff ADD COLUMN IF NOT EXISTS assignment_scope jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.festival_staff ADD COLUMN IF NOT EXISTS shift_start_at timestamptz;
ALTER TABLE public.festival_staff ADD COLUMN IF NOT EXISTS shift_end_at timestamptz;
ALTER TABLE public.festival_staff ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.festival_staff ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.festival_permits ADD COLUMN IF NOT EXISTS requirement_code text;
ALTER TABLE public.festival_permits ADD COLUMN IF NOT EXISTS applicant_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.festival_permits ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.festival_permits ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.festival_insurance_policies ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.festival_edition_insurance_quotes(id) ON DELETE SET NULL;
ALTER TABLE public.festival_insurance_policies ADD COLUMN IF NOT EXISTS policy_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.festival_insurance_policies ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.festival_expense_ledger ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'USD';
ALTER TABLE public.festival_expense_ledger ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'committed';
ALTER TABLE public.festival_expense_ledger ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE public.festival_expense_ledger ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.festival_expense_ledger ADD COLUMN IF NOT EXISTS due_at timestamptz;
ALTER TABLE public.festival_expense_ledger ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.festival_expense_ledger DROP CONSTRAINT IF EXISTS festival_expense_ledger_category_check;
ALTER TABLE public.festival_expense_ledger ADD CONSTRAINT festival_expense_ledger_category_check CHECK (category IN ('staff_wages','security','permits','insurance','stage_rental','equipment_rental','marketing','artist_guarantee','artist_bonus','cleanup','tax','refund','sponsor_income','ticket_income','merch_income','fnb_income','other','utilities','medical','sanitation','transport','deposit','cancellation_liability'));
ALTER TABLE public.festival_expense_ledger DROP CONSTRAINT IF EXISTS festival_expense_ledger_status_check;
ALTER TABLE public.festival_expense_ledger ADD CONSTRAINT festival_expense_ledger_status_check CHECK (status IN ('expected','committed','accrued','paid','received','void','cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS festival_stage_idempotency_idx ON public.festival_stages(edition_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_slot_idempotency_idx ON public.festival_stage_slots(stage_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_staff_idempotency_idx ON public.festival_staff(edition_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_permit_idempotency_idx ON public.festival_permits(edition_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_policy_idempotency_idx ON public.festival_insurance_policies(edition_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_ledger_source_idx ON public.festival_expense_ledger(edition_id,source_type,source_id) WHERE edition_id IS NOT NULL AND source_type IS NOT NULL AND source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS festival_ledger_idempotency_idx ON public.festival_expense_ledger(edition_id,idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Deterministic backfill where legacy mapping makes the edition unambiguous; unresolved rows become explicit issues.
UPDATE public.festival_stages st SET edition_id = m.edition_id FROM public.festival_legacy_mappings m WHERE st.edition_id IS NULL AND m.legacy_source='game_event' AND m.legacy_id=st.festival_id;
UPDATE public.festival_stage_slots sl SET edition_id = st.edition_id FROM public.festival_stages st WHERE sl.stage_id=st.id AND sl.edition_id IS NULL AND st.edition_id IS NOT NULL;
UPDATE public.festival_staff s SET edition_id=e.id FROM public.festival_editions e WHERE s.edition_id IS NULL AND s.festival_id=e.festival_id AND e.edition_number=1;
UPDATE public.festival_permits p SET edition_id=e.id FROM public.festival_editions e WHERE p.edition_id IS NULL AND p.festival_id=e.festival_id AND e.edition_number=1;
UPDATE public.festival_insurance_policies p SET edition_id=e.id FROM public.festival_editions e WHERE p.edition_id IS NULL AND p.festival_id=e.festival_id AND e.edition_number=1;
UPDATE public.festival_expense_ledger l SET edition_id=e.id FROM public.festival_editions e WHERE l.edition_id IS NULL AND l.festival_id=e.festival_id AND l.edition_number=e.edition_number;

INSERT INTO public.festival_operation_migration_issues(source_table, source_id, festival_id, issue_type, severity, evidence)
SELECT 'festival_stages', id, NULL, 'missing_edition', 'blocker', to_jsonb(st) FROM public.festival_stages st WHERE edition_id IS NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.festival_operation_migration_issues(source_table, source_id, festival_id, issue_type, severity, evidence)
SELECT 'festival_stage_slots', id, NULL, 'missing_edition', 'blocker', to_jsonb(sl) FROM public.festival_stage_slots sl WHERE edition_id IS NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.festival_operation_migration_issues(source_table, source_id, festival_id, issue_type, severity, evidence)
SELECT 'festival_staff', id, festival_id, 'missing_edition', 'blocker', to_jsonb(s) FROM public.festival_staff s WHERE edition_id IS NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.festival_operation_migration_issues(source_table, source_id, festival_id, issue_type, severity, evidence)
SELECT 'festival_permits', id, festival_id, 'missing_edition', 'blocker', to_jsonb(p) FROM public.festival_permits p WHERE edition_id IS NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.festival_operation_migration_issues(source_table, source_id, festival_id, issue_type, severity, evidence)
SELECT 'festival_insurance_policies', id, festival_id, 'missing_edition', 'blocker', to_jsonb(p) FROM public.festival_insurance_policies p WHERE edition_id IS NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.festival_operation_migration_issues(source_table, source_id, festival_id, issue_type, severity, evidence)
SELECT 'festival_expense_ledger', id, festival_id, 'missing_edition', 'blocker', to_jsonb(l) FROM public.festival_expense_ledger l WHERE edition_id IS NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.festival_admin_can_operate_edition(p_edition_id uuid, p_roles text[] DEFAULT ARRAY[]::text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false)
    OR EXISTS (SELECT 1 FROM public.festival_editions e WHERE e.id=p_edition_id AND public.can_manage_festival_brand(e.festival_id))
    OR EXISTS (SELECT 1 FROM public.festival_edition_management_roles r WHERE r.edition_id=p_edition_id AND r.profile_id=public.current_profile_id_safe() AND r.status='active' AND (r.ends_at IS NULL OR r.ends_at>now()) AND (array_length(p_roles,1) IS NULL OR r.role=ANY(p_roles) OR r.role='delegated_manager'));
$$;

CREATE OR REPLACE FUNCTION public.festival_audit(p_edition_id uuid, p_operation text, p_target_type text, p_target_id uuid, p_before jsonb, p_after jsonb, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_festival uuid;
BEGIN
  SELECT festival_id INTO v_festival FROM public.festival_editions WHERE id=p_edition_id;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, before_snapshot, after_snapshot, reason, idempotency_key)
  VALUES (public.current_profile_id_safe(), CASE WHEN coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) THEN 'platform_admin' ELSE 'edition_manager' END, v_festival, p_edition_id, p_operation, p_target_type, p_target_id, coalesce(p_before,'{}'), coalesce(p_after,'{}'), p_reason, p_idempotency_key)
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.post_festival_edition_ledger_entry(p_edition_id uuid, p_category text, p_direction text, p_amount_cents bigint, p_currency_code text, p_status text, p_counterparty_type text DEFAULT NULL, p_counterparty_id uuid DEFAULT NULL, p_source_type text DEFAULT NULL, p_source_id uuid DEFAULT NULL, p_due_at timestamptz DEFAULT NULL, p_description text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_expense_ledger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_e public.festival_editions%ROWTYPE; v_row public.festival_expense_ledger%ROWTYPE;
BEGIN
  IF p_category NOT IN ('staff_wages','permits','insurance','stage_rental','equipment','performer_guarantee','deposit','performance_bonus','cancellation_liability','ticket_revenue','sponsorship','concessions','merch_commission','marketing','utilities','security','medical','sanitation','cleanup','transport','tax','refund','miscellaneous_approved_adjustment') THEN RAISE EXCEPTION 'Unsupported festival ledger category'; END IF;
  IF p_direction NOT IN ('income','expense') THEN RAISE EXCEPTION 'Unsupported ledger direction'; END IF;
  SELECT * INTO v_e FROM public.festival_editions WHERE id=p_edition_id; IF NOT FOUND THEN RAISE EXCEPTION 'Edition not found'; END IF;
  IF coalesce(p_currency_code,v_e.currency_code) <> v_e.currency_code THEN RAISE EXCEPTION 'Ledger currency must match edition currency'; END IF;
  IF p_idempotency_key IS NOT NULL THEN SELECT * INTO v_row FROM public.festival_expense_ledger WHERE edition_id=p_edition_id AND idempotency_key=p_idempotency_key LIMIT 1; IF FOUND THEN RETURN v_row; END IF; END IF;
  INSERT INTO public.festival_expense_ledger(festival_id, edition_number, edition_id, category, direction, amount_cents, currency_code, status, description, counterparty_type, counterparty_id, source_type, source_id, due_at, idempotency_key)
  VALUES (v_e.festival_id, v_e.edition_number, p_edition_id, CASE p_category WHEN 'equipment' THEN 'equipment_rental' WHEN 'performer_guarantee' THEN 'artist_guarantee' WHEN 'ticket_revenue' THEN 'ticket_income' WHEN 'sponsorship' THEN 'sponsor_income' WHEN 'concessions' THEN 'fnb_income' WHEN 'merch_commission' THEN 'merch_income' WHEN 'miscellaneous_approved_adjustment' THEN 'other' ELSE p_category END, p_direction, p_amount_cents, v_e.currency_code, p_status, p_description, p_counterparty_type, p_counterparty_id, p_source_type, p_source_id, p_due_at, p_idempotency_key)
  RETURNING * INTO v_row;
  PERFORM public.festival_audit(p_edition_id,'ledger_entry_posted','festival_expense_ledger',v_row.id,'{}',to_jsonb(v_row),p_description,p_idempotency_key);
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.create_festival_edition_stage(p_edition_id uuid, p_name text, p_type text DEFAULT 'main', p_capacity integer DEFAULT 0, p_genre_focus text DEFAULT NULL, p_stage_size text DEFAULT NULL, p_sound_capability text DEFAULT NULL, p_lighting_capability text DEFAULT NULL, p_backstage_capability text DEFAULT NULL, p_weather_protection text DEFAULT NULL, p_changeover_duration integer DEFAULT 30, p_curfew time DEFAULT NULL, p_technical_metadata jsonb DEFAULT '{}'::jsonb, p_public_metadata jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_stages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_e public.festival_editions%ROWTYPE; v_legacy uuid; v_stage public.festival_stages%ROWTYPE; v_num integer;
BEGIN
  IF NOT public.festival_admin_can_operate_edition(p_edition_id, ARRAY['operations_manager','stage_manager']) THEN RAISE EXCEPTION 'Edition stage authority required'; END IF;
  SELECT * INTO v_e FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Edition not found'; END IF;
  IF v_e.status NOT IN ('planning','applications_open','booking','announced','on_sale','setup') THEN RAISE EXCEPTION 'Edition lifecycle does not allow stage changes'; END IF;
  IF p_capacity < 0 THEN RAISE EXCEPTION 'Stage capacity cannot be negative'; END IF;
  SELECT legacy_id INTO v_legacy FROM public.festival_legacy_mappings WHERE edition_id=p_edition_id AND legacy_source='game_event' LIMIT 1;
  IF v_legacy IS NULL THEN RAISE EXCEPTION 'Edition requires a legacy game_event compatibility mapping before stage creation'; END IF;
  IF p_idempotency_key IS NOT NULL THEN SELECT * INTO v_stage FROM public.festival_stages WHERE edition_id=p_edition_id AND idempotency_key=p_idempotency_key; IF FOUND THEN RETURN v_stage; END IF; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_stages WHERE edition_id=p_edition_id AND lower(stage_name)=lower(p_name) AND archived_at IS NULL) THEN RAISE EXCEPTION 'Stage name must be unique within edition'; END IF;
  SELECT coalesce(max(stage_number),0)+1 INTO v_num FROM public.festival_stages WHERE edition_id=p_edition_id;
  IF v_num > 12 THEN RAISE EXCEPTION 'Stage count limit exceeded'; END IF;
  INSERT INTO public.festival_stages(festival_id, edition_id, stage_name, stage_number, capacity, genre_focus, stage_type, stage_size, sound_capability, lighting_capability, backstage_capability, weather_protection, default_changeover_minutes, curfew_time, technical_metadata, public_metadata, idempotency_key)
  VALUES (v_legacy, p_edition_id, p_name, v_num, p_capacity, p_genre_focus, coalesce(p_type,'main'), p_stage_size, p_sound_capability, p_lighting_capability, p_backstage_capability, p_weather_protection, coalesce(p_changeover_duration,30), p_curfew, coalesce(p_technical_metadata,'{}'), coalesce(p_public_metadata,'{}'), p_idempotency_key) RETURNING * INTO v_stage;
  PERFORM public.festival_audit(p_edition_id,'stage_created','festival_stage',v_stage.id,'{}',to_jsonb(v_stage),NULL,p_idempotency_key);
  RETURN v_stage;
END $$;

CREATE OR REPLACE FUNCTION public.update_festival_edition_stage(p_stage_id uuid, p_patch jsonb, p_reason text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_stages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.festival_stages%ROWTYPE; v_new public.festival_stages%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.festival_stages WHERE id=p_stage_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Stage not found'; END IF;
  IF NOT public.festival_admin_can_operate_edition(v_old.edition_id, ARRAY['operations_manager','stage_manager']) THEN RAISE EXCEPTION 'Edition stage authority required'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_stage_slots WHERE stage_id=p_stage_id AND status IN ('confirmed','performing','completed') AND (p_patch ?| ARRAY['stage_number'])) THEN RAISE EXCEPTION 'Cannot renumber a stage with active or historical slots'; END IF;
  UPDATE public.festival_stages SET stage_name=coalesce(p_patch->>'name',stage_name), capacity=coalesce((p_patch->>'capacity')::integer,capacity), genre_focus=coalesce(p_patch->>'genre_focus',genre_focus), stage_type=coalesce(p_patch->>'type',stage_type), technical_metadata=technical_metadata || coalesce(p_patch->'technical_metadata','{}'::jsonb), public_metadata=public_metadata || coalesce(p_patch->'public_metadata','{}'::jsonb) WHERE id=p_stage_id RETURNING * INTO v_new;
  PERFORM public.festival_audit(v_old.edition_id,'stage_updated','festival_stage',p_stage_id,to_jsonb(v_old),to_jsonb(v_new),p_reason,p_idempotency_key);
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.archive_festival_edition_stage(p_stage_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_stages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.festival_stages%ROWTYPE; v_new public.festival_stages%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.festival_stages WHERE id=p_stage_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Stage not found'; END IF;
  IF NOT public.festival_admin_can_operate_edition(v_old.edition_id, ARRAY['operations_manager','stage_manager']) THEN RAISE EXCEPTION 'Edition stage authority required'; END IF;
  IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Archive reason is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_stage_slots WHERE stage_id=p_stage_id AND status IN ('confirmed','performing','completed')) THEN RAISE EXCEPTION 'Cannot archive a stage with active or historical slots'; END IF;
  UPDATE public.festival_stages SET archived_at=now(), archived_reason=p_reason WHERE id=p_stage_id RETURNING * INTO v_new;
  PERFORM public.festival_audit(v_old.edition_id,'stage_archived','festival_stage',p_stage_id,to_jsonb(v_old),to_jsonb(v_new),p_reason,p_idempotency_key);
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.generate_festival_stage_slots(p_stage_id uuid, p_date date, p_opening_time time, p_curfew time, p_slot_templates jsonb, p_changeover_duration integer DEFAULT 30, p_soundcheck_policy jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL, p_apply boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_stage public.festival_stages%ROWTYPE; v_e public.festival_editions%ROWTYPE; v_item jsonb; v_start timestamptz; v_end timestamptz; v_count integer:=0; v_slot public.festival_stage_slots%ROWTYPE; v_preview jsonb:='[]'::jsonb;
BEGIN
  SELECT * INTO v_stage FROM public.festival_stages WHERE id=p_stage_id; IF NOT FOUND THEN RAISE EXCEPTION 'Stage not found'; END IF;
  SELECT * INTO v_e FROM public.festival_editions WHERE id=v_stage.edition_id; IF NOT FOUND THEN RAISE EXCEPTION 'Stage edition not found'; END IF;
  IF NOT public.festival_admin_can_operate_edition(v_e.id, ARRAY['operations_manager','stage_manager']) THEN RAISE EXCEPTION 'Edition slot authority required'; END IF;
  IF p_date < v_e.start_at::date OR p_date > v_e.end_at::date THEN RAISE EXCEPTION 'Slot date outside edition dates'; END IF;
  IF p_idempotency_key IS NOT NULL AND p_apply THEN
    IF EXISTS (SELECT 1 FROM public.festival_stage_slots WHERE stage_id=p_stage_id AND idempotency_key=p_idempotency_key) THEN RETURN jsonb_build_object('applied',true,'idempotent',true,'slots',(SELECT jsonb_agg(to_jsonb(s)) FROM public.festival_stage_slots s WHERE s.stage_id=p_stage_id AND s.idempotency_key=p_idempotency_key)); END IF;
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_slot_templates,'[]'::jsonb)) LOOP
    v_count := v_count + 1;
    v_start := (p_date::text || ' ' || coalesce(v_item->>'start_time',p_opening_time::text))::timestamptz;
    v_end := v_start + make_interval(mins => coalesce((v_item->>'duration_minutes')::integer,60));
    IF v_end::time > p_curfew THEN RAISE EXCEPTION 'Generated slot exceeds curfew'; END IF;
    IF EXISTS (SELECT 1 FROM public.festival_stage_slots s WHERE s.stage_id=p_stage_id AND s.archived_at IS NULL AND tstzrange(s.start_time,s.end_time,'[)') && tstzrange(v_start,v_end,'[)')) THEN RAISE EXCEPTION 'Generated slot overlaps existing slot'; END IF;
    v_preview := v_preview || jsonb_build_array(jsonb_build_object('template',coalesce(v_item->>'type','flexible'),'start_at',v_start,'end_at',v_end,'changeover_minutes',p_changeover_duration));
    IF p_apply THEN
      INSERT INTO public.festival_stage_slots(stage_id, festival_id, edition_id, day_number, slot_number, slot_type, slot_template, start_time, end_time, changeover_minutes, soundcheck_at, public_status, idempotency_key)
      VALUES (p_stage_id, v_stage.festival_id, v_e.id, greatest(1,(p_date - v_e.start_at::date)+1), v_count, CASE WHEN coalesce(v_item->>'type','opener')='headline' THEN 'headliner' WHEN coalesce(v_item->>'type','opener')='support' THEN 'support' WHEN coalesce(v_item->>'type','opener') IN ('dj','dj_intermission') THEN 'dj_session' ELSE 'opener' END, coalesce(v_item->>'type','flexible'), v_start, v_end, p_changeover_duration, CASE WHEN coalesce((p_soundcheck_policy->>'enabled')::boolean,false) THEN v_start - interval '1 hour' ELSE NULL END, 'draft', p_idempotency_key) RETURNING * INTO v_slot;
    END IF;
  END LOOP;
  PERFORM public.festival_audit(v_e.id,CASE WHEN p_apply THEN 'slots_generated' ELSE 'slots_previewed' END,'festival_stage',p_stage_id,'{}',v_preview,NULL,p_idempotency_key);
  RETURN jsonb_build_object('applied',p_apply,'requires_apply',NOT p_apply AND v_count>1,'slot_count',v_count,'slots',v_preview);
END $$;

CREATE OR REPLACE FUNCTION public.update_festival_stage_slot(p_slot_id uuid, p_patch jsonb, p_reason text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_stage_slots LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.festival_stage_slots%ROWTYPE; v_new public.festival_stage_slots%ROWTYPE; v_start timestamptz; v_end timestamptz; v_e public.festival_editions%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.festival_stage_slots WHERE id=p_slot_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF NOT public.festival_admin_can_operate_edition(v_old.edition_id, ARRAY['operations_manager','stage_manager']) THEN RAISE EXCEPTION 'Edition slot authority required'; END IF;
  IF v_old.canonical_contract_id IS NOT NULL OR v_old.status IN ('confirmed','performing','completed') THEN RAISE EXCEPTION 'Contracted or historical slot requires amendment workflow'; END IF;
  SELECT * INTO v_e FROM public.festival_editions WHERE id=v_old.edition_id;
  v_start := coalesce((p_patch->>'start_time')::timestamptz, v_old.start_time); v_end := coalesce((p_patch->>'end_time')::timestamptz, v_old.end_time);
  IF v_start < v_e.start_at OR v_end > v_e.end_at THEN RAISE EXCEPTION 'Slot outside edition dates'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_stage_slots s WHERE s.stage_id=v_old.stage_id AND s.id<>p_slot_id AND s.archived_at IS NULL AND tstzrange(s.start_time,s.end_time,'[)') && tstzrange(v_start,v_end,'[)')) THEN RAISE EXCEPTION 'Slot overlaps another stage slot'; END IF;
  UPDATE public.festival_stage_slots SET start_time=v_start,end_time=v_end,public_status=coalesce(p_patch->>'public_status',public_status),slot_template=coalesce(p_patch->>'slot_template',slot_template),changeover_minutes=coalesce((p_patch->>'changeover_minutes')::integer,changeover_minutes) WHERE id=p_slot_id RETURNING * INTO v_new;
  PERFORM public.festival_audit(v_old.edition_id,'slot_updated','festival_stage_slot',p_slot_id,to_jsonb(v_old),to_jsonb(v_new),p_reason,p_idempotency_key);
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.archive_festival_stage_slot(p_slot_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_stage_slots LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.festival_stage_slots%ROWTYPE; v_new public.festival_stage_slots%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.festival_stage_slots WHERE id=p_slot_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF v_old.canonical_contract_id IS NOT NULL OR v_old.status IN ('confirmed','performing','completed') THEN RAISE EXCEPTION 'Cannot archive contracted or historical slot'; END IF;
  UPDATE public.festival_stage_slots SET archived_at=now(), archived_reason=p_reason, status='cancelled' WHERE id=p_slot_id RETURNING * INTO v_new;
  PERFORM public.festival_audit(v_old.edition_id,'slot_archived','festival_stage_slot',p_slot_id,to_jsonb(v_old),to_jsonb(v_new),p_reason,p_idempotency_key);
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.admin_assign_festival_system_act(p_edition_id uuid, p_slot_id uuid, p_system_act_type text, p_genre text, p_quality_tier text, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_slot public.festival_stage_slots%ROWTYPE; v_seed text; v_name text; v_act public.festival_system_acts%ROWTYPE; v_quality integer;
BEGIN
  IF NOT public.festival_admin_can_operate_edition(p_edition_id, ARRAY['operations_manager','stage_manager','talent_booker']) THEN RAISE EXCEPTION 'System act authority required'; END IF;
  IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'System act assignment requires a reason'; END IF;
  SELECT * INTO v_slot FROM public.festival_stage_slots WHERE id=p_slot_id AND edition_id=p_edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Edition slot not found'; END IF;
  IF v_slot.band_id IS NOT NULL OR v_slot.canonical_contract_id IS NOT NULL THEN RAISE EXCEPTION 'Cannot assign system act over a player-band contract'; END IF;
  v_seed := md5(p_edition_id::text || ':' || p_slot_id::text || ':' || coalesce(p_system_act_type,'system') || ':' || coalesce(p_genre,''));
  v_name := initcap(replace(coalesce(p_system_act_type,'system_act'),'_',' ')) || ' ' || substr(v_seed,1,6);
  v_quality := CASE p_quality_tier WHEN 'headline' THEN 85 WHEN 'strong' THEN 70 WHEN 'local' THEN 55 ELSE 45 END;
  INSERT INTO public.festival_system_acts(edition_id,slot_id,deterministic_key,display_name,act_type,genre,quality_tier,reliability,equipment_requirements,public_metadata,internal_seed)
  VALUES (p_edition_id,p_slot_id,v_seed,v_name,coalesce(p_system_act_type,'system_act'),p_genre,coalesce(p_quality_tier,'local'),60 + (abs(hashtext(v_seed)) % 35),'{}','{}',v_seed)
  ON CONFLICT (edition_id, deterministic_key) DO UPDATE SET slot_id=excluded.slot_id,status='assigned',updated_at=now()
  RETURNING * INTO v_act;
  UPDATE public.festival_stage_slots SET is_npc_dj=true,npc_dj_genre=p_genre,npc_dj_quality=v_quality,npc_dj_name=v_name,status='confirmed',public_status='announced',reservation_metadata=reservation_metadata || jsonb_build_object('system_act_id',v_act.id,'reservation_type','system_act') WHERE id=p_slot_id RETURNING * INTO v_slot;
  PERFORM public.festival_audit(p_edition_id,'system_act_assigned','festival_system_act',v_act.id,'{}',to_jsonb(v_act),p_reason,p_idempotency_key);
  RETURN jsonb_build_object('slot_id',p_slot_id,'system_act_id',v_act.id,'system_act_name',v_name,'quality_tier',p_quality_tier,'reliability',v_act.reliability);
END $$;

CREATE OR REPLACE FUNCTION public.remove_festival_system_act(p_system_act_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_act public.festival_system_acts%ROWTYPE;
BEGIN
  SELECT * INTO v_act FROM public.festival_system_acts WHERE id=p_system_act_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'System act not found'; END IF;
  IF NOT public.festival_admin_can_operate_edition(v_act.edition_id, ARRAY['operations_manager','stage_manager','talent_booker']) THEN RAISE EXCEPTION 'System act authority required'; END IF;
  UPDATE public.festival_system_acts SET status='removed', slot_id=NULL, updated_at=now() WHERE id=p_system_act_id;
  IF v_act.slot_id IS NOT NULL THEN UPDATE public.festival_stage_slots SET is_npc_dj=false,npc_dj_name=NULL,npc_dj_genre=NULL,npc_dj_quality=50,status='open',public_status='draft',reservation_metadata=reservation_metadata - 'system_act_id' WHERE id=v_act.slot_id AND status <> 'completed'; END IF;
  PERFORM public.festival_audit(v_act.edition_id,'system_act_removed','festival_system_act',p_system_act_id,to_jsonb(v_act),'{}',p_reason,p_idempotency_key);
  RETURN jsonb_build_object('removed',true,'system_act_id',p_system_act_id);
END $$;

CREATE OR REPLACE FUNCTION public.move_festival_system_act(p_system_act_id uuid, p_target_slot_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_act public.festival_system_acts%ROWTYPE; v_slot public.festival_stage_slots%ROWTYPE;
BEGIN
  SELECT * INTO v_act FROM public.festival_system_acts WHERE id=p_system_act_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'System act not found'; END IF;
  SELECT * INTO v_slot FROM public.festival_stage_slots WHERE id=p_target_slot_id AND edition_id=v_act.edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Target slot not found'; END IF;
  IF v_slot.band_id IS NOT NULL OR v_slot.canonical_contract_id IS NOT NULL OR v_slot.status IN ('performing','completed') THEN RAISE EXCEPTION 'Target slot is not safe for system act move'; END IF;
  PERFORM public.remove_festival_system_act(p_system_act_id,p_reason,p_idempotency_key || ':remove');
  RETURN public.admin_assign_festival_system_act(v_act.edition_id,p_target_slot_id,v_act.act_type,v_act.genre,v_act.quality_tier,p_reason,p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.ensure_festival_staff_candidates(p_edition_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i integer; v_key text; v_seed text;
BEGIN
  FOR i IN 1..5 LOOP
    v_seed := md5(p_edition_id::text || ':' || p_role || ':' || i::text);
    v_key := 'candidate-' || substr(v_seed,1,12);
    INSERT INTO public.festival_staff_candidates_persistent(deterministic_key,edition_id,role,name,skill,reliability,experience,reputation,wage_expectation_cents,availability,generated_seed)
    VALUES (v_key,p_edition_id,p_role,initcap(replace(p_role,'_',' ')) || ' Candidate ' || i,50 + (abs(hashtext(v_seed)) % 40),55 + (abs(hashtext('rel'||v_seed)) % 35),abs(hashtext('exp'||v_seed)) % 8,45 + (abs(hashtext('rep'||v_seed)) % 40),(150000 + (abs(hashtext('wage'||v_seed)) % 250000))::bigint,jsonb_build_object('status','available'),v_seed)
    ON CONFLICT (deterministic_key) DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.festival_staff_candidates(p_edition_id uuid, p_role text)
RETURNS TABLE(candidate_id text, name text, role text, skill integer, reliability integer, wage_cents bigint, availability text, prior_festival_experience integer, conflicts jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.ensure_festival_staff_candidates(p_edition_id,p_role);
  RETURN QUERY SELECT c.id::text,c.name,c.role,c.skill,c.reliability,c.wage_expectation_cents,coalesce(c.availability->>'status','available'),c.experience,c.existing_commitments FROM public.festival_staff_candidates_persistent c WHERE c.edition_id=p_edition_id AND c.role=p_role AND c.status='active' ORDER BY c.name LIMIT 25;
END $$;

CREATE OR REPLACE FUNCTION public.hire_festival_edition_staff(p_edition_id uuid, p_candidate_id uuid, p_role text, p_wage_cents bigint, p_assignment_scope jsonb DEFAULT '{}'::jsonb, p_shift_start_at timestamptz DEFAULT NULL, p_shift_end_at timestamptz DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_staff LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_e public.festival_editions%ROWTYPE; v_c public.festival_staff_candidates_persistent%ROWTYPE; v_staff public.festival_staff%ROWTYPE; v_ledger public.festival_expense_ledger%ROWTYPE;
BEGIN
  IF NOT public.festival_admin_can_operate_edition(p_edition_id, ARRAY['operations_manager','finance_manager','safety_officer']) THEN RAISE EXCEPTION 'Staff hire authority required'; END IF;
  SELECT * INTO v_e FROM public.festival_editions WHERE id=p_edition_id; IF NOT FOUND THEN RAISE EXCEPTION 'Edition not found'; END IF;
  SELECT * INTO v_c FROM public.festival_staff_candidates_persistent WHERE id=p_candidate_id AND edition_id=p_edition_id AND status='active'; IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
  IF p_shift_start_at IS NOT NULL AND (p_shift_start_at < v_e.start_at OR p_shift_end_at > v_e.end_at) THEN RAISE EXCEPTION 'Staff shift outside edition dates'; END IF;
  IF p_wage_cents < greatest(0, v_c.wage_expectation_cents / 2) OR p_wage_cents > greatest(v_c.wage_expectation_cents * 3, 1000000) THEN RAISE EXCEPTION 'Staff wage outside allowed bounds'; END IF;
  IF p_idempotency_key IS NOT NULL THEN SELECT * INTO v_staff FROM public.festival_staff WHERE edition_id=p_edition_id AND idempotency_key=p_idempotency_key LIMIT 1; IF FOUND THEN RETURN v_staff; END IF; END IF;
  INSERT INTO public.festival_staff(festival_id, edition_id, candidate_id, role, name, skill_level, weekly_wage_cents, assignment_scope, shift_start_at, shift_end_at, status, idempotency_key, metadata)
  VALUES (v_e.festival_id,p_edition_id,p_candidate_id,p_role,v_c.name,v_c.skill,p_wage_cents,coalesce(p_assignment_scope,'{}'),p_shift_start_at,p_shift_end_at,'active',p_idempotency_key,jsonb_build_object('candidate_reliability',v_c.reliability)) RETURNING * INTO v_staff;
  v_ledger := public.post_festival_edition_ledger_entry(p_edition_id,'staff_wages','expense',p_wage_cents,v_e.currency_code,'committed','staff_candidate',p_candidate_id,'festival_staff',v_staff.id,p_shift_end_at,'Staff wage obligation',p_idempotency_key || ':ledger');
  PERFORM public.festival_audit(p_edition_id,'staff_hired','festival_staff',v_staff.id,'{}',to_jsonb(v_staff),'staff hire',p_idempotency_key);
  RETURN v_staff;
END $$;

CREATE OR REPLACE FUNCTION public.update_festival_staff_assignment(p_staff_id uuid, p_patch jsonb, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_staff LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.festival_staff%ROWTYPE; v_new public.festival_staff%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.festival_staff WHERE id=p_staff_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Staff assignment not found'; END IF;
  IF NOT public.festival_admin_can_operate_edition(v_old.edition_id, ARRAY['operations_manager','finance_manager','safety_officer']) THEN RAISE EXCEPTION 'Staff assignment authority required'; END IF;
  UPDATE public.festival_staff SET assignment_scope=assignment_scope || coalesce(p_patch->'assignment_scope','{}'::jsonb), shift_start_at=coalesce((p_patch->>'shift_start_at')::timestamptz,shift_start_at), shift_end_at=coalesce((p_patch->>'shift_end_at')::timestamptz,shift_end_at), status=coalesce(p_patch->>'status',status), updated_at=now() WHERE id=p_staff_id RETURNING * INTO v_new;
  PERFORM public.festival_audit(v_old.edition_id,'staff_assignment_updated','festival_staff',p_staff_id,to_jsonb(v_old),to_jsonb(v_new),p_reason,p_idempotency_key);
  RETURN v_new;
END $$;
CREATE OR REPLACE FUNCTION public.schedule_festival_staff_shift(p_staff_id uuid, p_shift_start_at timestamptz, p_shift_end_at timestamptz, p_reason text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_staff LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.update_festival_staff_assignment(p_staff_id,jsonb_build_object('shift_start_at',p_shift_start_at,'shift_end_at',p_shift_end_at),p_reason,p_idempotency_key) $$;
CREATE OR REPLACE FUNCTION public.move_festival_staff_assignment(p_staff_id uuid, p_assignment_scope jsonb, p_reason text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_staff LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.update_festival_staff_assignment(p_staff_id,jsonb_build_object('assignment_scope',p_assignment_scope),p_reason,p_idempotency_key) $$;
CREATE OR REPLACE FUNCTION public.suspend_festival_staff_assignment(p_staff_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_staff LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.update_festival_staff_assignment(p_staff_id,jsonb_build_object('status','suspended'),p_reason,p_idempotency_key) $$;
CREATE OR REPLACE FUNCTION public.terminate_festival_staff_assignment(p_staff_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_staff LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.update_festival_staff_assignment(p_staff_id,jsonb_build_object('status','terminated'),p_reason,p_idempotency_key) $$;

CREATE OR REPLACE FUNCTION public.festival_edition_staffing_readiness(p_edition_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  WITH facts AS (
    SELECT coalesce(e.capacity,e.expected_attendance,0) capacity,
      greatest(1,(SELECT count(*) FROM public.festival_stages WHERE edition_id=p_edition_id AND archived_at IS NULL)) stages,
      greatest(1, coalesce((e.end_at::date - e.start_at::date)+1,1)) days
    FROM public.festival_editions e WHERE e.id=p_edition_id
  ), req(role, required_count) AS (
    SELECT 'stage_manager', stages FROM facts UNION ALL
    SELECT 'sound_engineer', stages FROM facts UNION ALL
    SELECT 'safety_officer', greatest(1,capacity/10000) FROM facts UNION ALL
    SELECT 'medic', greatest(1,capacity/15000) FROM facts UNION ALL
    SELECT 'promoter', 1 FROM facts UNION ALL
    SELECT 'booker', 1 FROM facts
  ), assigned AS (
    SELECT role,count(*) assigned_count,avg(skill_level)::integer avg_skill,sum(weekly_wage_cents) cost
    FROM public.festival_staff WHERE edition_id=p_edition_id AND status='active' GROUP BY role
  ), rows AS (
    SELECT req.role, req.required_count, coalesce(a.assigned_count,0) assigned_count, coalesce(a.avg_skill,0) avg_skill, coalesce(a.cost,0) cost
    FROM req LEFT JOIN assigned a USING(role)
  )
  SELECT jsonb_build_object(
    'requirements', coalesce(jsonb_agg(jsonb_build_object('role',role,'required',required_count,'assigned',assigned_count,'coverage',CASE WHEN required_count=0 THEN 1 ELSE assigned_count::numeric/required_count END,'skill_sufficiency',avg_skill,'estimated_cost_cents',cost,'blocker',assigned_count<required_count)),'[]'::jsonb),
    'blockers', coalesce(jsonb_agg(role) FILTER (WHERE assigned_count<required_count),'[]'::jsonb),
    'warnings','[]'::jsonb,
    'estimated_cost_cents', coalesce(sum(cost),0)
  ) FROM rows;
$$;

CREATE OR REPLACE FUNCTION public.festival_edition_permit_requirements(p_edition_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  WITH e AS (SELECT * FROM public.festival_editions WHERE id=p_edition_id), cfg AS (SELECT coalesce(capacity,expected_attendance,0) attendance, coalesce(public_metadata,'{}') meta, start_at FROM e), req AS (
    SELECT * FROM (VALUES ('public_event',true,50000,30),('noise',true,25000,21),('alcohol',(SELECT meta->>'alcohol'='true' FROM cfg),75000,45),('food',(SELECT meta->>'food_vendors'='true' FROM cfg),35000,30),('temporary_structures',(SELECT attendance>5000 FROM cfg),90000,60),('camping',(SELECT meta->>'camping'='true' FROM cfg),65000,60),('road_closure',(SELECT meta->>'road_closure'='true' FROM cfg),45000,45),('fire_safety',true,40000,30),('amplified_music',true,30000,21),('late_night_operation',(SELECT (curfew_at::time > time '23:00') FROM e),55000,45)) v(code,required,fee_cents,lead_days)
  )
  SELECT jsonb_agg(jsonb_build_object('permit_type',code,'status',CASE WHEN required THEN 'required' ELSE 'not_applicable' END,'fee_cents',fee_cents,'expected_processing_days',lead_days,'application_deadline',(SELECT start_at::date FROM cfg)-lead_days,'current_application',(SELECT to_jsonb(p) FROM public.festival_permits p WHERE p.edition_id=p_edition_id AND p.requirement_code=code ORDER BY created_at DESC LIMIT 1),'blocker',required AND NOT EXISTS (SELECT 1 FROM public.festival_permits p WHERE p.edition_id=p_edition_id AND p.requirement_code=code AND p.status='approved'))) FROM req;
$$;

CREATE OR REPLACE FUNCTION public.apply_for_festival_edition_permit(p_edition_id uuid, p_requirement_code text, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_permits LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_e public.festival_editions%ROWTYPE; v_req jsonb; v_fee bigint; v_permit public.festival_permits%ROWTYPE;
BEGIN
  IF NOT public.festival_admin_can_operate_edition(p_edition_id, ARRAY['operations_manager','safety_officer']) THEN RAISE EXCEPTION 'Permit application authority required'; END IF;
  SELECT * INTO v_e FROM public.festival_editions WHERE id=p_edition_id; IF NOT FOUND THEN RAISE EXCEPTION 'Edition not found'; END IF;
  SELECT x INTO v_req FROM jsonb_array_elements(public.festival_edition_permit_requirements(p_edition_id)) x WHERE x->>'permit_type'=p_requirement_code;
  IF v_req IS NULL OR v_req->>'status' <> 'required' THEN RAISE EXCEPTION 'Permit requirement is not required for this edition'; END IF;
  IF p_idempotency_key IS NOT NULL THEN SELECT * INTO v_permit FROM public.festival_permits WHERE edition_id=p_edition_id AND idempotency_key=p_idempotency_key; IF FOUND THEN RETURN v_permit; END IF; END IF;
  v_fee := (v_req->>'fee_cents')::bigint;
  INSERT INTO public.festival_permits(festival_id,edition_id,city_id,permit_type,requirement_code,status,permit_fee_cents,applicant_profile_id,idempotency_key)
  VALUES (v_e.festival_id,p_edition_id,v_e.city_id,CASE WHEN p_requirement_code IN ('noise','alcohol','safety') THEN p_requirement_code ELSE 'event' END,p_requirement_code,'pending',v_fee,public.current_profile_id_safe(),p_idempotency_key) RETURNING * INTO v_permit;
  PERFORM public.post_festival_edition_ledger_entry(p_edition_id,'permits','expense',v_fee,v_e.currency_code,'committed','permit',v_permit.id,'festival_permit',v_permit.id,v_e.start_at,'Permit fee obligation',p_idempotency_key || ':ledger');
  PERFORM public.festival_audit(p_edition_id,'permit_applied','festival_permit',v_permit.id,'{}',to_jsonb(v_permit),'permit application',p_idempotency_key);
  RETURN v_permit;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_festival_edition_permit(p_permit_id uuid, p_status text, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_permits LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.festival_permits%ROWTYPE; v_new public.festival_permits%ROWTYPE;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) THEN RAISE EXCEPTION 'Permit administration requires admin authority'; END IF;
  IF p_status NOT IN ('approved','rejected','pending','expired','revoked','information_requested') THEN RAISE EXCEPTION 'Unsupported permit status'; END IF;
  SELECT * INTO v_old FROM public.festival_permits WHERE id=p_permit_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Permit not found'; END IF;
  UPDATE public.festival_permits SET status=CASE WHEN p_status IN ('revoked','information_requested') THEN 'rejected' WHEN p_status='approved' THEN 'approved' WHEN p_status='expired' THEN 'expired' ELSE p_status END, approved_at=CASE WHEN p_status='approved' THEN now() ELSE approved_at END, reason=p_reason, updated_at=now() WHERE id=p_permit_id RETURNING * INTO v_new;
  PERFORM public.festival_audit(v_old.edition_id,'permit_'||p_status,'festival_permit',p_permit_id,to_jsonb(v_old),to_jsonb(v_new),p_reason,p_idempotency_key);
  RETURN v_new;
END $$;
CREATE OR REPLACE FUNCTION public.admin_approve_festival_edition_permit(p_permit_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_permits LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.admin_update_festival_edition_permit(p_permit_id,'approved',p_reason,p_idempotency_key) $$;
CREATE OR REPLACE FUNCTION public.admin_reject_festival_edition_permit(p_permit_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_permits LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.admin_update_festival_edition_permit(p_permit_id,'rejected',p_reason,p_idempotency_key) $$;
CREATE OR REPLACE FUNCTION public.admin_request_festival_permit_information(p_permit_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_permits LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.admin_update_festival_edition_permit(p_permit_id,'information_requested',p_reason,p_idempotency_key) $$;
CREATE OR REPLACE FUNCTION public.admin_revoke_festival_edition_permit(p_permit_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_permits LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.admin_update_festival_edition_permit(p_permit_id,'revoked',p_reason,p_idempotency_key) $$;
CREATE OR REPLACE FUNCTION public.admin_expire_festival_edition_permit(p_permit_id uuid, p_reason text, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_permits LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.admin_update_festival_edition_permit(p_permit_id,'expired',p_reason,p_idempotency_key) $$;

CREATE OR REPLACE FUNCTION public.quote_festival_edition_insurance(p_edition_id uuid, p_provider text DEFAULT 'RockMundo Mutual', p_coverage_type text DEFAULT 'standard')
RETURNS public.festival_edition_insurance_quotes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_e public.festival_editions%ROWTYPE; v_hash text; v_quote public.festival_edition_insurance_quotes%ROWTYPE; v_premium bigint; v_ceiling bigint;
BEGIN
  IF NOT public.festival_admin_can_operate_edition(p_edition_id, ARRAY['operations_manager','finance_manager','safety_officer']) THEN RAISE EXCEPTION 'Insurance quote authority required'; END IF;
  SELECT * INTO v_e FROM public.festival_editions WHERE id=p_edition_id; IF NOT FOUND THEN RAISE EXCEPTION 'Edition not found'; END IF;
  v_hash := md5(jsonb_build_object('edition_id',p_edition_id,'capacity',v_e.capacity,'attendance',v_e.expected_attendance,'start',v_e.start_at,'end',v_e.end_at,'stages',(SELECT count(*) FROM public.festival_stages WHERE edition_id=p_edition_id AND archived_at IS NULL),'coverage',p_coverage_type,'model','festival-insurance-v1')::text);
  v_premium := greatest(50000, coalesce(v_e.expected_attendance,v_e.capacity,1000) * CASE p_coverage_type WHEN 'premium' THEN 45 WHEN 'all_risk' THEN 70 WHEN 'basic' THEN 20 ELSE 35 END);
  v_ceiling := greatest(v_premium * 20, coalesce(v_e.budget_cents,0));
  INSERT INTO public.festival_edition_insurance_quotes(edition_id,provider,coverage_type,premium_cents,deductible_cents,ceiling_cents,exclusions,riders,expires_at,input_hash)
  VALUES (p_edition_id,p_provider,p_coverage_type,v_premium,v_premium/10,v_ceiling,'[]','[]',now()+interval '14 days',v_hash)
  ON CONFLICT (edition_id, provider, coverage_type, input_hash) DO UPDATE SET expires_at=excluded.expires_at RETURNING * INTO v_quote;
  RETURN v_quote;
END $$;

CREATE OR REPLACE FUNCTION public.purchase_festival_edition_insurance(p_quote_id uuid, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_insurance_policies LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_q public.festival_edition_insurance_quotes%ROWTYPE; v_e public.festival_editions%ROWTYPE; v_policy public.festival_insurance_policies%ROWTYPE; v_current public.festival_edition_insurance_quotes%ROWTYPE;
BEGIN
  SELECT * INTO v_q FROM public.festival_edition_insurance_quotes WHERE id=p_quote_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Insurance quote not found'; END IF;
  IF NOT public.festival_admin_can_operate_edition(v_q.edition_id, ARRAY['operations_manager','finance_manager','safety_officer']) THEN RAISE EXCEPTION 'Insurance purchase authority required'; END IF;
  IF v_q.expires_at <= now() THEN RAISE EXCEPTION 'Insurance quote expired'; END IF;
  v_current := public.quote_festival_edition_insurance(v_q.edition_id,v_q.provider,v_q.coverage_type);
  IF v_current.input_hash <> v_q.input_hash THEN RAISE EXCEPTION 'Edition facts changed since quote'; END IF;
  SELECT * INTO v_e FROM public.festival_editions WHERE id=v_q.edition_id;
  IF EXISTS (SELECT 1 FROM public.festival_insurance_policies WHERE edition_id=v_q.edition_id AND active AND policy_status IN ('active','pending_payment')) THEN RAISE EXCEPTION 'Active policy already exists; use replacement workflow'; END IF;
  IF p_idempotency_key IS NOT NULL THEN SELECT * INTO v_policy FROM public.festival_insurance_policies WHERE edition_id=v_q.edition_id AND idempotency_key=p_idempotency_key; IF FOUND THEN RETURN v_policy; END IF; END IF;
  INSERT INTO public.festival_insurance_policies(festival_id,edition_id,coverage_type,premium_cents,payout_ceiling_cents,weather_rider,active,effective_from,effective_to,quote_id,policy_status,idempotency_key)
  VALUES (v_e.festival_id,v_q.edition_id,CASE WHEN v_q.coverage_type IN ('basic','standard','premium','all_risk') THEN v_q.coverage_type ELSE 'standard' END,v_q.premium_cents,v_q.ceiling_cents,(v_q.coverage_type IN ('weather','all_risk')),true,current_date,v_e.end_at::date,p_quote_id,'pending_payment',p_idempotency_key) RETURNING * INTO v_policy;
  UPDATE public.festival_edition_insurance_quotes SET status='purchased' WHERE id=p_quote_id;
  PERFORM public.post_festival_edition_ledger_entry(v_q.edition_id,'insurance','expense',v_q.premium_cents,v_e.currency_code,'committed','insurance_quote',p_quote_id,'festival_insurance_policy',v_policy.id,v_e.start_at,'Insurance premium obligation',p_idempotency_key || ':ledger');
  PERFORM public.festival_audit(v_q.edition_id,'insurance_purchased','festival_insurance_policy',v_policy.id,'{}',to_jsonb(v_policy),'insurance purchase',p_idempotency_key);
  RETURN v_policy;
END $$;

CREATE OR REPLACE FUNCTION public.update_festival_edition_budget(p_edition_id uuid, p_new_budget_cents bigint, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_editions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old public.festival_editions%ROWTYPE; v_new public.festival_editions%ROWTYPE;
BEGIN
  IF NOT public.festival_admin_can_operate_edition(p_edition_id, ARRAY['finance_manager']) THEN RAISE EXCEPTION 'Budget authority required'; END IF;
  IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Budget update reason required'; END IF;
  SELECT * INTO v_old FROM public.festival_editions WHERE id=p_edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Edition not found'; END IF;
  INSERT INTO public.festival_edition_budget_changes(edition_id,original_budget_cents,previous_budget_cents,new_budget_cents,actor_profile_id,reason,metadata) VALUES (p_edition_id,coalesce(v_old.lifecycle_metadata->>'original_budget_cents',v_old.budget_cents::text)::bigint,v_old.budget_cents,p_new_budget_cents,public.current_profile_id_safe(),p_reason,jsonb_build_object('idempotency_key',p_idempotency_key));
  UPDATE public.festival_editions SET budget_cents=p_new_budget_cents,lifecycle_metadata=lifecycle_metadata || jsonb_build_object('original_budget_cents',coalesce(lifecycle_metadata->>'original_budget_cents',budget_cents::text)),updated_at=now() WHERE id=p_edition_id RETURNING * INTO v_new;
  PERFORM public.festival_audit(p_edition_id,'budget_updated','festival_edition',p_edition_id,to_jsonb(v_old),to_jsonb(v_new),p_reason,p_idempotency_key);
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.festival_edition_finance_summary(p_edition_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  WITH e AS (SELECT * FROM public.festival_editions WHERE id=p_edition_id), l AS (SELECT * FROM public.festival_expense_ledger WHERE edition_id=p_edition_id), totals AS (
    SELECT coalesce(sum(amount_cents) FILTER (WHERE direction='expense' AND status IN ('committed','accrued','paid')),0) committed_cost,
      coalesce(sum(amount_cents) FILTER (WHERE direction='expense' AND status IN ('accrued','paid')),0) accrued_cost,
      coalesce(sum(amount_cents) FILTER (WHERE direction='expense' AND status='paid'),0) paid_cost,
      coalesce(sum(amount_cents) FILTER (WHERE direction='income' AND status IN ('expected','committed','accrued','received')),0) expected_income,
      coalesce(sum(amount_cents) FILTER (WHERE direction='income' AND status IN ('accrued','received')),0) accrued_income,
      coalesce(sum(amount_cents) FILTER (WHERE direction='income' AND status='received'),0) received_income,
      count(*) FILTER (WHERE currency_code <> (SELECT currency_code FROM e)) currency_mismatches,
      count(*) FILTER (WHERE source_type IS NULL OR source_id IS NULL) source_missing,
      count(*) FILTER (WHERE status <> 'paid' AND due_at < now()) overdue
    FROM l)
  SELECT jsonb_build_object('budget_cents',(SELECT budget_cents FROM e),'committed_cost_cents',committed_cost,'accrued_cost_cents',accrued_cost,'paid_cost_cents',paid_cost,'expected_income_cents',expected_income,'accrued_income_cents',accrued_income,'received_income_cents',received_income,'forecast_profit_cents',expected_income-committed_cost,'actual_profit_cents',received_income-paid_cost,'cash_requirement_cents',greatest(committed_cost-expected_income,0),'overdue_obligations',overdue,'settlement_pending',(SELECT status::text FROM e) IN ('settling','completed'),'currency',(SELECT currency_code FROM e),'blockers',jsonb_strip_nulls(jsonb_build_array(CASE WHEN currency_mismatches>0 THEN 'currency_mismatch' END, CASE WHEN source_missing>0 THEN 'ledger_entry_without_source' END)),'warnings',jsonb_strip_nulls(jsonb_build_array(CASE WHEN overdue>0 THEN 'overdue_obligations' END))) FROM totals;
$$;

CREATE OR REPLACE FUNCTION public.preview_copy_festival_edition(p_source_edition_id uuid, p_target_edition_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('source_edition_id',p_source_edition_id,'target_edition_id',p_target_edition_id,'resources',jsonb_build_object('stages',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',stage_name,'type',stage_type,'capacity',capacity,'genre_focus',genre_focus,'technical_metadata',technical_metadata,'public_metadata',public_metadata)),'[]') FROM public.festival_stages WHERE edition_id=p_source_edition_id AND archived_at IS NULL),'slot_templates',(SELECT coalesce(jsonb_agg(jsonb_build_object('stage_id',stage_id,'template',slot_template,'slot_type',slot_type,'duration_minutes',extract(epoch from (end_time-start_time))/60)),'[]') FROM public.festival_stage_slots WHERE edition_id=p_source_edition_id AND archived_at IS NULL),'staffing_requirements',public.festival_edition_staffing_readiness(p_source_edition_id),'permit_requirements',public.festival_edition_permit_requirements(p_source_edition_id),'insurance_configuration',(SELECT coalesce(jsonb_agg(to_jsonb(q)),'[]') FROM public.festival_edition_insurance_quotes q WHERE q.edition_id=p_source_edition_id),'ticket_tiers','[]'::jsonb,'marketing_plan','{}'::jsonb,'sponsor_templates','[]'::jsonb,'facilities','[]'::jsonb,'operational_configuration','{}'::jsonb),'excluded',jsonb_build_array('contracts','applications','offers','performers','reservations','sessions','attendance','outcomes','incidents','ledger_transactions','payments'));
$$;

CREATE OR REPLACE FUNCTION public.copy_festival_edition(p_source_edition_id uuid, p_target_edition_id uuid, p_resource_groups text[] DEFAULT ARRAY['stages','slots'], p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_source public.festival_editions%ROWTYPE; v_target public.festival_editions%ROWTYPE; v_stage public.festival_stages%ROWTYPE; v_new_stage public.festival_stages%ROWTYPE; v_map jsonb:='{}'::jsonb; v_count integer:=0;
BEGIN
  SELECT * INTO v_source FROM public.festival_editions WHERE id=p_source_edition_id; SELECT * INTO v_target FROM public.festival_editions WHERE id=p_target_edition_id FOR UPDATE;
  IF v_source.id IS NULL OR v_target.id IS NULL THEN RAISE EXCEPTION 'Source and target editions are required'; END IF;
  IF NOT public.festival_admin_can_operate_edition(p_target_edition_id, ARRAY['operations_manager','stage_manager']) THEN RAISE EXCEPTION 'Edition copy authority required'; END IF;
  IF p_idempotency_key IS NOT NULL AND EXISTS (SELECT 1 FROM public.festival_admin_audit_events WHERE operation='edition_copied' AND edition_id=p_target_edition_id AND idempotency_key=p_idempotency_key) THEN RETURN jsonb_build_object('idempotent',true,'target_edition_id',p_target_edition_id); END IF;
  IF 'stages'=ANY(p_resource_groups) THEN
    FOR v_stage IN SELECT * FROM public.festival_stages WHERE edition_id=p_source_edition_id AND archived_at IS NULL ORDER BY stage_number LOOP
      v_new_stage := public.create_festival_edition_stage(p_target_edition_id,v_stage.stage_name,v_stage.stage_type,v_stage.capacity,v_stage.genre_focus,v_stage.stage_size,v_stage.sound_capability,v_stage.lighting_capability,v_stage.backstage_capability,v_stage.weather_protection,v_stage.default_changeover_minutes,v_stage.curfew_time,v_stage.technical_metadata,v_stage.public_metadata,p_idempotency_key || ':stage:' || v_stage.id);
      v_map := v_map || jsonb_build_object(v_stage.id::text,v_new_stage.id); v_count := v_count + 1;
    END LOOP;
  END IF;
  PERFORM public.festival_audit(p_target_edition_id,'edition_copied','festival_edition',p_target_edition_id,'{}',jsonb_build_object('source_edition_id',p_source_edition_id,'stage_count',v_count,'excluded','historical/live data'),NULL,p_idempotency_key);
  RETURN jsonb_build_object('copied',true,'stage_count',v_count,'stage_map',v_map,'excluded',jsonb_build_array('contracts','applications','offers','performers','reservations','sessions','attendance','outcomes','incidents','ledger_transactions','payments'));
END $$;

CREATE OR REPLACE FUNCTION public.admin_apply_legacy_festival_migration(p_game_event_id uuid, p_target_festival_id uuid, p_target_edition_id uuid, p_preview_hash text, p_reason text, p_idempotency_key text DEFAULT NULL, p_choices jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ge public.game_events%ROWTYPE; v_hash text; v_existing public.festival_legacy_mappings%ROWTYPE;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) THEN RAISE EXCEPTION 'Admin authority required'; END IF;
  IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Legacy migration reason required'; END IF;
  SELECT * INTO v_ge FROM public.game_events WHERE id=p_game_event_id AND event_type='festival' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Legacy festival source not found'; END IF;
  v_hash := md5(public.admin_preview_legacy_festival_migration(p_game_event_id)::text);
  IF v_hash <> p_preview_hash THEN RAISE EXCEPTION 'Legacy source changed after preview'; END IF;
  SELECT * INTO v_existing FROM public.festival_legacy_mappings WHERE legacy_source='game_event' AND legacy_id=p_game_event_id;
  IF FOUND THEN RETURN jsonb_build_object('idempotent',true,'mapping_id',v_existing.id,'edition_id',v_existing.edition_id); END IF;
  INSERT INTO public.festival_legacy_mappings(edition_id,legacy_source,legacy_id,legacy_festival_id,metadata) VALUES (p_target_edition_id,'game_event',p_game_event_id,p_target_festival_id,jsonb_build_object('source_snapshot',to_jsonb(v_ge),'choices',p_choices,'historical_only',coalesce(p_choices->>'historical_only','false')::boolean,'read_only',true)) RETURNING * INTO v_existing;
  UPDATE public.game_events SET requirements=coalesce(requirements,'{}'::jsonb) || jsonb_build_object('canonical_festival_edition_id',p_target_edition_id,'legacy_festival_read_only',true) WHERE id=p_game_event_id;
  PERFORM public.festival_audit(p_target_edition_id,'legacy_migration_applied','game_event',p_game_event_id,'{}',to_jsonb(v_existing),p_reason,p_idempotency_key);
  RETURN jsonb_build_object('applied',true,'mapping_id',v_existing.id,'edition_id',p_target_edition_id,'read_only',true);
END $$;

CREATE OR REPLACE FUNCTION public.festival_data_health(p_edition_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(issue),'[]'::jsonb) FROM (
    SELECT jsonb_build_object('code','operation_row_without_edition','severity','blocker','source_table',source_table,'source_id',source_id) issue FROM public.festival_operation_migration_issues WHERE proposed_edition_id=p_edition_id OR (proposed_edition_id IS NULL AND resolution_status='open')
    UNION ALL SELECT jsonb_build_object('code','slot_with_mismatched_stage_edition','severity','critical','source_id',sl.id) FROM public.festival_stage_slots sl JOIN public.festival_stages st ON st.id=sl.stage_id WHERE sl.edition_id<>st.edition_id AND sl.edition_id=p_edition_id
    UNION ALL SELECT jsonb_build_object('code','overlapping_slots','severity','critical','source_id',a.id) FROM public.festival_stage_slots a JOIN public.festival_stage_slots b ON a.stage_id=b.stage_id AND a.id<b.id AND tstzrange(a.start_time,a.end_time,'[)') && tstzrange(b.start_time,b.end_time,'[)') WHERE a.edition_id=p_edition_id AND a.archived_at IS NULL AND b.archived_at IS NULL
    UNION ALL SELECT jsonb_build_object('code','system_act_without_reservation','severity','warning','source_id',sa.id) FROM public.festival_system_acts sa WHERE sa.edition_id=p_edition_id AND sa.status='assigned' AND sa.slot_id IS NULL
    UNION ALL SELECT jsonb_build_object('code','ledger_entry_without_source','severity','warning','source_id',l.id) FROM public.festival_expense_ledger l WHERE l.edition_id=p_edition_id AND (l.source_type IS NULL OR l.source_id IS NULL)
    UNION ALL SELECT jsonb_build_object('code','currency_mismatch','severity','critical','source_id',l.id) FROM public.festival_expense_ledger l JOIN public.festival_editions e ON e.id=l.edition_id WHERE l.edition_id=p_edition_id AND l.currency_code<>e.currency_code
    UNION ALL SELECT jsonb_build_object('code','permit_missing','severity','blocker','source_id',p_edition_id) WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(public.festival_edition_permit_requirements(p_edition_id)) r WHERE r->>'blocker'='true')
    UNION ALL SELECT jsonb_build_object('code','insurance_missing','severity','blocker','source_id',p_edition_id) WHERE NOT EXISTS (SELECT 1 FROM public.festival_insurance_policies WHERE edition_id=p_edition_id AND active)
    UNION ALL SELECT jsonb_build_object('code','staffing_gap','severity','blocker','source_id',p_edition_id) WHERE jsonb_array_length(coalesce(public.festival_edition_staffing_readiness(p_edition_id)->'blockers','[]'::jsonb))>0
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.repair_festival_data_health_issue(p_issue_id uuid, p_action text, p_confirmation text, p_reason text, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_issue public.festival_operation_migration_issues%ROWTYPE;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false) THEN RAISE EXCEPTION 'Repair requires admin authority'; END IF;
  IF p_confirmation <> 'CONFIRM' THEN RAISE EXCEPTION 'Repair confirmation required'; END IF;
  SELECT * INTO v_issue FROM public.festival_operation_migration_issues WHERE id=p_issue_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Issue not found'; END IF;
  IF p_action IN ('mark_duplicate_legacy_row','mark_historical_only','attach_deterministic_edition','rebuild_missing_mapping','release_stale_reservation','expire_stale_offer','recalculate_readiness_projection') THEN
    UPDATE public.festival_operation_migration_issues SET resolution_status=CASE WHEN p_action='mark_duplicate_legacy_row' THEN 'duplicate' WHEN p_action='mark_historical_only' THEN 'historical_only' ELSE 'resolved' END,resolved_by=public.current_profile_id_safe(),resolved_at=now(),metadata=metadata || jsonb_build_object('repair_action',p_action,'reason',p_reason) WHERE id=p_issue_id;
    PERFORM public.festival_audit(v_issue.proposed_edition_id,'data_health_repaired','festival_operation_migration_issue',p_issue_id,to_jsonb(v_issue),jsonb_build_object('action',p_action),p_reason,p_idempotency_key);
    RETURN jsonb_build_object('repaired',true,'action',p_action,'impact','Safe audited repair recorded; no generic fix-all mutation was run');
  END IF;
  RAISE EXCEPTION 'Unsupported repair action';
END $$;

CREATE OR REPLACE FUNCTION public.festival_edition_settlement_readiness(p_edition_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  WITH e AS (SELECT * FROM public.festival_editions WHERE id=p_edition_id), facts AS (
    SELECT (SELECT status::text FROM e) lifecycle_state,
      (SELECT count(*) FROM public.festival_performance_sessions s WHERE s.edition_id=p_edition_id AND s.status NOT IN ('completed','cancelled')) nonterminal_sessions,
      (SELECT count(*) FROM public.festival_performance_sessions s LEFT JOIN public.festival_performance_outcomes o ON o.session_id=s.id WHERE s.edition_id=p_edition_id AND s.status='completed' AND o.id IS NULL) missing_outcomes,
      (SELECT count(*) FROM public.festival_performance_outcomes o WHERE o.edition_id=p_edition_id AND o.invalidated_at IS NOT NULL) invalidated_outcomes,
      (SELECT count(*) FROM public.festival_pending_career_effects pe WHERE pe.edition_id=p_edition_id AND pe.status='pending') pending_effects,
      (SELECT count(*) FROM public.festival_expense_ledger l JOIN e ON true WHERE l.edition_id=p_edition_id AND l.currency_code<>e.currency_code) currency_mismatch,
      (SELECT count(*) FROM public.festival_staff s WHERE s.edition_id=p_edition_id AND s.status='active') staff_obligations,
      (SELECT count(*) FROM public.festival_permits p WHERE p.edition_id=p_edition_id AND p.status='approved') permit_obligations,
      (SELECT count(*) FROM public.festival_insurance_policies p WHERE p.edition_id=p_edition_id AND p.active) insurance_obligations,
      (SELECT count(*) FROM public.festival_operation_migration_issues i WHERE i.resolution_status='open' AND i.severity IN ('blocker','critical') AND (i.proposed_edition_id=p_edition_id OR i.proposed_edition_id IS NULL)) migration_blockers
  ) SELECT jsonb_build_object('lifecycle_state',lifecycle_state,'nonterminal_sessions',nonterminal_sessions,'missing_outcomes',missing_outcomes,'invalidated_outcomes',invalidated_outcomes,'pending_effects',pending_effects,'ledger_currency_consistent',currency_mismatch=0,'staff_obligations_exist',staff_obligations>0,'permit_obligations_exist',permit_obligations>0,'insurance_obligations_exist',insurance_obligations>0,'migration_blockers',migration_blockers,'blockers',jsonb_strip_nulls(jsonb_build_array(CASE WHEN lifecycle_state NOT IN ('settling','completed') THEN 'edition_not_in_settlement_state' END,CASE WHEN nonterminal_sessions>0 THEN 'sessions_not_terminal' END,CASE WHEN missing_outcomes>0 THEN 'missing_outcomes' END,CASE WHEN invalidated_outcomes>0 THEN 'invalidated_outcomes_need_replacement' END,CASE WHEN currency_mismatch>0 THEN 'ledger_currency_mismatch' END,CASE WHEN staff_obligations=0 THEN 'staff_obligations_missing' END,CASE WHEN permit_obligations=0 THEN 'permit_obligations_missing' END,CASE WHEN insurance_obligations=0 THEN 'insurance_obligations_missing' END,CASE WHEN migration_blockers>0 THEN 'operational_migration_blockers' END)),'warnings',jsonb_strip_nulls(jsonb_build_array(CASE WHEN pending_effects>0 THEN 'pending_career_effects_wait_for_next_pr' END)),'ready_for_settlement', lifecycle_state IN ('settling','completed') AND nonterminal_sessions=0 AND missing_outcomes=0 AND invalidated_outcomes=0 AND currency_mismatch=0 AND staff_obligations>0 AND permit_obligations>0 AND insurance_obligations>0 AND migration_blockers=0) FROM facts;
$$;

CREATE OR REPLACE FUNCTION public.prevent_legacy_festival_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_id uuid; v_type text; v_meta jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := OLD.id; v_type := OLD.event_type; v_meta := coalesce(OLD.requirements, '{}'::jsonb);
  ELSE
    v_id := NEW.id; v_type := NEW.event_type; v_meta := coalesce(NEW.requirements, '{}'::jsonb);
  END IF;
  IF v_type='festival' AND coalesce(v_meta->>'legacy_festival_read_only','false')::boolean AND current_setting('app.allow_legacy_festival_migration', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Legacy festival records mapped to canonical editions are read-only';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_prevent_legacy_festival_game_event_writes ON public.game_events;
CREATE TRIGGER tg_prevent_legacy_festival_game_event_writes BEFORE INSERT OR UPDATE ON public.game_events FOR EACH ROW EXECUTE FUNCTION public.prevent_legacy_festival_writes();

CREATE OR REPLACE FUNCTION public.prevent_legacy_festival_participant_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_event uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_event := OLD.event_id; ELSE v_event := NEW.event_id; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_legacy_mappings WHERE legacy_source='game_event' AND legacy_id=v_event) AND current_setting('app.allow_legacy_festival_migration', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Legacy festival participant writes are blocked after canonical mapping';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_prevent_legacy_festival_participant_writes ON public.festival_participants;
CREATE TRIGGER tg_prevent_legacy_festival_participant_writes BEFORE INSERT OR UPDATE OR DELETE ON public.festival_participants FOR EACH ROW EXECUTE FUNCTION public.prevent_legacy_festival_participant_writes();

DROP POLICY IF EXISTS "Authenticated users manage stages" ON public.festival_stages;
CREATE POLICY festival_stage_canonical_manage ON public.festival_stages FOR ALL TO authenticated USING (edition_id IS NOT NULL AND public.festival_admin_can_operate_edition(edition_id, ARRAY['operations_manager','stage_manager'])) WITH CHECK (edition_id IS NOT NULL AND public.festival_admin_can_operate_edition(edition_id, ARRAY['operations_manager','stage_manager']));
DROP POLICY IF EXISTS "Authenticated users manage slots" ON public.festival_stage_slots;
CREATE POLICY festival_slot_canonical_manage ON public.festival_stage_slots FOR ALL TO authenticated USING (edition_id IS NOT NULL AND public.festival_admin_can_operate_edition(edition_id, ARRAY['operations_manager','stage_manager'])) WITH CHECK (edition_id IS NOT NULL AND public.festival_admin_can_operate_edition(edition_id, ARRAY['operations_manager','stage_manager']));
REVOKE INSERT ON public.festival_expense_ledger FROM authenticated;

GRANT EXECUTE ON FUNCTION public.create_festival_edition_stage(uuid,text,text,integer,text,text,text,text,text,text,integer,time,jsonb,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_festival_edition_stage(uuid,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_festival_edition_stage(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_festival_stage_slots(uuid,date,time,time,jsonb,integer,jsonb,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_festival_stage_slot(uuid,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_festival_stage_slot(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_festival_system_act(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_festival_system_act(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hire_festival_edition_staff(uuid,uuid,text,bigint,jsonb,timestamptz,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_edition_staffing_readiness(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_edition_permit_requirements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_for_festival_edition_permit(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quote_festival_edition_insurance(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_festival_edition_insurance(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_festival_edition_ledger_entry(uuid,text,text,bigint,text,text,text,uuid,text,uuid,timestamptz,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_edition_finance_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_copy_festival_edition(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_festival_edition(uuid,uuid,text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_legacy_festival_migration(uuid,uuid,uuid,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_data_health(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_festival_data_health_issue(uuid,text,text,text,text) TO authenticated;
