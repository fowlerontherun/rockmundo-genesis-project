-- Support Band Marketplace Phase 5: ticket demand, 80/20 settlement and progression.

CREATE TABLE IF NOT EXISTS public.support_band_gig_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL UNIQUE REFERENCES public.gigs(id) ON DELETE CASCADE,
  support_slot_id uuid NOT NULL UNIQUE REFERENCES public.gig_support_slots(id) ON DELETE RESTRICT,
  headliner_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE RESTRICT,
  support_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE RESTRICT,
  formula_version text NOT NULL DEFAULT 'support-economics-v1',
  ticket_revenue integer NOT NULL DEFAULT 0,
  support_share integer NOT NULL DEFAULT 0,
  headliner_share integer NOT NULL DEFAULT 0,
  demand_multiplier numeric(6,4) NOT NULL DEFAULT 1,
  support_fame_gain integer NOT NULL DEFAULT 0,
  support_fan_gain integer NOT NULL DEFAULT 0,
  headliner_fame_gain integer NOT NULL DEFAULT 0,
  headliner_popularity_gain integer NOT NULL DEFAULT 0,
  support_popularity_gain integer NOT NULL DEFAULT 0,
  finance_transaction_id uuid REFERENCES public.financial_transactions(id),
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_band_gig_settlements_status_check CHECK (status IN ('pending','pending_finance','settled','no_revenue')),
  CONSTRAINT support_band_gig_settlements_amounts_check CHECK (ticket_revenue >= 0 AND support_share >= 0 AND headliner_share >= 0)
);

