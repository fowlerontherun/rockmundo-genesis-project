-- Add a public-safe live feed to the existing annual-edition projection.
-- The original status RPC remains the source of launch, edition, day and
-- runtime authority. No parallel simulation, writable visitor ledger or
-- public access to the private canonical evidence tables is introduced.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_festival_edition_live_experience(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $public_feed$
DECLARE
  v_status jsonb;
  v_edition_id uuid;
  v_launch_id uuid;
  v_runtime_id uuid;
  v_day date;
  v_messages jsonb := '[]'::jsonb;
BEGIN
  -- This RPC performs the publication/visibility checks and timezone-local
  -- runtime-day selection. Never query private events for an unverified slug.
  v_status := public.get_public_festival_edition_live_status(p_slug);
  IF v_status IS NULL THEN RETURN NULL; END IF;

  IF v_status->>'currentDay' IS NULL
     OR v_status->>'runtimeStatus' NOT IN ('live','gates_open') THEN
    RETURN v_status || jsonb_build_object('messages',v_messages,'feedAvailable',true);
  END IF;
  v_edition_id := (v_status->>'editionId')::uuid;
  v_launch_id := (v_status->>'festivalLaunchId')::uuid;
  v_day := (v_status->>'currentDay')::date;

  -- Require the exact edition/company/launch linkage checked by the public
  -- status projection; never choose a runtime merely by festival name.
  SELECT r.id INTO v_runtime_id
  FROM public.festival_edition_runtimes r
  JOIN public.festival_launches l ON l.id=v_launch_id
    AND l.festival_company_id=r.festival_company_id
  WHERE r.edition_id=v_edition_id
  ORDER BY r.created_at DESC,r.id DESC LIMIT 1;
  IF v_runtime_id IS NULL THEN
    RETURN v_status || jsonb_build_object('messages',v_messages,'feedAvailable',true);
  END IF;

  -- Immutable official stage transitions only. Return fixed status codes,
  -- published stage names and stable event IDs, never raw evidence JSON,
  -- private incident descriptions, performer notes or exact audience counts.
  -- The client matches scheduleItemId against the published lineup before
  -- displaying an artist name. Replayed polling cannot duplicate an event ID.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', updates.id,
      'kind', 'stage',
      'status', updates.event_status,
      'stageId', updates.stage_id,
      'stageName', updates.stage_name,
      'scheduleItemId', updates.schedule_item_id,
      'observedAt', updates.observed_at
    ) ORDER BY updates.observed_at DESC,updates.id DESC), '[]'::jsonb)
    INTO v_messages
  FROM (
    SELECT ev.id,ev.event_status,ev.stage_id,stage.name AS stage_name,
      ev.schedule_item_id,ev.observed_at
    FROM private.festival_edition_stage_events ev
    JOIN public.festival_site_plan_stages stage ON stage.id=ev.stage_id
      AND stage.status='ready'
    JOIN public.festival_site_plans plan ON plan.id=stage.festival_site_plan_id
      AND plan.festival_edition_id=v_edition_id
      AND plan.festival_company_id=(
        SELECT l.festival_company_id FROM public.festival_launches l WHERE l.id=v_launch_id)
    JOIN LATERAL jsonb_array_elements(
      coalesce((SELECT r.generated_schedule->'items'
        FROM public.festival_edition_runtimes r WHERE r.id=v_runtime_id), '[]'::jsonb)
    ) item ON item.value->>'id'=ev.schedule_item_id::text
      AND item.value->>'stageId'=ev.stage_id::text
      AND item.value->>'festivalDate'=v_day::text
    WHERE ev.runtime_id=v_runtime_id AND ev.edition_id=v_edition_id
      AND ev.festival_date=v_day
      AND ev.observed_at <= now() + interval '1 minute'
      -- The local festival day may span 25 hours during a DST transition.
      AND ev.observed_at >= now() - interval '26 hours'
    ORDER BY ev.observed_at DESC,ev.id DESC
    LIMIT 30
  ) updates;

  RETURN v_status || jsonb_build_object('messages',v_messages,'feedAvailable',true);
END;
$public_feed$;

-- The function reads private evidence as a definer, so its sole public entry
-- point must be the already-privacy-filtered canonical status projection.
REVOKE ALL ON FUNCTION public.get_public_festival_edition_live_experience(text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_festival_edition_live_experience(text)
  TO anon,authenticated;
COMMIT;
