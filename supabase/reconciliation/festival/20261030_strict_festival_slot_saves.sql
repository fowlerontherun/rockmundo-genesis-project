-- Review-only: guard absolute timestamps, edition slots and idempotent retries.
-- Existing published slots are not modified.
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
  v_replay_hash text;
  v_payload_hash text;
  v_receipt_found boolean;
BEGIN
  IF NOT coalesce(public.can_manage_festival_edition(p_edition_id), false) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED';
  END IF;

  SELECT * INTO v_ed FROM public.festival_editions WHERE id = p_edition_id;
  IF v_ed.id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_EDITION_NOT_FOUND'; END IF;
  v_tz := coalesce(nullif(v_ed.timezone, ''), 'UTC');

  -- Offset required for absolute times; PostgreSQL session TZ cannot choose.
  IF (nullif(p_item->>'starts_at','') IS NOT NULL AND
      (p_item->>'starts_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$')
     OR (nullif(p_item->>'ends_at','') IS NOT NULL AND
      (p_item->>'ends_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$')
  THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_EXPLICIT_TIMEZONE_REQUIRED'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    IF length(p_idempotency_key)<8 OR length(p_idempotency_key)>180
    THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_INVALID_IDEMPOTENCY_KEY'; END IF;
    v_payload_hash:=md5(p_item::text||':'||coalesce(p_revision_id::text,''));
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_edition_id::text||':'||p_idempotency_key,0));
    SELECT payload_hash INTO v_replay_hash FROM private.festival_schedule_slot_upsert_receipts
    WHERE edition_id=p_edition_id AND idempotency_key=p_idempotency_key;
    v_receipt_found:=FOUND;
    IF v_receipt_found THEN
      IF v_replay_hash IS DISTINCT FROM v_payload_hash THEN
        RAISE EXCEPTION 'FESTIVAL_SCHEDULE_IDEMPOTENCY_CONFLICT'; END IF;
      RETURN public.festival_edition_schedule_workspace(p_edition_id);
    END IF;
  END IF;


  IF v_stage_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_STAGE_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.festival_stages st
    WHERE st.id=v_stage_id AND st.edition_id=p_edition_id AND st.archived_at IS NULL)
  THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_STAGE_MISMATCH'; END IF;
  IF v_slot_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.festival_stage_slots sl
    WHERE sl.id=v_slot_id AND sl.edition_id IS DISTINCT FROM p_edition_id)
  THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_SLOT_WRONG_EDITION'; END IF;

  IF v_starts IS NULL AND v_date IS NULL THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_START_REQUIRED'; END IF;
  IF v_starts IS NULL THEN
    v_starts := (v_date::timestamp + coalesce(nullif(p_item->>'start_time', '')::time, '12:00'::time)) AT TIME ZONE v_tz;
  END IF;
  IF v_ends IS NULL THEN v_ends := v_starts + make_interval(mins => v_duration); END IF;
  IF v_ends <= v_starts THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_INVALID_WINDOW'; END IF;
  IF v_date IS NOT NULL AND (v_starts AT TIME ZONE v_tz)::date<>v_date
  THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_WRONG_LOCAL_DAY'; END IF;
  IF nullif(p_item->>'duration_minutes','') IS NOT NULL AND
    abs(extract(epoch FROM (v_ends-v_starts))/60-v_duration)>0.01
  THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_DURATION_MISMATCH'; END IF;


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

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO private.festival_schedule_slot_upsert_receipts(
      edition_id,idempotency_key,payload_hash
    ) VALUES(p_edition_id,p_idempotency_key,v_payload_hash);
  END IF;
  RETURN public.festival_edition_schedule_workspace(p_edition_id);
END $function$;

REVOKE ALL ON FUNCTION public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.festival_schedule_upsert_item(uuid,uuid,jsonb,integer,text) TO authenticated;
