-- Extract the shared Battle of the Bands settlement economics into a
-- read-only RPC, allowing City Hall to forecast attendance and sponsorship.
-- Existing events, entrants and historical results are not modified.
CREATE OR REPLACE FUNCTION public.botb_estimate_event_finances(p_event_id uuid)
RETURNS TABLE(
  prize_money integer,
  band_count integer,
  attendance integer,
  ticket_revenue bigint,
  sponsorship_revenue bigint,
  production_cost bigint,
  city_profit bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $botb_finance$
DECLARE
  v_city_id uuid;
  v_prize integer;
  v_population integer;
  v_band_count integer;
  v_base_audience numeric;
  v_city_capacity integer;
  v_attendance integer;
  v_production_cost bigint;
  v_ticket_revenue bigint;
  v_sponsors bigint;
  v_net bigint;
BEGIN
  SELECT e.city_id, e.prize_money, c.population
  INTO v_city_id, v_prize, v_population
  FROM public.botb_events e
  JOIN public.cities c ON c.id = e.city_id
  WHERE e.id = p_event_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COUNT(*)::integer,
         COALESCE(SUM(GREATEST(15::numeric, LEAST(20000::numeric,
           25 + COALESCE(f.local_fans,0) * 0.12
              + COALESCE(f.city_fame,0) * 0.4
              + GREATEST(0, COALESCE(b.total_fans,0)) * 0.006
              + GREATEST(0, COALESCE(b.fame,0)) * 0.025))),0)
  INTO v_band_count,v_base_audience
  FROM public.botb_entries be
  JOIN public.bands b ON b.id = be.band_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(GREATEST(0,COALESCE(total_fans,0))),0) AS local_fans,
           COALESCE(SUM(GREATEST(0,COALESCE(city_fame,0))),0) AS city_fame
    FROM public.band_city_fans cf
    WHERE cf.band_id=be.band_id AND cf.city_id=v_city_id
  ) f ON true
  WHERE be.event_id=p_event_id;

  -- Zero registrants means an upcoming battle can still be cancelled without
  -- any ticket sales, costs, sponsor underwriting or prize payout.
  IF v_band_count=0 THEN
    RETURN QUERY SELECT v_prize,0,0,0::bigint,0::bigint,0::bigint,0::bigint;
    RETURN;
  END IF;

  v_city_capacity := LEAST(30000,GREATEST(200,
    FLOOR(COALESCE(NULLIF(v_population,0),250000)*0.05)::integer));
  v_attendance := LEAST(v_city_capacity,GREATEST(v_band_count*8,
    ROUND(v_base_audience*(1+LEAST(0.6,LN(1+v_prize)/18.0)))::integer));
  v_production_cost := 750::bigint + v_band_count*100::bigint;
  v_ticket_revenue := v_attendance::bigint*25;
  -- Simulated external sponsorship must make up any shortfall.
  v_sponsors := GREATEST(0::bigint,v_prize::bigint+v_production_cost-v_ticket_revenue);
  v_net := v_ticket_revenue+v_sponsors-v_prize-v_production_cost;
  IF v_net < 0 THEN RAISE EXCEPTION 'BOTB_CITY_DEFICIT_BLOCKED'; END IF;

  RETURN QUERY SELECT v_prize,v_band_count,v_attendance,
    v_ticket_revenue,v_sponsors,v_production_cost,v_net;
END;
$botb_finance$;
REVOKE ALL ON FUNCTION public.botb_estimate_event_finances(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.botb_estimate_event_finances(uuid) TO authenticated,service_role;

-- Modify only the old finance block, preserving all XP, popularity, placement,
-- trophy, activity feed and band-earnings behavior in the deployed resolver.
DO $replace_botb_finance$
DECLARE
  v_previous text := pg_get_functiondef('public.resolve_botb_event(uuid)'::regprocedure);
  v_updated text;
BEGIN
  IF position($expected$  -- Attendance combines EACH participating band's local fans and fame.
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
$expected$ IN v_previous) = 0 THEN
    RAISE EXCEPTION 'BOTB resolver changed; manual finance review required';
  END IF;
  v_updated := replace(v_previous,$old$  -- Attendance combines EACH participating band's local fans and fame.
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
$old$,$new$  -- One authoritative financial calculation for both previews and settlements.
  -- This runs before winner fame/fans are added, so preview and final award
  -- use the same participant inputs.
  SELECT estimate.prize_money, estimate.band_count, estimate.attendance,
         estimate.ticket_revenue, estimate.sponsorship_revenue,
         estimate.production_cost, estimate.city_profit
  INTO v_prize, v_entry_count, v_attendance, v_ticket_revenue,
       v_sponsor_guarantee, v_operating_cost, v_city_profit
  FROM public.botb_estimate_event_finances(p_event_id) AS estimate;
  IF NOT FOUND OR v_entry_count < 1 OR v_city_profit < 0 THEN
    RAISE EXCEPTION 'BOTB_FINANCE_ESTIMATE_INVALID';
  END IF;
$new$);
  IF v_updated=v_previous
     OR position('  SELECT estimate.prize_money' IN v_updated)=0
     OR position('  v_attendance:=LEAST(' IN v_updated)>0
  THEN RAISE EXCEPTION 'BOTB shared finance refactor incomplete'; END IF;
  EXECUTE v_updated;
END;
$replace_botb_finance$;

-- Restrict older battle entry RPC to authenticated users only, matching its
-- existing explicit auth.uid() gate (defense in depth, no entry-policy change).
REVOKE ALL ON FUNCTION public.enter_battle_of_the_bands(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.enter_battle_of_the_bands(uuid,uuid,uuid,uuid,uuid) TO authenticated,service_role;