ALTER TABLE public.support_band_gig_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Involved bands can view support settlements" ON public.support_band_gig_settlements;
CREATE POLICY "Involved bands can view support settlements"
  ON public.support_band_gig_settlements FOR SELECT TO authenticated
  USING (
    public.can_manage_band_gigs(headliner_band_id, auth.uid())
    OR public.can_manage_band_gigs(support_band_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.support_gig_demand_multiplier(p_gig_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN gs.id IS NULL THEN 1::numeric ELSE
    LEAST(1.20::numeric,
      1.03::numeric
      + LEAST(0.09::numeric, COALESCE(sb.popularity,0)::numeric / 2000.0)
      + LEAST(0.05::numeric, COALESCE(sb.fame,0)::numeric / 20000.0)
      + LEAST(0.03::numeric,
          CASE WHEN COALESCE(hb.genre,'') <> '' AND hb.genre = sb.genre THEN 0.03 ELSE 0.01 END)
    )
  END
  FROM public.gigs g
  JOIN public.bands hb ON hb.id = g.band_id
  LEFT JOIN public.gig_support_slots gs ON gs.gig_id = g.id AND gs.status IN ('accepted','completed')
  LEFT JOIN public.bands sb ON sb.id = gs.support_band_id
  WHERE g.id = p_gig_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.support_gig_demand_multiplier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_gig_demand_multiplier(uuid) TO authenticated, service_role;

-- Replaces the current authoritative daily ticket tick, adding only a bounded support multiplier.
CREATE OR REPLACE FUNCTION public.advance_gig_ticket_sales(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH eligible AS (
    SELECT
      g.id,
      g.scheduled_date,
      COALESCE(g.created_at, g.last_ticket_update, p_now) AS booked_at,
      COALESCE(g.last_ticket_update, g.created_at, '-infinity'::timestamptz) AS last_update,
      COALESCE(g.tickets_sold, 0) AS sold,
      LEAST(
        GREATEST(COALESCE(v.capacity, 1), 1),
        GREATEST(
          round(COALESCE(g.predicted_tickets, g.estimated_attendance, 0) * public.support_gig_demand_multiplier(g.id))::integer,
          COALESCE(g.tickets_sold, 0),
          0
        )
      ) AS target
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    WHERE g.status IN ('scheduled', 'confirmed')
      AND g.scheduled_date > p_now
      AND g.scheduled_date < p_now + interval '30 days'
      AND COALESCE(g.predicted_tickets, g.estimated_attendance, 0) > 0
  ), progress AS (
    SELECT e.*,
      CASE WHEN e.scheduled_date <= e.booked_at THEN 1::numeric
      ELSE GREATEST(0::numeric, LEAST(1::numeric,
        EXTRACT(epoch FROM (p_now - e.booked_at)) / NULLIF(EXTRACT(epoch FROM (e.scheduled_date - e.booked_at)), 0))) END AS elapsed_fraction
    FROM eligible e
    WHERE e.last_update::date < p_now::date
  ), targets AS (
    SELECT p.id,
      CASE
        WHEN p.target <= p.sold THEN p.sold
        WHEN p.scheduled_date - p_now <= interval '24 hours' THEN p.target
        ELSE LEAST(p.target, GREATEST(p.sold, floor(p.target * power(p.elapsed_fraction, 0.85))::integer))
      END AS next_sold
    FROM progress p
  ), updated AS (
    UPDATE public.gigs g
    SET tickets_sold = t.next_sold, last_ticket_update = p_now
    FROM targets t WHERE g.id = t.id RETURNING g.id
  )
  SELECT count(*)::integer INTO v_updated FROM updated;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_gig_ticket_sales(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_gig_ticket_sales(timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_support_band_gig(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  g public.gigs%ROWTYPE;
  o public.gig_outcomes%ROWTYPE;
  slot public.gig_support_slots%ROWTYPE;
  existing public.support_band_gig_settlements%ROWTYPE;
  v_ticket_revenue integer := 0;
  v_support_share integer := 0;
  v_headliner_share integer := 0;
  v_multiplier numeric := 1;
  v_support_fame integer := 0;
  v_support_fans integer := 0;
  v_support_pop integer := 0;
  v_headliner_fame integer := 0;
  v_headliner_pop integer := 0;
  v_headliner_fame_current integer := 0;
  v_tx uuid;
BEGIN
  SELECT * INTO g FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF g.id IS NULL THEN RAISE EXCEPTION 'support_settlement_gig_not_found'; END IF;

  SELECT * INTO slot FROM public.gig_support_slots
  WHERE gig_id = p_gig_id AND status IN ('accepted','completed')
  ORDER BY invited_at LIMIT 1 FOR UPDATE;
  IF slot.id IS NULL THEN RETURN jsonb_build_object('settled',false,'reason','no_support'); END IF;

  SELECT * INTO o FROM public.gig_outcomes WHERE gig_id = p_gig_id FOR UPDATE;
  IF o.id IS NULL THEN RETURN jsonb_build_object('settled',false,'reason','outcome_missing'); END IF;

  SELECT * INTO existing FROM public.support_band_gig_settlements WHERE gig_id = p_gig_id FOR UPDATE;
  IF existing.id IS NOT NULL AND existing.status IN ('settled','no_revenue') THEN
    RETURN to_jsonb(existing);
  END IF;

  v_ticket_revenue := GREATEST(0, COALESCE(o.ticket_revenue, 0));
  v_support_share := round(v_ticket_revenue * COALESCE(slot.revenue_share,0.20))::integer;
  v_headliner_share := GREATEST(0, v_ticket_revenue - v_support_share);
  v_multiplier := public.support_gig_demand_multiplier(p_gig_id);

  SELECT COALESCE(fame,0) INTO v_headliner_fame_current FROM public.bands WHERE id = g.band_id;
  v_support_fame := LEAST(250, GREATEST(5, round((COALESCE(o.actual_attendance,0) / 75.0) + (v_headliner_fame_current / 500.0))::integer));
  v_support_fans := LEAST(1000, GREATEST(10, round(COALESCE(o.actual_attendance,0) * 0.04)::integer));
  v_support_pop := LEAST(8, GREATEST(1, round(COALESCE(o.overall_rating,0) / 6.0)::integer));
  v_headliner_fame := LEAST(80, GREATEST(2, round(COALESCE(o.actual_attendance,0) / 250.0)::integer));
  v_headliner_pop := LEAST(5, GREATEST(1, round(COALESCE(o.overall_rating,0) / 10.0)::integer));

  INSERT INTO public.support_band_gig_settlements(
    gig_id,support_slot_id,headliner_band_id,support_band_id,ticket_revenue,support_share,headliner_share,demand_multiplier,
    support_fame_gain,support_fan_gain,headliner_fame_gain,headliner_popularity_gain,support_popularity_gain,status,updated_at
  ) VALUES (
    p_gig_id,slot.id,g.band_id,slot.support_band_id,v_ticket_revenue,v_support_share,v_headliner_share,v_multiplier,
    v_support_fame,v_support_fans,v_headliner_fame,v_headliner_pop,v_support_pop,
    CASE WHEN v_support_share > 0 THEN 'pending' ELSE 'no_revenue' END,now()
  ) ON CONFLICT (gig_id) DO UPDATE SET
    ticket_revenue=EXCLUDED.ticket_revenue,support_share=EXCLUDED.support_share,headliner_share=EXCLUDED.headliner_share,
    demand_multiplier=EXCLUDED.demand_multiplier,support_fame_gain=EXCLUDED.support_fame_gain,support_fan_gain=EXCLUDED.support_fan_gain,
    headliner_fame_gain=EXCLUDED.headliner_fame_gain,headliner_popularity_gain=EXCLUDED.headliner_popularity_gain,
    support_popularity_gain=EXCLUDED.support_popularity_gain,updated_at=now()
  RETURNING * INTO existing;

  IF v_support_share > 0 THEN
    BEGIN
      v_tx := public.finance_transfer(
        'band', g.band_id, 'band', slot.support_band_id, v_support_share::bigint * 100,
        'gig_payment', 'Support band 20% ticket revenue share', 'support-ticket-share:'||p_gig_id::text,
        'gig', p_gig_id, NULL, jsonb_build_object('supportSlotId',slot.id,'share',slot.revenue_share)
      );

      -- Keep legacy balance mirrors aligned with the canonical finance transfer.
      UPDATE public.bands SET band_balance = GREATEST(0, COALESCE(band_balance,0) - v_support_share) WHERE id = g.band_id;
      UPDATE public.bands SET band_balance = COALESCE(band_balance,0) + v_support_share WHERE id = slot.support_band_id;

      UPDATE public.support_band_gig_settlements
      SET status='settled', finance_transaction_id=v_tx, failure_reason=NULL, settled_at=now(), updated_at=now()
      WHERE gig_id=p_gig_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.support_band_gig_settlements
      SET status='pending_finance', failure_reason=SQLERRM, updated_at=now()
      WHERE gig_id=p_gig_id;
    END;
  END IF;

  -- Progression is idempotent because this function only applies it once, when settlement was newly pending/no_revenue.
  IF existing.settled_at IS NULL THEN
    UPDATE public.bands
    SET fame = COALESCE(fame,0) + v_support_fame,
        total_fans = COALESCE(total_fans,0) + v_support_fans,
        popularity = COALESCE(popularity,0) + v_support_pop
    WHERE id = slot.support_band_id;

    UPDATE public.bands
    SET fame = COALESCE(fame,0) + v_headliner_fame,
        popularity = COALESCE(popularity,0) + v_headliner_pop
    WHERE id = g.band_id;
  END IF;

  UPDATE public.gig_support_slots SET status='completed', completed_at=COALESCE(completed_at,now()), updated_at=now() WHERE id=slot.id;

  SELECT * INTO existing FROM public.support_band_gig_settlements WHERE gig_id=p_gig_id;
  RETURN to_jsonb(existing);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_support_band_gig(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_support_band_gig(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_support_band_gig_settlement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    PERFORM public.settle_support_band_gig(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_band_gig_settlement_trigger ON public.gigs;
CREATE TRIGGER support_band_gig_settlement_trigger
AFTER UPDATE OF status ON public.gigs
FOR EACH ROW EXECUTE FUNCTION public.trigger_support_band_gig_settlement();

-- Retry finance settlements that could not complete during gig finalisation without duplicating rewards.
CREATE OR REPLACE FUNCTION public.retry_pending_support_band_settlements()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT gig_id FROM public.support_band_gig_settlements WHERE status='pending_finance' ORDER BY updated_at LIMIT 100 LOOP
    PERFORM public.settle_support_band_gig(r.gig_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.retry_pending_support_band_settlements() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.retry_pending_support_band_settlements() TO service_role;

SELECT cron.schedule('retry-support-band-settlements-hourly','23 * * * *',$cron$SELECT public.retry_pending_support_band_settlements();$cron$);
