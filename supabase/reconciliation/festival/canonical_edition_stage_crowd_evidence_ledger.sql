-- REVIEW ONLY: stage-specific canonical audience-allocation evidence capture.
-- Does not create or infer allocations from total festival attendance.
-- The canonical runtime must emit stage_audience_allocation evidence itself.
CREATE TABLE IF NOT EXISTS private.festival_edition_stage_crowd_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 runtime_id uuid NOT NULL REFERENCES public.festival_edition_runtimes(id),
 edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id),
 stage_id uuid NOT NULL REFERENCES public.festival_site_plan_stages(id),
 source_evidence_id uuid NOT NULL UNIQUE REFERENCES public.festival_runtime_evidence(id),
 festival_date date NOT NULL,
 observed_at timestamptz NOT NULL,
 idempotency_key text NOT NULL,
 evidence_hash text NOT NULL,
 observed_audience integer NOT NULL CHECK(observed_audience>=0),
 stage_capacity integer NOT NULL CHECK(stage_capacity>0),
 crowd_mood text CHECK(crowd_mood IN ('calm','engaged','excited','restless')),
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(runtime_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS festival_edition_stage_crowd_current_day
 ON private.festival_edition_stage_crowd_observations(runtime_id,stage_id,festival_date,observed_at DESC);
ALTER TABLE private.festival_edition_stage_crowd_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.festival_edition_stage_crowd_observations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.festival_edition_stage_crowd_observations FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.capture_canonical_festival_stage_audience_allocation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $crowd$
DECLARE
 v_runtime public.festival_edition_runtimes%ROWTYPE;
 v_edition public.festival_editions_v2%ROWTYPE;
 v_capacity integer;
 v_timezone text;
 v_date date;
 v_at timestamptz;
 v_total integer;
 v_key text;
 v_mood text;
 v_hash text;
 v_old_hash text;
BEGIN
 IF NEW.evidence_type <> 'stage_audience_allocation' THEN RETURN NEW; END IF;
 IF jsonb_typeof(NEW.evidence)<>'object' THEN
  RAISE EXCEPTION 'festival_stage_allocation_payload_invalid';
 END IF;
 v_key:=nullif(NEW.evidence->>'idempotencyKey','');
 IF v_key IS NULL OR length(v_key)>128
    OR (NEW.evidence->>'audienceTotal') !~ '^[0-9]{1,8}$'
    OR nullif(NEW.evidence->>'observedAt','') IS NULL
    OR nullif(NEW.evidence->>'festivalDate','') IS NULL
    OR nullif(NEW.evidence->>'stageId','') IS NULL
    OR NEW.evidence->>'allocationSource' IS DISTINCT FROM 'canonical_runtime_stage_allocation'
 THEN RAISE EXCEPTION 'festival_stage_allocation_missing_verified_source'; END IF;
 v_total:=(NEW.evidence->>'audienceTotal')::integer;
 v_at:=(NEW.evidence->>'observedAt')::timestamptz;
 v_date:=(NEW.evidence->>'festivalDate')::date;
 v_mood:=nullif(NEW.evidence->>'mood','');
 IF v_mood IS NOT NULL AND
    (v_mood NOT IN ('calm','engaged','excited','restless')
     OR NEW.evidence->>'moodSource' IS DISTINCT FROM 'measured') THEN
  RAISE EXCEPTION 'festival_stage_allocation_mood_unverified';
 END IF;
 SELECT * INTO v_runtime FROM public.festival_edition_runtimes WHERE id=NEW.runtime_id;
 IF NOT FOUND OR v_runtime.state NOT IN ('gates_open','live') THEN
  RAISE EXCEPTION 'festival_stage_allocation_runtime_inactive';
 END IF;
 SELECT * INTO v_edition FROM public.festival_editions_v2
 WHERE id=v_runtime.edition_id AND festival_company_id=v_runtime.festival_company_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'festival_stage_allocation_wrong_edition'; END IF;
 SELECT nullif(timezone,'') INTO v_timezone FROM public.cities WHERE id=v_edition.city_id;
 IF v_timezone IS NULL OR v_date NOT BETWEEN v_edition.starts_on AND v_edition.ends_on
    OR (v_at AT TIME ZONE v_timezone)::date<>v_date
    OR v_at < NEW.created_at - interval '10 minutes'
    OR v_at > NEW.created_at + interval '1 minute' THEN
  RAISE EXCEPTION 'festival_stage_allocation_stale_or_wrong_day';
 END IF;
 SELECT s.capacity INTO v_capacity FROM public.festival_site_plan_stages s
 JOIN public.festival_site_plans p ON p.id=s.festival_site_plan_id
 WHERE s.id=(NEW.evidence->>'stageId')::uuid
   AND s.status='ready'
   AND p.festival_edition_id=v_runtime.edition_id
   AND p.festival_company_id=v_runtime.festival_company_id;
 IF v_capacity IS NULL OR v_capacity<=0 OR v_total>v_capacity
    OR v_total>coalesce(v_runtime.site_attendance,0) THEN
  RAISE EXCEPTION 'festival_stage_allocation_capacity_invalid';
 END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(NEW.runtime_id::text||':stage-crowd:'||v_key,0)
 );
 v_hash:=md5(NEW.evidence::text);
 SELECT evidence_hash INTO v_old_hash
 FROM private.festival_edition_stage_crowd_observations
 WHERE runtime_id=NEW.runtime_id AND idempotency_key=v_key;
 IF FOUND THEN
  IF v_old_hash IS DISTINCT FROM v_hash
  THEN RAISE EXCEPTION 'festival_stage_allocation_idempotency_conflict'; END IF;
  RETURN NEW;
 END IF;
 INSERT INTO private.festival_edition_stage_crowd_observations(
  runtime_id,edition_id,stage_id,source_evidence_id,festival_date,observed_at,
  idempotency_key,evidence_hash,observed_audience,stage_capacity,crowd_mood
 ) VALUES(
  v_runtime.id,v_runtime.edition_id,(NEW.evidence->>'stageId')::uuid,
  NEW.id,v_date,v_at,v_key,v_hash,v_total,v_capacity,v_mood
 );
 RETURN NEW;
END;
$crowd$;
REVOKE ALL ON FUNCTION private.capture_canonical_festival_stage_audience_allocation()
 FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS festival_canonical_stage_audience_capture ON public.festival_runtime_evidence;
CREATE TRIGGER festival_canonical_stage_audience_capture
AFTER INSERT ON public.festival_runtime_evidence
FOR EACH ROW EXECUTE FUNCTION private.capture_canonical_festival_stage_audience_allocation();
