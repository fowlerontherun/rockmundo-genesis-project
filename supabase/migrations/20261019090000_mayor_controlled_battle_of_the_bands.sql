-- Battle of the Bands: city-specific mayor schedules and transparent event financing.
-- Forward-only, keeps registered events and completed historical settlements.
CREATE TABLE IF NOT EXISTS public.botb_city_settings (
  city_id uuid PRIMARY KEY REFERENCES public.cities(id) ON DELETE CASCADE,
  weekday integer NOT NULL DEFAULT 5 CHECK (weekday BETWEEN 0 AND 6),
  frequency_weeks integer NOT NULL DEFAULT 2 CHECK (frequency_weeks IN (1,2,4)),
  prize_money integer NOT NULL DEFAULT 5000 CHECK (prize_money BETWEEN 1000 AND 50000),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.botb_city_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.botb_city_settings FROM PUBLIC, anon;
GRANT SELECT ON public.botb_city_settings TO authenticated;
GRANT ALL ON public.botb_city_settings TO service_role;
DROP POLICY IF EXISTS "Players can see city battle settings" ON public.botb_city_settings;
CREATE POLICY "Players can see city battle settings" ON public.botb_city_settings
  FOR SELECT TO authenticated USING (true);
INSERT INTO public.botb_city_settings (city_id)
SELECT id FROM public.cities ON CONFLICT (city_id) DO NOTHING;

ALTER TABLE public.botb_events
  ADD COLUMN IF NOT EXISTS prize_money integer NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS attendance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_revenue bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sponsorship_revenue bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_cost bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS city_profit bigint NOT NULL DEFAULT 0;
ALTER TABLE public.botb_events DROP CONSTRAINT IF EXISTS botb_prize_money_range;
ALTER TABLE public.botb_events ADD CONSTRAINT botb_prize_money_range CHECK (prize_money BETWEEN 1000 AND 50000);
ALTER TABLE public.botb_events DROP CONSTRAINT IF EXISTS botb_finances_nonnegative;
ALTER TABLE public.botb_events ADD CONSTRAINT botb_finances_nonnegative CHECK
  (attendance >= 0 AND ticket_revenue >= 0 AND sponsorship_revenue >= 0
   AND production_cost >= 0 AND city_profit >= 0);

CREATE OR REPLACE FUNCTION public.generate_botb_events(p_horizon_events integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $generate$
DECLARE
  v_city record;
  v_anchor timestamptz;
  v_first integer;
  v_date timestamptz;
  v_i integer;
  v_created integer := 0;
  v_inserted integer;
  v_horizon integer := LEAST(12,GREATEST(1,COALESCE(p_horizon_events,3)));
BEGIN
  FOR v_city IN SELECT c.id,
      COALESCE(s.weekday,5) AS weekday,
      COALESCE(s.frequency_weeks,2) AS frequency_weeks,
      COALESCE(s.prize_money,5000) AS prize_money
    FROM public.cities c LEFT JOIN public.botb_city_settings s ON s.city_id=c.id
  LOOP
    v_anchor := timestamptz '2026-01-02 19:00:00+00'
       + ((v_city.weekday - 5) * interval '1 day');
    v_first := GREATEST(0,CEIL(EXTRACT(EPOCH FROM (now() - v_anchor))
       / (v_city.frequency_weeks * 604800.0))::integer);
    FOR v_i IN 0..v_horizon - 1 LOOP
      v_date := v_anchor + ((v_first + v_i) * v_city.frequency_weeks * interval '7 days');
      IF v_date <= now() THEN CONTINUE; END IF;
      INSERT INTO public.botb_events(city_id,scheduled_date,prize_money)
      VALUES(v_city.id,v_date,v_city.prize_money)
      ON CONFLICT(city_id,scheduled_date) DO NOTHING;
      GET DIAGNOSTICS v_inserted=ROW_COUNT;
      v_created:=v_created+v_inserted;
    END LOOP;
  END LOOP;
  RETURN v_created;
END;
$generate$;
REVOKE ALL ON FUNCTION public.generate_botb_events(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_botb_events(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.configure_city_botb(
  p_city_id uuid,p_weekday integer,p_frequency_weeks integer,p_prize_money integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $configure$
DECLARE
  v_mayor_id uuid;
  v_replaced integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'BOTB_LOGIN_REQUIRED'; END IF;
  IF p_weekday IS NULL OR p_weekday NOT BETWEEN 0 AND 6
    OR p_frequency_weeks IS NULL OR p_frequency_weeks NOT IN (1,2,4)
    OR p_prize_money IS NULL OR p_prize_money NOT BETWEEN 1000 AND 50000
  THEN RAISE EXCEPTION 'BOTB_INVALID_SETTINGS'; END IF;

  -- Serialize concurrent mayor changes and validate role server-side.
  PERFORM 1 FROM public.cities WHERE id=p_city_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOTB_CITY_NOT_FOUND'; END IF;
  SELECT cm.id INTO v_mayor_id
  FROM public.city_mayors cm JOIN public.profiles p ON p.id=cm.profile_id
  WHERE cm.city_id=p_city_id AND cm.is_current=true
    AND (cm.term_end IS NULL OR cm.term_end>now()) AND p.user_id=auth.uid()
  ORDER BY cm.term_start DESC LIMIT 1;
  IF v_mayor_id IS NULL THEN RAISE EXCEPTION 'BOTB_MAYOR_REQUIRED'; END IF;

  INSERT INTO public.botb_city_settings(city_id,weekday,frequency_weeks,prize_money,updated_by,updated_at)
  VALUES(p_city_id,p_weekday,p_frequency_weeks,p_prize_money,auth.uid(),now())
  ON CONFLICT(city_id) DO UPDATE SET
    weekday=EXCLUDED.weekday,frequency_weeks=EXCLUDED.frequency_weeks,
    prize_money=EXCLUDED.prize_money,updated_by=EXCLUDED.updated_by,updated_at=now();

  -- The entry RPC locks the event row too. Retain any future event with entrants
  -- (including its ORIGINAL date and prize). Regenerate only unentered events.
  PERFORM 1 FROM public.botb_events
   WHERE city_id=p_city_id AND status='upcoming' AND scheduled_date>now()
   FOR UPDATE;
  DELETE FROM public.botb_events e
  WHERE e.city_id=p_city_id AND e.status='upcoming' AND e.scheduled_date>now()
    AND NOT EXISTS(SELECT 1 FROM public.botb_entries be WHERE be.event_id=e.id);
  GET DIAGNOSTICS v_replaced=ROW_COUNT;
  PERFORM public.generate_botb_events(3);
  INSERT INTO public.mayor_actions_log(city_id,mayor_id,action_type,notes,metadata)
  VALUES(p_city_id,v_mayor_id,'botb_schedule_updated',
    'Battle of the Bands schedule and prize updated',
    jsonb_build_object('weekday',p_weekday,'frequency_weeks',p_frequency_weeks,
      'prize_money',p_prize_money,'unentered_events_replaced',v_replaced));
  RETURN jsonb_build_object('success',true,'unentered_events_replaced',v_replaced);
END;
$configure$;
REVOKE ALL ON FUNCTION public.configure_city_botb(uuid,integer,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configure_city_botb(uuid,integer,integer,integer) TO authenticated,service_role;

-- Patch the live resolver in place to preserve all existing score/XP/fame/
-- achievements logic. Preflight anchors ensure unexpected drift aborts atomically.
DO $botb_patch$
DECLARE
  v_fn text := pg_get_functiondef('public.resolve_botb_event(uuid)'::regprocedure);
  v_original text;
BEGIN
  IF position('  v_cities_won INTEGER;' IN v_fn)=0
    OR position('  -- band rewards' IN v_fn)=0
    OR position('SET band_balance = COALESCE(band_balance, 0) + 5000,' IN v_fn)=0
    OR position('  VALUES (v_winner_band, 5000,' IN v_fn)=0
  THEN RAISE EXCEPTION 'BOTB resolver drift: review before upgrading'; END IF;
  v_original:=v_fn;
  v_fn:=replace(v_fn,
    E'  v_cities_won INTEGER;\nBEGIN',
    E'  v_cities_won INTEGER;\n  v_entry_count integer;\n  v_base_audience numeric;\n  v_attendance integer;\n  v_city_capacity integer;\n  v_prize integer;\n  v_operating_cost integer;\n  v_ticket_revenue bigint;\n  v_sponsor_guarantee bigint;\n  v_city_profit bigint;\nBEGIN');
  v_fn:=replace(v_fn,'  -- band rewards',
$audience$  -- Attendance combines EACH participating band's local fans and fame.
  SELECT COUNT(*),
     COALESCE(SUM(GREATEST(15::numeric,LEAST(20000::numeric,
       25 + COALESCE(f.local_fans,0)*0.12
          + COALESCE(f.city_fame,0)*0.4
          + GREATEST(0,COALESCE(b.total_fans,0))*0.006
          + GREATEST(0,COALESCE(b.fame,0))*0.025))),0)
  INTO v_entry_count,v_base_audience
  FROM public.botb_entries be JOIN public.bands b ON b.id=be.band_id
  LEFT JOIN LATERAL (
     SELECT COALESCE(SUM(GREATEST(0,COALESCE(total_fans,0))),0) AS local_fans,
            COALESCE(SUM(GREATEST(0,COALESCE(city_fame,0))),0) AS city_fame
     FROM public.band_city_fans cf
     WHERE cf.band_id=be.band_id AND cf.city_id=v_event.city_id
  ) f ON true;

  v_prize:=COALESCE(v_event.prize_money,5000);
  SELECT LEAST(30000,GREATEST(200,
     FLOOR(COALESCE(NULLIF(population,0),250000)*0.05)::integer))
  INTO v_city_capacity FROM public.cities WHERE id=v_event.city_id;
  v_attendance:=LEAST(v_city_capacity,GREATEST(v_entry_count*8,
     ROUND(v_base_audience*(1+LEAST(0.6,LN(1+v_prize)/18.0)))::integer));
  v_operating_cost:=750+v_entry_count*100;
  v_ticket_revenue:=v_attendance::bigint*25;
  -- Simulated external event underwriting covers any shortfall in advance;
  -- city treasury never pays the gap or runs at a loss.
  v_sponsor_guarantee:=GREATEST(0::bigint,
     v_prize::bigint+v_operating_cost-v_ticket_revenue);
  v_city_profit:=v_ticket_revenue+v_sponsor_guarantee-v_prize-v_operating_cost;

  -- band rewards$audience$);
  -- One canonical band_earnings cash credit (the earnings trigger updates balance).
  v_fn:=replace(v_fn,'    SET band_balance = COALESCE(band_balance, 0) + 5000,'||chr(10)||'        fame =','    SET fame =');
  v_fn:=replace(v_fn,
    '  VALUES (v_winner_band, 5000, ''battle_of_the_bands'',',
    '  VALUES (v_winner_band, v_prize, ''battle_of_the_bands'',');
  v_fn:=replace(v_fn,'    SET cash_awarded = 5000, fame_gained',
                    '    SET cash_awarded = v_prize, fame_gained');
  v_fn:=replace(v_fn,
    '        5000, jsonb_build_object(''event_id'', p_event_id, ''city_id'', v_event.city_id));',
    '        v_prize, jsonb_build_object(''event_id'', p_event_id, ''city_id'', v_event.city_id));');
  v_fn:=replace(v_fn,
$oldsettle$  UPDATE public.botb_events
    SET status = 'completed', winner_band_id = v_winner_band,
        winner_rating = v_winner_rating, resolved_at = now()
    WHERE id = p_event_id;$oldsettle$,
$newsettle$  -- Treasury receives only positive net proceeds, exactly once under event lock.
  INSERT INTO public.city_treasury(city_id,balance,total_spent)
  VALUES(v_event.city_id,v_city_profit,v_prize+v_operating_cost)
  ON CONFLICT(city_id) DO UPDATE SET
    balance=public.city_treasury.balance+EXCLUDED.balance,
    total_spent=public.city_treasury.total_spent+EXCLUDED.total_spent;

  INSERT INTO public.mayor_actions_log(city_id,mayor_id,action_type,amount,notes,metadata)
  VALUES(v_event.city_id,
    (SELECT id FROM public.city_mayors WHERE city_id=v_event.city_id
      AND is_current=true ORDER BY term_start DESC LIMIT 1),
    'botb_event_settled',v_city_profit,'Battle of the Bands net city proceeds',
    jsonb_build_object('event_id',p_event_id,'attendance',v_attendance,
       'prize_money',v_prize,'ticket_revenue',v_ticket_revenue,
       'sponsorship_revenue',v_sponsor_guarantee,'production_cost',v_operating_cost));

  UPDATE public.botb_events
    SET status='completed',winner_band_id=v_winner_band,
      winner_rating=v_winner_rating,resolved_at=now(),
      attendance=v_attendance,ticket_revenue=v_ticket_revenue,
      sponsorship_revenue=v_sponsor_guarantee,
      production_cost=v_operating_cost,city_profit=v_city_profit
    WHERE id=p_event_id;$newsettle$);
  v_fn:=replace(v_fn,
    '  RETURN jsonb_build_object(''success'', true, ''winner_band_id'', v_winner_band, ''winner_rating'', v_winner_rating);',
    '  RETURN jsonb_build_object(''success'', true, ''winner_band_id'', v_winner_band, ''winner_rating'', v_winner_rating, ''attendance'', v_attendance, ''city_profit'', v_city_profit);');
  IF v_fn=v_original OR position('v_sponsor_guarantee' IN v_fn)=0
    OR position('    SET band_balance = COALESCE(band_balance, 0) + 5000,' IN v_fn)>0
    OR position('  VALUES (v_winner_band, 5000,' IN v_fn)>0
  THEN RAISE EXCEPTION 'BOTB resolver patch incomplete'; END IF;
  EXECUTE v_fn;
END;
$botb_patch$;
REVOKE ALL ON FUNCTION public.resolve_botb_event(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_botb_event(uuid) TO service_role;
