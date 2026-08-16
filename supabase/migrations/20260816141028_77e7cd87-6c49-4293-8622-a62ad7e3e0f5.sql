-- =========================================================
-- Festival live runtime + scheduling backend
-- =========================================================

CREATE TABLE IF NOT EXISTS public.festival_edition_runtimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL UNIQUE,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'preparing',
  version integer NOT NULL DEFAULT 1,
  simulated_time timestamptz NOT NULL DEFAULT now(),
  gate_status text NOT NULL DEFAULT 'closed',
  admitted integer NOT NULL DEFAULT 0,
  departed integer NOT NULL DEFAULT 0,
  notes text,
  last_action text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.festival_edition_runtimes TO authenticated;
GRANT ALL ON public.festival_edition_runtimes TO service_role;
ALTER TABLE public.festival_edition_runtimes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "festival_runtime_owner_read" ON public.festival_edition_runtimes;
CREATE POLICY "festival_runtime_owner_read" ON public.festival_edition_runtimes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.festival_companies fc
      WHERE fc.id = festival_edition_runtimes.festival_company_id
        AND fc.owner_profile_id = public._caller_profile_id()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "festival_runtime_owner_write" ON public.festival_edition_runtimes;
CREATE POLICY "festival_runtime_owner_write" ON public.festival_edition_runtimes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.festival_companies fc
      WHERE fc.id = festival_edition_runtimes.festival_company_id
        AND fc.owner_profile_id = public._caller_profile_id()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.festival_companies fc
      WHERE fc.id = festival_edition_runtimes.festival_company_id
        AND fc.owner_profile_id = public._caller_profile_id()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE TRIGGER trg_festival_edition_runtimes_updated_at
  BEFORE UPDATE ON public.festival_edition_runtimes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.festival_stage_operating_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  festival_date date NOT NULL,
  opening_time time NOT NULL DEFAULT '12:00',
  curfew time NOT NULL DEFAULT '23:00',
  shutdown_buffer_minutes integer NOT NULL DEFAULT 0,
  changeover_minutes integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, stage_id, festival_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.festival_stage_operating_hours TO authenticated;
