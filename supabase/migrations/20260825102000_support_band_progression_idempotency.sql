-- Phase 5 hardening: progression must never be duplicated when finance settlement retries.
ALTER TABLE public.support_band_gig_settlements
  ADD COLUMN IF NOT EXISTS progression_applied_at timestamptz;

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
  IF existing.id IS NOT NULL
     AND existing.status IN ('settled','no_revenue')
     AND existing.progression_applied_at IS NOT NULL THEN
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

  IF v_support_share > 0 AND existing.status <> 'settled' THEN
    BEGIN
      v_tx := public.finance_transfer(
        'band', g.band_id, 'band', slot.support_band_id, v_support_share::bigint * 100,
        'gig_payment', 'Support band 20% ticket revenue share', 'support-ticket-share:'||p_gig_id::text,
        'gig', p_gig_id, NULL, jsonb_build_object('supportSlotId',slot.id,'share',slot.revenue_share)
      );
      UPDATE public.bands SET band_balance = GREATEST(0, COALESCE(band_balance,0) - v_support_share) WHERE id = g.band_id;
      UPDATE public.bands SET band_balance = COALESCE(band_balance,0) + v_support_share WHERE id = slot.support_band_id;
      UPDATE public.support_band_gig_settlements
      SET status='settled', finance_transaction_id=v_tx, failure_reason=NULL, settled_at=COALESCE(settled_at,now()), updated_at=now()
      WHERE gig_id=p_gig_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.support_band_gig_settlements
      SET status='pending_finance', failure_reason=SQLERRM, updated_at=now()
      WHERE gig_id=p_gig_id;
    END;
  END IF;

  SELECT * INTO existing FROM public.support_band_gig_settlements WHERE gig_id=p_gig_id FOR UPDATE;
  IF existing.progression_applied_at IS NULL THEN
    UPDATE public.bands
    SET fame = COALESCE(fame,0) + v_support_fame,
        total_fans = COALESCE(total_fans,0) + v_support_fans,
        popularity = COALESCE(popularity,0) + v_support_pop
    WHERE id = slot.support_band_id;

    UPDATE public.bands
    SET fame = COALESCE(fame,0) + v_headliner_fame,
        popularity = COALESCE(popularity,0) + v_headliner_pop
    WHERE id = g.band_id;

    UPDATE public.support_band_gig_settlements SET progression_applied_at=now(), updated_at=now() WHERE gig_id=p_gig_id;
  END IF;

  UPDATE public.gig_support_slots
  SET status='completed', completed_at=COALESCE(completed_at,now()), updated_at=now()
  WHERE id=slot.id;

  SELECT * INTO existing FROM public.support_band_gig_settlements WHERE gig_id=p_gig_id;
  RETURN to_jsonb(existing);
END;
$$;
