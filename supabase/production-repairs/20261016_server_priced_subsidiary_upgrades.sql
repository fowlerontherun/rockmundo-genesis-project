-- Scoped replacement for risky 20261012230500_atomic_subsidiary_purchases.sql.
-- ONLY venue_upgrade, recording_upgrade, rehearsal_upgrade are enabled.
-- Staffing and equipment branches fail closed pending separate server-side pricing.
-- This migration is designed to be installed once, with idempotent retry tracking.
CREATE TABLE IF NOT EXISTS public.subsidiary_upgrade_purchase_requests (
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  kind text NOT NULL,
  subsidiary_id uuid NOT NULL,
  upgrade_type text NOT NULL,
  upgrade_level integer NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_user_id, request_id),
  CONSTRAINT subsidiary_upgrade_purchase_requests_kind_check
    CHECK (kind IN ('venue_upgrade','recording_upgrade','rehearsal_upgrade'))
);
ALTER TABLE public.subsidiary_upgrade_purchase_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subsidiary_upgrade_purchase_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.buy_subsidiary_asset_atomic(
  p_kind text,p_subsidiary_id uuid,p_fields jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,extensions,pg_temp
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_req uuid;
  v_type text;
  v_company_id uuid;
  v_base numeric;
  v_level integer;
  v_cost numeric;
  v_name text;
  v_out jsonb;
  v_previous public.subsidiary_upgrade_purchase_requests%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object'
    THEN RAISE EXCEPTION 'authenticated_upgrade_payload_required'; END IF;
  IF p_kind NOT IN ('venue_upgrade','recording_upgrade','rehearsal_upgrade')
    OR p_kind IS NULL THEN RAISE EXCEPTION 'subsidiary_purchase_kind_not_yet_supported'; END IF;
  IF p_fields->>'request_id' IS NULL THEN RAISE EXCEPTION 'request_id_required'; END IF;
  v_req := (p_fields->>'request_id')::uuid;
  v_type := p_fields->>'upgrade_type';
  IF v_type IS NULL OR length(v_type) NOT BETWEEN 2 AND 80
    THEN RAISE EXCEPTION 'upgrade_type_required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||v_req::text,0));
  SELECT * INTO v_previous
  FROM public.subsidiary_upgrade_purchase_requests
  WHERE actor_user_id=v_actor AND request_id=v_req FOR UPDATE;
  IF FOUND THEN
    IF v_previous.kind IS DISTINCT FROM p_kind
      OR v_previous.subsidiary_id IS DISTINCT FROM p_subsidiary_id
      OR v_previous.upgrade_type IS DISTINCT FROM v_type
      OR (p_fields->>'level' IS NOT NULL
          AND (p_fields->>'level')::integer IS DISTINCT FROM v_previous.upgrade_level)
      OR (p_fields->>'upgrade_level' IS NOT NULL
          AND (p_fields->>'upgrade_level')::integer IS DISTINCT FROM v_previous.upgrade_level)
    THEN RAISE EXCEPTION 'subsidiary_upgrade_request_conflict'; END IF;
    RETURN v_previous.result;
  END IF;

  -- Serialize level assignment by locking the parent before reading upgrades.
  IF p_kind='venue_upgrade' THEN
    SELECT company_id INTO v_company_id FROM public.venues
    WHERE id=p_subsidiary_id FOR UPDATE;
    v_base:=CASE v_type
      WHEN 'sound_system' THEN 25000 WHEN 'lighting' THEN 15000
      WHEN 'capacity' THEN 100000 WHEN 'backstage' THEN 20000
      WHEN 'bar' THEN 30000 WHEN 'parking' THEN 50000
      WHEN 'green_room' THEN 15000 WHEN 'recording' THEN 40000
      WHEN 'security' THEN 10000 ELSE NULL END;
    SELECT coalesce(max(upgrade_level),0)+1 INTO v_level
    FROM public.venue_upgrades WHERE venue_id=p_subsidiary_id AND upgrade_type=v_type;
  ELSIF p_kind='recording_upgrade' THEN
    SELECT company_id INTO v_company_id FROM public.city_studios
    WHERE id=p_subsidiary_id FOR UPDATE;
    v_base:=CASE v_type
      WHEN 'console' THEN 25000 WHEN 'monitors' THEN 5000
      WHEN 'microphones' THEN 8000 WHEN 'preamps' THEN 10000
      WHEN 'outboard_gear' THEN 15000 WHEN 'live_room' THEN 20000
      WHEN 'isolation_booth' THEN 10000 WHEN 'control_room' THEN 15000
      WHEN 'mastering_suite' THEN 50000 ELSE NULL END;
    SELECT coalesce(max(level),0)+1 INTO v_level
    FROM public.recording_studio_upgrades WHERE studio_id=p_subsidiary_id AND upgrade_type=v_type;
  ELSE
    SELECT company_id INTO v_company_id FROM public.rehearsal_rooms
    WHERE id=p_subsidiary_id FOR UPDATE;
    v_base:=CASE v_type
      WHEN 'soundproofing' THEN 5000 WHEN 'equipment' THEN 3000
      WHEN 'recording_gear' THEN 8000 WHEN 'climate_control' THEN 2000
      WHEN 'lounge_area' THEN 2500 WHEN 'storage' THEN 1500
      WHEN 'lighting' THEN 3000 ELSE NULL END;
    SELECT coalesce(max(level),0)+1 INTO v_level
    FROM public.rehearsal_room_upgrades WHERE room_id=p_subsidiary_id AND upgrade_type=v_type;
  END IF;
  IF v_company_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.companies
    WHERE id=v_company_id AND owner_id=v_actor
  ) THEN RAISE EXCEPTION 'subsidiary_not_owned'; END IF;
  IF v_base IS NULL THEN RAISE EXCEPTION 'unknown_upgrade_type'; END IF;
  IF v_level NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'upgrade_level_maximum'; END IF;
  IF (p_fields->>'level' IS NOT NULL AND (p_fields->>'level')::integer<>v_level)
    OR (p_fields->>'upgrade_level' IS NOT NULL AND (p_fields->>'upgrade_level')::integer<>v_level)
  THEN RAISE EXCEPTION 'stale_upgrade_level'; END IF;

  v_cost := round(v_base*power(1.5::numeric,(v_level-1)::numeric));
  v_name := initcap(replace(v_type,'_',' '))||' Level '||v_level::text;
  PERFORM public.deduct_company_balance(
    v_company_id,v_cost,'Subsidiary upgrade: '||p_kind||' / '||v_name,
    'upgrade','subsidiary-upgrade-'||v_req::text
  );

  IF p_kind='venue_upgrade' THEN
    INSERT INTO public.venue_upgrades(venue_id,upgrade_type,upgrade_level,cost,description)
    VALUES(p_subsidiary_id,v_type,v_level,v_cost,v_name)
    RETURNING to_jsonb(venue_upgrades.*) INTO v_out;
    IF v_type='capacity' THEN
      UPDATE public.venues
      SET capacity=least(50000,round(greatest(1,coalesce(capacity,100))*1.25))
      WHERE id=p_subsidiary_id;
    END IF;
  ELSIF p_kind='recording_upgrade' THEN
    INSERT INTO public.recording_studio_upgrades
      (studio_id,upgrade_type,name,level,cost,effect_value,effect_description)
    VALUES(p_subsidiary_id,v_type,v_name,v_level,v_cost,v_level*10,
      'Improves '||replace(v_type,'_',' ')||' quality by '||(v_level*10)::text||'%')
    RETURNING to_jsonb(recording_studio_upgrades.*) INTO v_out;
  ELSE
    INSERT INTO public.rehearsal_room_upgrades
      (room_id,upgrade_type,name,level,cost,effect_value,effect_description)
    VALUES(p_subsidiary_id,v_type,v_name,v_level,v_cost,v_level*10,
      'Improves '||replace(v_type,'_',' ')||' quality by '||(v_level*10)::text||'%')
    RETURNING to_jsonb(rehearsal_room_upgrades.*) INTO v_out;
  END IF;
  IF v_out IS NULL THEN RAISE EXCEPTION 'subsidiary_upgrade_creation_failed'; END IF;
  INSERT INTO public.subsidiary_upgrade_purchase_requests
    (actor_user_id,request_id,kind,subsidiary_id,upgrade_type,upgrade_level,result)
  VALUES(v_actor,v_req,p_kind,p_subsidiary_id,v_type,v_level,v_out);
  RETURN v_out;
END $fn$;

REVOKE ALL ON FUNCTION public.buy_subsidiary_asset_atomic(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buy_subsidiary_asset_atomic(text,uuid,jsonb) TO authenticated;
