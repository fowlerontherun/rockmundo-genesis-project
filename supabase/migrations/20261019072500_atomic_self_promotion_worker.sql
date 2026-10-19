-- #4250: exclusively server-initiated, idempotent self-promotion settlement.
-- Both the 10-minute cron job and scheduled activity worker call this same
-- locked database transaction. Nothing runs as a public service-role Edge URL.

CREATE UNIQUE INDEX IF NOT EXISTS band_fame_events_self_promotion_activity_once_idx
 ON public.band_fame_events ((event_data->>'activity_id'))
 WHERE event_type = 'self_promotion' AND event_data ? 'activity_id';

CREATE OR REPLACE FUNCTION public.settle_self_promotion_atomic(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_activity public.self_promotion_activities%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_catalog public.self_promotion_catalog%ROWTYPE;
  v_fame_factor numeric;
  v_morale_factor numeric;
  v_fame_gain integer;
  v_fans_gain integer;
  v_morale_gain integer;
  v_sentiment_gain integer;
  v_cooldown timestamptz;
  v_new_fame integer;
  v_new_fans integer;
BEGIN
  IF p_activity_id IS NULL THEN
    RAISE EXCEPTION 'SELF_PROMOTION_ACTIVITY_REQUIRED';
  END IF;

  -- Serializes cron, activity-worker and retry callers on the same promotion.
  SELECT * INTO v_activity
  FROM public.self_promotion_activities
  WHERE id = p_activity_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('settled',false,'reason','not_found');
  END IF;
  IF v_activity.status = 'completed' THEN
    RETURN jsonb_build_object('settled',false,'reason','already_completed',
      'fame_gained',v_activity.fame_gained,'fans_gained',v_activity.fans_gained);
  END IF;
  IF v_activity.status IS DISTINCT FROM 'in_progress' THEN
    RETURN jsonb_build_object('settled',false,'reason','not_in_progress');
  END IF;
  IF v_activity.scheduled_end > now() THEN
    RETURN jsonb_build_object('settled',false,'reason','not_due');
  END IF;
  IF v_activity.band_id IS NULL THEN
    RAISE EXCEPTION 'SELF_PROMOTION_BAND_MISSING';
  END IF;

  SELECT * INTO v_band FROM public.bands WHERE id=v_activity.band_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF_PROMOTION_BAND_MISSING'; END IF;

  SELECT * INTO v_catalog FROM public.self_promotion_catalog
  WHERE activity_type=v_activity.activity_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF_PROMOTION_CATALOG_MISSING'; END IF;

  -- All rewards are generated from DB-held catalogue data after the lock.
  v_fame_factor := 1 + LEAST(greatest(coalesce(v_band.fame,0),0)::numeric/1000,0.5);
  v_morale_factor := round(0.7 + LEAST(100,GREATEST(0,coalesce(v_band.morale,50)))::numeric/100*0.6,2);
  v_fame_gain := GREATEST(0,LEAST(100000,
    floor((
      GREATEST(0,coalesce(v_catalog.base_fame_min,10)) +
      random()*greatest(0,coalesce(v_catalog.base_fame_max,50)-greatest(0,coalesce(v_catalog.base_fame_min,10)))
    )*v_fame_factor*v_morale_factor)::integer));
  v_fans_gain := GREATEST(0,LEAST(100000,
    floor((
      GREATEST(0,coalesce(v_catalog.base_fan_min,20)) +
      random()*greatest(0,coalesce(v_catalog.base_fan_max,100)-greatest(0,coalesce(v_catalog.base_fan_min,20)))
    )*v_fame_factor*v_morale_factor)::integer));

  v_morale_gain := CASE WHEN v_fans_gain>=50 THEN 3 WHEN v_fans_gain>=20 THEN 2 ELSE 1 END;
  v_sentiment_gain := v_morale_gain;
  v_new_fame := greatest(0,coalesce(v_band.fame,0))+v_fame_gain;
  v_new_fans := greatest(0,coalesce(v_band.total_fans,0))+v_fans_gain;
  v_cooldown := now() + make_interval(days=>greatest(0,coalesce(v_catalog.cooldown_days,1)));

  UPDATE public.bands SET
    fame=v_new_fame,
    total_fans=v_new_fans,
    morale=LEAST(100,GREATEST(0,coalesce(v_band.morale,50))+v_morale_gain),
    fan_sentiment_score=LEAST(100,GREATEST(0,coalesce(v_band.fan_sentiment_score,0))+v_sentiment_gain)
  WHERE id=v_activity.band_id;

  INSERT INTO public.band_fame_events(
    band_id,event_type,fame_gained,event_data
  ) VALUES (
    v_activity.band_id,'self_promotion',v_fame_gain,
    jsonb_build_object(
      'activity_id',v_activity.id,'activity_type',v_activity.activity_type,
      'activity_name',v_catalog.name,'fans_gained',v_fans_gain
    )
  );

  INSERT INTO public.self_promotion_cooldowns(band_id,activity_type,cooldown_expires_at)
  VALUES (v_activity.band_id,v_activity.activity_type,v_cooldown)
  ON CONFLICT (band_id,activity_type)
  DO UPDATE SET cooldown_expires_at =
    greatest(public.self_promotion_cooldowns.cooldown_expires_at,excluded.cooldown_expires_at);

  UPDATE public.self_promotion_activities
  SET status='completed',fame_gained=v_fame_gain,fans_gained=v_fans_gain
  WHERE id=p_activity_id AND status='in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'SELF_PROMOTION_CONCURRENT_CHANGE'; END IF;

  RETURN jsonb_build_object('settled',true,'activity_id',p_activity_id,
    'band_id',v_activity.band_id,'fame_gained',v_fame_gain,
    'fans_gained',v_fans_gain,'new_total_fame',v_new_fame,
    'new_total_fans',v_new_fans,'cooldown_expires_at',v_cooldown);
END;
$fn$;

REVOKE ALL ON FUNCTION public.settle_self_promotion_atomic(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_self_promotion_atomic(uuid)
 TO service_role;

CREATE OR REPLACE FUNCTION public.process_due_self_promotions(p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_id uuid;
  v_result jsonb;
  v_settled integer:=0;
  v_skipped integer:=0;
  v_failed integer:=0;
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>1000 THEN
    RAISE EXCEPTION 'SELF_PROMOTION_INVALID_BATCH_LIMIT';
  END IF;

  FOR v_id IN
    SELECT id FROM public.self_promotion_activities
    WHERE status='in_progress' AND scheduled_end<=now()
    ORDER BY scheduled_end,id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      v_result:=public.settle_self_promotion_atomic(v_id);
      IF v_result->>'settled'='true' THEN
        v_settled:=v_settled+1;
      ELSE
        v_skipped:=v_skipped+1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed:=v_failed+1;
      RAISE WARNING 'self-promotion settlement failed for activity %: %',v_id,SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('settled',v_settled,
    'skipped',v_skipped,'failed',v_failed);
END;
$fn$;

REVOKE ALL ON FUNCTION public.process_due_self_promotions(integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_self_promotions(integer)
 TO service_role;

-- Preserve job #61 and its existing ten-minute cadence, but remove the
-- publicly accessible service-role HTTP function and the stored anon JWT.
DO $cron$
DECLARE v_id bigint;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    SELECT jobid INTO v_id FROM cron.job
     WHERE jobname='complete-self-promotions-every-10-min' LIMIT 1;
    IF v_id IS NOT NULL THEN
      PERFORM cron.alter_job(v_id,
        command=>'SELECT public.process_due_self_promotions();');
    END IF;
  END IF;
END;
$cron$;
