-- Reconcile the live stage-slot compatibility RPC after the rollout checks.
-- This file is deliberately separate from the revision-table migration chain.
BEGIN;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc
    WHERE oid = pg_catalog.to_regprocedure('public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text)')
      AND md5(prosrc) = '3a26228345a56e50da00e96c39f7c756'
  ) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_UPSERT_BASELINE_CHANGED';
  END IF;
END $preflight$;
CREATE TABLE IF NOT EXISTS private.festival_schedule_slot_upsert_receipts(
 edition_id uuid NOT NULL REFERENCES public.festival_editions(id),
 idempotency_key text NOT NULL,payload_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(edition_id,idempotency_key)
);
ALTER TABLE private.festival_schedule_slot_upsert_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.festival_schedule_slot_upsert_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.festival_schedule_slot_upsert_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.festival_schedule_upsert_item(p_edition_id uuid, p_revision_id uuid, p_item jsonb, p_expected_version integer DEFAULT NULL::integer, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ed public.festival_editions%ROWTYPE;
  v_tz text;
  v_stage_id uuid;
  v_slot_id uuid;
  v_slot public.festival_stage_slots%ROWTYPE;
  v_date date := nullif(p_item->>'festival_date', '')::date;
  v_starts timestamptz;
  v_duration integer := nullif(p_item->>'duration_minutes', '')::integer;
  v_ends timestamptz;
  v_band uuid := nullif(p_item->>'band_id', '')::uuid;
  v_type text := coalesce(nullif(p_item->>'item_type', ''), 'performance_slot');
  v_changeover integer := greatest(0, coalesce(nullif(p_item->>'changeover_minutes', '')::integer, 0));
  v_day integer;
  v_slot_number integer;
  v_replay_hash text;
  v_payload_hash text;
  v_timestamp_pattern constant text :=
    '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$';
BEGIN
  IF NOT coalesce(public.can_manage_festival_edition(p_edition_id), false) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED';
  END IF;

  -- The canonical compatibility workspace uses the edition ID as its draft ID.
  IF p_revision_id IS DISTINCT FROM p_edition_id THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_REVISION_NOT_FOUND';
  END IF;
  -- Serialize slot numbering and writes in an edition, including different keys.
  SELECT * INTO v_ed FROM public.festival_editions WHERE id = p_edition_id FOR UPDATE;
  IF v_ed.id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_EDITION_NOT_FOUND'; END IF;
  v_tz := coalesce(nullif(v_ed.timezone, ''), 'UTC');

  -- The client resolves local clocks (including DST gaps/overlaps) before
  -- calling the RPC. Require absolute instants before PostgreSQL casts them.
  IF NOT coalesce((p_item->>'starts_at') ~ v_timestamp_pattern, false)
     OR NOT coalesce((p_item->>'ends_at') ~ v_timestamp_pattern, false)
  THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_EXPLICIT_TIMEZONE_REQUIRED'; END IF;
  v_starts := (p_item->>'starts_at')::timestamptz;
  v_ends := (p_item->>'ends_at')::timestamptz;
  v_stage_id := nullif(p_item->>'stage_id', '')::uuid;
  v_slot_id := coalesce(nullif(p_item->>'stage_slot_id', ''), nullif(p_item->>'id', ''))::uuid;

  IF p_idempotency_key IS NOT NULL THEN
    IF length(p_idempotency_key)<8 OR length(p_idempotency_key)>180
    THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_INVALID_IDEMPOTENCY_KEY'; END IF;
    v_payload_hash:=encode(sha256(convert_to(jsonb_build_array(p_item,p_revision_id,p_expected_version)::text,'UTF8')),'hex');
    SELECT payload_hash INTO v_replay_hash FROM private.festival_schedule_slot_upsert_receipts
    WHERE edition_id=p_edition_id AND idempotency_key=p_idempotency_key;
    IF FOUND THEN
      IF v_replay_hash IS DISTINCT FROM v_payload_hash THEN
        RAISE EXCEPTION 'FESTIVAL_SCHEDULE_IDEMPOTENCY_CONFLICT'; END IF;
      RETURN public.festival_edition_schedule_workspace(p_edition_id);
    END IF;
  END IF;

  IF v_stage_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_STAGE_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.festival_stages st
    WHERE st.id=v_stage_id AND st.edition_id=p_edition_id AND st.archived_at IS NULL)
  THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_STAGE_MISMATCH'; END IF;
  IF v_slot_id IS NOT NULL THEN
    SELECT * INTO v_slot FROM public.festival_stage_slots
      WHERE id=v_slot_id AND edition_id=p_edition_id FOR UPDATE;
    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM public.festival_stage_slots WHERE id=v_slot_id) THEN
        RAISE EXCEPTION 'FESTIVAL_SCHEDULE_SLOT_WRONG_EDITION';
      END IF;
      RAISE EXCEPTION 'FESTIVAL_SCHEDULE_ITEM_NOT_FOUND';
    END IF;
    IF v_slot.canonical_contract_id IS NOT NULL THEN
      RAISE EXCEPTION 'FESTIVAL_SCHEDULE_LOCKED_ITEM';
    END IF;
  END IF;

  IF v_ends <= v_starts THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_INVALID_WINDOW'; END IF;
  IF (v_starts AT TIME ZONE v_tz)::date IS DISTINCT FROM v_date
  THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_WRONG_LOCAL_DAY'; END IF;
  IF v_duration IS NOT NULL AND
    (v_duration < 5 OR extract(epoch FROM (v_ends-v_starts)) <> v_duration::numeric * 60)
  THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_DURATION_MISMATCH'; END IF;

  v_day := greatest(1, ((v_starts AT TIME ZONE v_tz)::date - coalesce((v_ed.start_at AT TIME ZONE v_tz)::date, (v_starts AT TIME ZONE v_tz)::date)) + 1);

  IF v_slot_id IS NULL OR v_slot.stage_id IS DISTINCT FROM v_stage_id OR v_slot.day_number IS DISTINCT FROM v_day THEN
    SELECT coalesce(max(slot_number), 0) + 1 INTO v_slot_number
      FROM public.festival_stage_slots
     WHERE stage_id = v_stage_id AND day_number = v_day;
  END IF;

  IF v_slot_id IS NOT NULL THEN
    UPDATE public.festival_stage_slots
       SET stage_id = v_stage_id,
           start_time = v_starts,
           end_time = v_ends,
           slot_type = v_type,
           band_id = coalesce(v_band, band_id),
           changeover_minutes = v_changeover,
           day_number = v_day,
           slot_number = coalesce(v_slot_number, v_slot.slot_number)
     WHERE id = v_slot_id;
  ELSE
    INSERT INTO public.festival_stage_slots
      (stage_id, festival_id, edition_id, day_number, slot_number, slot_type, band_id, start_time, end_time, status, changeover_minutes)
    VALUES (v_stage_id, v_ed.festival_id, p_edition_id, v_day, coalesce(v_slot_number, 1), v_type, v_band, v_starts, v_ends, 'open', v_changeover);
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO private.festival_schedule_slot_upsert_receipts(
      edition_id,idempotency_key,payload_hash
    ) VALUES(p_edition_id,p_idempotency_key,v_payload_hash);
  END IF;
  RETURN public.festival_edition_schedule_workspace(p_edition_id);
END $function$;

REVOKE ALL ON FUNCTION public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text) TO authenticated;

COMMIT;
