-- REVIEW ONLY. Depends on canonical_edition_stage_evidence_ledger.sql.
-- Explicit operator-confirmed stage events in the *existing* annual edition
-- runtime. No timetable write-on-read, launch runtime, or synthetic states.
CREATE TABLE IF NOT EXISTS private.festival_edition_stage_action_receipts (
 runtime_id uuid NOT NULL REFERENCES public.festival_edition_runtimes(id),
 idempotency_key text NOT NULL,
 request_hash text NOT NULL,
 source_evidence_id uuid NOT NULL UNIQUE REFERENCES public.festival_runtime_evidence(id),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(runtime_id,idempotency_key)
);
ALTER TABLE private.festival_edition_stage_action_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.festival_edition_stage_action_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.festival_edition_stage_action_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.record_canonical_festival_stage_action(
 p_runtime_id uuid,p_stage_id uuid,p_schedule_item_id uuid,
 p_status text,p_idempotency_key text,p_expected_runtime_version integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
 v_runtime public.festival_edition_runtimes%ROWTYPE;
 v_edition public.festival_editions_v2%ROWTYPE;
 v_actor uuid:=public._caller_profile_id();
 v_owner uuid;
 v_timezone text;
 v_day date;
 v_item jsonb;
 v_hash text;
 v_receipt private.festival_edition_stage_action_receipts%ROWTYPE;
 v_evidence_id uuid;
 v_at timestamptz;
BEGIN
 IF auth.uid() IS NULL OR v_actor IS NULL THEN RAISE EXCEPTION 'festival_stage_action_unauthorised'; END IF;
 IF p_status NOT IN ('ready','starting','live','delayed','completed','cancelled')
    OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 12 AND 128 THEN
  RAISE EXCEPTION 'festival_stage_action_invalid';
 END IF;
 SELECT * INTO v_runtime FROM public.festival_edition_runtimes WHERE id=p_runtime_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'festival_stage_runtime_not_found'; END IF;
 SELECT owner_profile_id INTO v_owner FROM public.festival_companies WHERE id=v_runtime.festival_company_id;
 IF v_owner IS DISTINCT FROM v_actor
    AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN
  RAISE EXCEPTION 'festival_stage_action_forbidden';
 END IF;
 v_hash:=md5(p_stage_id::text||':'||p_schedule_item_id::text||':'||p_status);
 SELECT * INTO v_receipt FROM private.festival_edition_stage_action_receipts
 WHERE runtime_id=p_runtime_id AND idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF v_hash IS DISTINCT FROM v_receipt.request_hash THEN RAISE EXCEPTION 'festival_stage_action_idempotency_conflict'; END IF;
  RETURN jsonb_build_object('sourceEvidenceId',v_receipt.source_evidence_id,'status',p_status,'replayed',true);
 END IF;
 IF p_expected_runtime_version IS NOT NULL AND p_expected_runtime_version<>v_runtime.version
 THEN RAISE EXCEPTION 'festival_stage_runtime_stale'; END IF;
 IF (p_status='ready' AND v_runtime.state NOT IN ('gates_open','live'))
    OR (p_status<>'ready' AND v_runtime.state<>'live') THEN
  RAISE EXCEPTION 'festival_stage_runtime_not_live';
 END IF;
 SELECT * INTO v_edition FROM public.festival_editions_v2
 WHERE id=v_runtime.edition_id AND festival_company_id=v_runtime.festival_company_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'festival_stage_wrong_edition'; END IF;
 SELECT nullif(timezone,'') INTO v_timezone FROM public.cities WHERE id=v_edition.city_id;
 IF v_timezone IS NULL THEN RAISE EXCEPTION 'festival_stage_timezone_missing'; END IF;
 v_at:=clock_timestamp();
 v_day:=(v_at AT TIME ZONE v_timezone)::date;
 IF v_day NOT BETWEEN v_edition.starts_on AND v_edition.ends_on
 THEN RAISE EXCEPTION 'festival_stage_outside_festival_day'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.festival_site_plan_stages s
  JOIN public.festival_site_plans p ON p.id=s.festival_site_plan_id
  WHERE s.id=p_stage_id AND s.status='ready'
    AND p.festival_edition_id=v_runtime.edition_id
    AND p.festival_company_id=v_runtime.festival_company_id
 ) THEN RAISE EXCEPTION 'festival_stage_not_published_for_edition'; END IF;
 SELECT item.value INTO v_item
 FROM jsonb_array_elements(coalesce(v_runtime.generated_schedule->'items','[]'::jsonb)) item
 WHERE item.value->>'id'=p_schedule_item_id::text
   AND item.value->>'stageId'=p_stage_id::text
   AND item.value->>'festivalDate'=v_day::text LIMIT 1;
 IF v_item IS NULL THEN RAISE EXCEPTION 'festival_stage_slot_identity_mismatch'; END IF;
 INSERT INTO public.festival_runtime_evidence(runtime_id,evidence_type,evidence,evidence_digest)
 VALUES (
  p_runtime_id,'stage_'||p_status,
  jsonb_build_object(
   'stageId',p_stage_id,'scheduleItemId',p_schedule_item_id,'festivalDate',v_day,
   'observedAt',v_at,'source','operator_confirmed',
   'confirmedByProfileId',v_actor,
   'artistIdentity',jsonb_build_object('bandId',v_item->>'bandId','bookingId',v_item->>'sourceBookingId'),
   'actionId',p_idempotency_key
  ),
  md5(p_runtime_id::text||':'||p_idempotency_key||':'||v_hash)
 ) RETURNING id INTO v_evidence_id;
 -- The existing canonical stage-event trigger validates transitions atomically.
 INSERT INTO private.festival_edition_stage_action_receipts(runtime_id,idempotency_key,request_hash,source_evidence_id)
 VALUES(p_runtime_id,p_idempotency_key,v_hash,v_evidence_id);
 RETURN jsonb_build_object('sourceEvidenceId',v_evidence_id,'status',p_status,'stageId',p_stage_id,
  'scheduleItemId',p_schedule_item_id,'observedAt',v_at,'replayed',false);