GRANT ALL ON public.festival_stage_operating_hours TO service_role;
ALTER TABLE public.festival_stage_operating_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "festival_stage_hours_manage" ON public.festival_stage_operating_hours;
CREATE POLICY "festival_stage_hours_manage" ON public.festival_stage_operating_hours
  FOR ALL TO authenticated
  USING (coalesce(public.can_manage_festival_edition(edition_id), false) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (coalesce(public.can_manage_festival_edition(edition_id), false) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_festival_stage_operating_hours_updated_at
  BEFORE UPDATE ON public.festival_stage_operating_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Live control room projection
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_festival_edition_runtime_control_room(
  p_festival_company_id uuid,
  p_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_admin boolean := coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false);
  v_fc public.festival_companies%ROWTYPE;
  v_ed public.festival_editions_v2%ROWTYPE;
  v_rt public.festival_edition_runtimes%ROWTYPE;
  v_state text;
  v_capacity integer;
  v_expected integer;
  v_admitted integer;
  v_onsite integer;
  v_departed integer;
  v_progress numeric := 0;
  v_now timestamptz := now();
  v_stages jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_staff_total integer := 0;
  v_staff_ready integer := 0;
  v_supplier_total integer := 0;
  v_supplier_ready integer := 0;
  v_sponsor_total integer := 0;
  v_blockers jsonb := '[]'::jsonb;
  v_quality numeric;
  v_gate text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_festival_company_id;
  IF v_fc.id IS NULL THEN RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE = 'P0001'; END IF;
  IF v_fc.owner_profile_id IS DISTINCT FROM v_profile AND NOT v_admin THEN
    RAISE EXCEPTION 'festival_runtime_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_ed FROM public.festival_editions_v2
   WHERE id = p_edition_id AND festival_company_id = p_festival_company_id;
  IF v_ed.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_rt FROM public.festival_edition_runtimes WHERE edition_id = v_ed.id;

  IF v_rt.id IS NULL AND coalesce(v_ed.status::text, 'draft') NOT IN ('launched', 'live', 'completed', 'settled') THEN
    RETURN NULL;
  END IF;

  v_state := coalesce(
    v_rt.state,
    CASE coalesce(v_ed.status::text, 'draft')
      WHEN 'live' THEN 'live'
      WHEN 'launched' THEN 'ready'
      WHEN 'completed' THEN 'completed'
      WHEN 'settled' THEN 'completed'
      ELSE 'preparing'
    END
  );

  v_capacity := greatest(0, coalesce(v_ed.expected_capacity, 0));

  SELECT greatest(0, coalesce(round(v_capacity * (coalesce(tp.expected_sell_through_basis_points, 7000)::numeric / 10000))::integer, 0))
    INTO v_expected
  FROM public.festival_ticket_plans tp
  WHERE tp.festival_company_id = v_fc.id
  ORDER BY tp.updated_at DESC NULLS LAST
  LIMIT 1;
  v_expected := coalesce(v_expected, round(v_capacity * 0.7)::integer);

  IF v_ed.starts_on IS NOT NULL AND v_ed.ends_on IS NOT NULL AND v_ed.ends_on >= v_ed.starts_on THEN
    v_progress := least(1, greatest(0,
      (v_now::date - v_ed.starts_on)::numeric / greatest(1, (v_ed.ends_on - v_ed.starts_on) + 1)::numeric
    ));
  END IF;

  IF v_state IN ('completed', 'aborted') THEN
    v_progress := 1;
  ELSIF v_state IN ('preparing', 'ready') THEN
    v_progress := 0;
  END IF;

  v_admitted := coalesce(nullif(v_rt.admitted, 0), round(v_expected * least(1, v_progress + 0.15))::integer);
  v_admitted := least(v_expected, greatest(0, v_admitted));
  v_departed := coalesce(nullif(v_rt.departed, 0), round(v_admitted * v_progress * 0.35)::integer);
  v_departed := least(v_admitted, greatest(0, v_departed));
  v_onsite := least(v_capacity, v_admitted - v_departed);
  IF v_onsite < 0 THEN v_onsite := 0; END IF;
  v_departed := v_admitted - v_onsite;

  v_gate := CASE
    WHEN v_state IN ('gates_open', 'live', 'closing') THEN 'open'
    WHEN v_state = 'paused' THEN 'paused'
    ELSE coalesce(v_rt.gate_status, 'closed')
  END;

  SELECT coalesce(jsonb_agg(payload ORDER BY stage_number NULLS LAST, stage_name), '[]'::jsonb)
    INTO v_stages
  FROM (
    SELECT s.stage_number, s.stage_name,
      jsonb_build_object(
        'id', s.id::text,
        'name', coalesce(nullif(btrim(s.public_name), ''), nullif(btrim(s.stage_name), ''), 'Stage'),
        'status', CASE WHEN v_state IN ('live', 'closing') THEN 'performing'
                       WHEN v_state = 'paused' THEN 'paused'
                       WHEN v_state IN ('gates_open', 'ready') THEN 'standby'
                       WHEN v_state = 'completed' THEN 'closed'
                       ELSE 'setup' END,
        'currentArtist', (
          SELECT coalesce(b.name, sl.npc_dj_name, initcap(replace(coalesce(sl.slot_type, 'performance'), '_', ' ')))
          FROM public.festival_stage_slots sl
          LEFT JOIN public.bands b ON b.id = sl.band_id
          WHERE sl.stage_id = s.id AND sl.start_time <= v_now AND sl.end_time > v_now
          ORDER BY sl.start_time LIMIT 1
        ),
        'nextArtist', (
          SELECT coalesce(b.name, sl.npc_dj_name, initcap(replace(coalesce(sl.slot_type, 'performance'), '_', ' ')))
          FROM public.festival_stage_slots sl
          LEFT JOIN public.bands b ON b.id = sl.band_id
          WHERE sl.stage_id = s.id AND sl.start_time > v_now
          ORDER BY sl.start_time LIMIT 1
        ),
        'delayMinutes', 0,
        'artistReady', EXISTS (
          SELECT 1 FROM public.festival_stage_slots sl
          WHERE sl.stage_id = s.id AND sl.band_id IS NOT NULL
        )
      ) AS payload
    FROM public.festival_stages s
    WHERE s.edition_id = v_ed.id AND s.archived_at IS NULL
  ) rows;

  SELECT count(*)::integer, count(*) FILTER (WHERE op.staff_budget_minor > 0)::integer,
         count(*)::integer, count(*) FILTER (WHERE op.supplier_budget_minor > 0)::integer
    INTO v_staff_total, v_staff_ready, v_supplier_total, v_supplier_ready
  FROM public.festival_operations_plans op
  WHERE op.festival_company_id = v_fc.id;

  SELECT count(*)::integer INTO v_sponsor_total
  FROM public.festival_sponsorships fs WHERE fs.festival_id = v_ed.id;

  IF v_capacity = 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'capacity_missing', 'message', 'This edition has no capacity set, so attendance cannot be simulated.'));
  END IF;
  IF v_stages = '[]'::jsonb THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'stages_missing', 'message', 'No stages are configured for this edition yet.'));
  END IF;

  v_quality := 55 + least(30, (v_sponsor_total * 4)) + CASE WHEN v_staff_ready > 0 THEN 8 ELSE 0 END + CASE WHEN v_supplier_ready > 0 THEN 7 ELSE 0 END;
  v_quality := least(100, greatest(0, v_quality));

  v_events := jsonb_build_array(
    jsonb_build_object('id', v_ed.id::text || ':state', 'occurredAt', to_char(coalesce(v_rt.updated_at, v_ed.updated_at, v_now) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'message', 'Festival simulation state: ' || replace(v_state, '_', ' ')),
    jsonb_build_object('id', v_ed.id::text || ':gates', 'occurredAt', to_char(coalesce(v_rt.updated_at, v_now) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'message', 'Gates are ' || v_gate || ' with ' || v_onsite::text || ' people on site')
  );

  RETURN jsonb_build_object(
    'runtimeId', coalesce(v_rt.id, v_ed.id)::text,
    'festivalCompanyId', v_fc.id::text,
    'editionId', v_ed.id::text,
    'state', v_state,
    'version', greatest(1, coalesce(v_rt.version, 1)),
    'simulatedTime', to_char(coalesce(v_rt.simulated_time, v_now) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'gates', jsonb_build_object('status', v_gate, 'queueSize', greatest(0, v_expected - v_admitted), 'waitMinutes',
      CASE WHEN v_gate = 'open' THEN least(45, greatest(0, (v_expected - v_admitted) / greatest(1, 200)))::numeric ELSE 0 END),
    'attendance', jsonb_build_object('expected', v_expected, 'admitted', v_admitted, 'onsite', v_onsite, 'departed', v_departed, 'capacity', v_capacity),
    'weather', jsonb_build_object('condition', 'clear', 'temperatureC', 18, 'warning', NULL),
    'readiness', jsonb_build_object(
      'staff', jsonb_build_object('ready', v_staff_ready, 'total', greatest(v_staff_total, v_staff_ready)),
      'suppliers', jsonb_build_object('ready', v_supplier_ready, 'total', greatest(v_supplier_total, v_supplier_ready)),
      'sponsors', jsonb_build_object('ready', v_sponsor_total, 'total', v_sponsor_total)
    ),
    'stages', v_stages,
    'incidents', '[]'::jsonb,
    'sales', jsonb_build_object(
      'foodAndDrinkMinor', (v_onsite * 1450)::bigint::integer,
      'merchandiseMinor', (v_onsite * 850)::bigint::integer
    ),
    'satisfaction', jsonb_build_object('audience', round(v_quality), 'artist', round(least(100, v_quality + 5))),
    'blockers', v_blockers,
    'recentEvents', v_events,
    'permissions', jsonb_build_object(
      'role', CASE WHEN v_fc.owner_profile_id = v_profile THEN 'owner' ELSE 'admin' END,
      'actions', jsonb_build_array('view_runtime', 'prepare_runtime', 'transition_runtime')
    )
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_festival_edition_runtime_control_room(uuid, uuid) TO authenticated, service_role;

-- =========================================================
-- Runtime lifecycle actions
-- =========================================================

CREATE OR REPLACE FUNCTION public.prepare_festival_edition_runtime(
  p_festival_company_id uuid,
  p_edition_id uuid,
  p_expected_edition_version integer DEFAULT NULL,
  p_expected_schedule_revision text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_admin boolean := coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false);
  v_fc public.festival_companies%ROWTYPE;
  v_ed public.festival_editions_v2%ROWTYPE;
  v_rt public.festival_edition_runtimes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_festival_company_id;
  IF v_fc.id IS NULL THEN RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE = 'P0001'; END IF;
  IF v_fc.owner_profile_id IS DISTINCT FROM v_profile AND NOT v_admin THEN
    RAISE EXCEPTION 'festival_runtime_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_ed FROM public.festival_editions_v2
   WHERE id = p_edition_id AND festival_company_id = p_festival_company_id;
  IF v_ed.id IS NULL THEN RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE = 'P0001'; END IF;

  IF p_expected_edition_version IS NOT NULL AND coalesce(v_ed.version, 0) <> p_expected_edition_version THEN
    RAISE EXCEPTION 'festival_runtime_stale' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_rt FROM public.festival_edition_runtimes WHERE edition_id = v_ed.id;

  IF v_rt.id IS NULL THEN
    INSERT INTO public.festival_edition_runtimes (edition_id, festival_company_id, state, gate_status, simulated_time, idempotency_key, last_action)
    VALUES (v_ed.id, v_fc.id, 'preparing', 'closed', now(), p_idempotency_key, 'prepare')
    RETURNING * INTO v_rt;
  END IF;

  RETURN public.get_festival_edition_runtime_control_room(p_festival_company_id, p_edition_id);
END $$;

GRANT EXECUTE ON FUNCTION public.prepare_festival_edition_runtime(uuid, uuid, integer, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.transition_festival_edition_runtime(
  p_runtime_id uuid,
  p_expected_version integer,
  p_action text,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_admin boolean := coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false);
  v_rt public.festival_edition_runtimes%ROWTYPE;
  v_owner uuid;
  v_allowed text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_rt FROM public.festival_edition_runtimes WHERE id = p_runtime_id FOR UPDATE;
  IF v_rt.id IS NULL THEN RAISE EXCEPTION 'festival_runtime_not_found' USING ERRCODE = 'P0001'; END IF;

  SELECT owner_profile_id INTO v_owner FROM public.festival_companies WHERE id = v_rt.festival_company_id;
  IF v_owner IS DISTINCT FROM v_profile AND NOT v_admin THEN
    RAISE EXCEPTION 'festival_runtime_forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF p_expected_version IS NOT NULL AND v_rt.version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_runtime_stale' USING ERRCODE = 'P0001';
  END IF;

  v_allowed := CASE v_rt.state
    WHEN 'preparing' THEN ARRAY['ready', 'aborted']
    WHEN 'ready' THEN ARRAY['gates_open', 'aborted']
    WHEN 'gates_open' THEN ARRAY['live', 'recovery_required', 'aborted']
    WHEN 'live' THEN ARRAY['paused', 'closing', 'recovery_required', 'aborted']
    WHEN 'paused' THEN ARRAY['live', 'closing', 'aborted']
    WHEN 'closing' THEN ARRAY['completed', 'recovery_required']
    WHEN 'recovery_required' THEN ARRAY['paused', 'live', 'aborted']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (p_action = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'festival_runtime_invalid_transition' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.festival_edition_runtimes
     SET state = p_action,
         version = version + 1,
         simulated_time = now(),
         gate_status = CASE WHEN p_action IN ('gates_open', 'live', 'closing') THEN 'open'
                            WHEN p_action = 'paused' THEN 'paused' ELSE 'closed' END,
         notes = coalesce(p_reason, notes),
         last_action = p_action,
         idempotency_key = coalesce(p_idempotency_key, idempotency_key)
   WHERE id = p_runtime_id;

  RETURN public.get_festival_edition_runtime_control_room(v_rt.festival_company_id, v_rt.edition_id);
END $$;

GRANT EXECUTE ON FUNCTION public.transition_festival_edition_runtime(uuid, integer, text, text, text) TO authenticated, service_role;

-- =========================================================
-- Running order (schedule) actions
-- =========================================================

CREATE OR REPLACE FUNCTION public.festival_schedule_configure_stage_hours(
  p_edition_id uuid,
  p_stage_id uuid,
  p_festival_date date,
  p_opening_time time DEFAULT '12:00',
  p_curfew time DEFAULT '23:00',
  p_shutdown_buffer_minutes integer DEFAULT 0,
  p_changeover_minutes integer DEFAULT 30,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT coalesce(public.can_manage_festival_edition(p_edition_id), false) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED';
  END IF;

  INSERT INTO public.festival_stage_operating_hours AS h
    (edition_id, stage_id, festival_date, opening_time, curfew, shutdown_buffer_minutes, changeover_minutes)
  VALUES (p_edition_id, p_stage_id, p_festival_date, p_opening_time, p_curfew,
          greatest(0, coalesce(p_shutdown_buffer_minutes, 0)), greatest(0, coalesce(p_changeover_minutes, 30)))
  ON CONFLICT (edition_id, stage_id, festival_date) DO UPDATE
    SET opening_time = excluded.opening_time,
        curfew = excluded.curfew,
        shutdown_buffer_minutes = excluded.shutdown_buffer_minutes,
        changeover_minutes = excluded.changeover_minutes;

  RETURN public.festival_edition_schedule_workspace(p_edition_id);
END $$;

GRANT EXECUTE ON FUNCTION public.festival_schedule_configure_stage_hours(uuid, uuid, date, time, time, integer, integer, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.festival_schedule_upsert_item(
  p_edition_id uuid,
  p_revision_id uuid,
  p_item jsonb,
  p_expected_version integer DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ed public.festival_editions%ROWTYPE;
  v_tz text;
  v_stage_id uuid := nullif(p_item->>'stage_id', '')::uuid;
  v_slot_id uuid := nullif(coalesce(p_item->>'stage_slot_id', p_item->>'id'), '')::uuid;
  v_date date := nullif(p_item->>'festival_date', '')::date;
  v_starts timestamptz := nullif(p_item->>'starts_at', '')::timestamptz;
  v_duration integer := greatest(5, coalesce(nullif(p_item->>'duration_minutes', '')::integer, 45));
  v_ends timestamptz := nullif(p_item->>'ends_at', '')::timestamptz;
  v_band uuid := nullif(p_item->>'band_id', '')::uuid;
  v_type text := coalesce(nullif(p_item->>'item_type', ''), 'performance_slot');
  v_changeover integer := greatest(0, coalesce(nullif(p_item->>'changeover_minutes', '')::integer, 0));
  v_day integer;
  v_slot_number integer;
BEGIN
  IF NOT coalesce(public.can_manage_festival_edition(p_edition_id), false) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED';
  END IF;

  SELECT * INTO v_ed FROM public.festival_editions WHERE id = p_edition_id;
  IF v_ed.id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_EDITION_NOT_FOUND'; END IF;
  v_tz := coalesce(nullif(v_ed.timezone, ''), 'UTC');

  IF v_stage_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_STAGE_REQUIRED'; END IF;
  IF v_starts IS NULL AND v_date IS NULL THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_START_REQUIRED'; END IF;
  IF v_starts IS NULL THEN
    v_starts := (v_date::timestamp + coalesce(nullif(p_item->>'start_time', '')::time, '12:00'::time)) AT TIME ZONE v_tz;
  END IF;
  IF v_ends IS NULL THEN v_ends := v_starts + make_interval(mins => v_duration); END IF;
  IF v_ends <= v_starts THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_INVALID_WINDOW'; END IF;

  v_day := greatest(1, ((v_starts AT TIME ZONE v_tz)::date - coalesce((v_ed.start_at AT TIME ZONE v_tz)::date, (v_starts AT TIME ZONE v_tz)::date)) + 1);

  IF v_slot_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.festival_stage_slots WHERE id = v_slot_id AND edition_id = p_edition_id) THEN
    UPDATE public.festival_stage_slots
       SET stage_id = v_stage_id,
           start_time = v_starts,
           end_time = v_ends,
           slot_type = v_type,
           band_id = coalesce(v_band, band_id),
           changeover_minutes = v_changeover,
           day_number = v_day
     WHERE id = v_slot_id;
  ELSE
    SELECT coalesce(max(slot_number), 0) + 1 INTO v_slot_number
      FROM public.festival_stage_slots
     WHERE stage_id = v_stage_id AND day_number = v_day;

    INSERT INTO public.festival_stage_slots
      (stage_id, festival_id, edition_id, day_number, slot_number, slot_type, band_id, start_time, end_time, status, changeover_minutes)
    VALUES (v_stage_id, v_ed.festival_id, p_edition_id, v_day, coalesce(v_slot_number, 1), v_type, v_band, v_starts, v_ends, 'open', v_changeover);
  END IF;

  RETURN public.festival_edition_schedule_workspace(p_edition_id);
END $$;

GRANT EXECUTE ON FUNCTION public.festival_schedule_upsert_item(uuid, uuid, jsonb, integer, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.festival_schedule_lock(
  p_edition_id uuid,
  p_revision_id uuid,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT coalesce(public.can_manage_festival_edition(p_edition_id), false) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED';
  END IF;

  UPDATE public.festival_editions
     SET lifecycle_metadata = coalesce(lifecycle_metadata, '{}'::jsonb) || jsonb_build_object(
           'scheduleLock', jsonb_build_object('locked', true, 'reason', p_reason, 'lockedAt', now())
         )
   WHERE id = p_edition_id;

  RETURN public.festival_edition_schedule_workspace(p_edition_id);
END $$;

GRANT EXECUTE ON FUNCTION public.festival_schedule_lock(uuid, uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.festival_schedule_reopen(
  p_edition_id uuid,
  p_revision_id uuid,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT coalesce(public.can_manage_festival_edition(p_edition_id), false) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED';
  END IF;

  UPDATE public.festival_editions
     SET lifecycle_metadata = coalesce(lifecycle_metadata, '{}'::jsonb) || jsonb_build_object(
           'scheduleLock', jsonb_build_object('locked', false, 'reason', p_reason, 'reopenedAt', now())
         )
   WHERE id = p_edition_id;

  RETURN public.festival_edition_schedule_workspace(p_edition_id);
END $$;

GRANT EXECUTE ON FUNCTION public.festival_schedule_reopen(uuid, uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.festival_schedule_discard_draft(
  p_edition_id uuid,
  p_revision_id uuid,
  p_reason text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT coalesce(public.can_manage_festival_edition(p_edition_id), false) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED';
  END IF;

  DELETE FROM public.festival_stage_slots
   WHERE edition_id = p_edition_id
     AND canonical_contract_id IS NULL
     AND band_id IS NULL
     AND coalesce(public_status, 'draft') <> 'published';

  RETURN public.festival_edition_schedule_workspace(p_edition_id);
END $$;

GRANT EXECUTE ON FUNCTION public.festival_schedule_discard_draft(uuid, uuid, text, text) TO authenticated, service_role;