END;
$body$;
REVOKE ALL ON FUNCTION public.record_canonical_festival_stage_action(uuid,uuid,uuid,text,text,integer)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_canonical_festival_stage_action(uuid,uuid,uuid,text,text,integer)
 TO authenticated;


-- Private owner control projection: no access to raw evidence, actor IDs,
-- ticket details or crowd headcounts. Never report scheduled work as live.
CREATE OR REPLACE FUNCTION public.get_canonical_festival_stage_control(p_runtime_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $control$
DECLARE
  v_runtime public.festival_edition_runtimes%ROWTYPE;
  v_actor uuid := public._caller_profile_id();
  v_timezone text;
  v_day date;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_actor IS NULL THEN
    RAISE EXCEPTION 'festival_stage_control_forbidden';
  END IF;
  SELECT * INTO v_runtime FROM public.festival_edition_runtimes
  WHERE id=p_runtime_id;
  IF NOT FOUND OR NOT public._festival_edition_runtime_authorised(
    v_runtime.festival_company_id,v_runtime.edition_id,v_actor
  ) THEN RAISE EXCEPTION 'festival_stage_control_forbidden'; END IF;
  SELECT nullif(c.timezone,'') INTO v_timezone
  FROM public.festival_editions_v2 ed JOIN public.cities c ON c.id=ed.city_id
  WHERE ed.id=v_runtime.edition_id;
  IF v_timezone IS NULL THEN RAISE EXCEPTION 'festival_stage_timezone_missing'; END IF;
  v_day := (now() AT TIME ZONE v_timezone)::date;

  IF v_runtime.state IN ('gates_open','live','paused') THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'stageId',stage.id,
      'stageName',stage.name,
      'scheduleItemId',(item.value->>'id')::uuid,
      'artistName',item.value->>'artistName',
      'festivalDate',v_day,
      'status',current_event.event_status,
      'observedAt',current_event.observed_at
    ) ORDER BY stage.sort_order,(item.value->>'slotIndex')::integer),'[]'::jsonb)
    INTO v_rows
    FROM jsonb_array_elements(coalesce(v_runtime.generated_schedule->'items','[]'::jsonb)) item
    JOIN public.festival_site_plan_stages stage ON stage.id=(item.value->>'stageId')::uuid
    JOIN public.festival_site_plans plan ON plan.id=stage.festival_site_plan_id
    LEFT JOIN LATERAL (
      SELECT ev.event_status,ev.observed_at
      FROM private.festival_edition_stage_events ev
      WHERE ev.runtime_id=v_runtime.id
        AND ev.edition_id=v_runtime.edition_id
        AND ev.schedule_item_id=(item.value->>'id')::uuid
        AND ev.stage_id=stage.id
        AND ev.festival_date=v_day
      ORDER BY ev.observed_at DESC,ev.recorded_at DESC LIMIT 1
    ) current_event ON true
    WHERE item.value->>'festivalDate'=v_day::text
      AND stage.status='ready'
      AND plan.festival_edition_id=v_runtime.edition_id
      AND plan.festival_company_id=v_runtime.festival_company_id;
  END IF;

  RETURN jsonb_build_object(
    'runtimeId',v_runtime.id,
    'editionId',v_runtime.edition_id,
    'runtimeVersion',v_runtime.version,
    'runtimeState',v_runtime.state,
    'festivalDate',v_day,
    'items',v_rows
  );
END;
$control$;
REVOKE ALL ON FUNCTION public.get_canonical_festival_stage_control(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_canonical_festival_stage_control(uuid)
  TO authenticated;
