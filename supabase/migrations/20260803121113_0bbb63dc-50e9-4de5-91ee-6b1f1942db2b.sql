CREATE OR REPLACE FUNCTION public.settle_legacy_festival_participation(
  p_participation_id uuid,
  p_crowd_energy_avg integer DEFAULT NULL,
  p_crowd_energy_peak integer DEFAULT NULL,
  p_songs_performed integer DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part            record;
  v_event           record;
  v_band            record;
  v_existing        record;
  v_energy_avg      integer;
  v_energy_peak     integer;
  v_songs           integer;
  v_score           integer;
  v_base_payment    integer;
  v_base_fame       integer;
  v_multiplier      numeric;
  v_payment         integer;
  v_fame            integer;
  v_merch           integer;
  v_fans            integer;
  v_critic          integer;
  v_fan_score       integer;
  v_headline        text;
BEGIN
  IF p_participation_id IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_PARTICIPATION_REQUIRED';
  END IF;

  SELECT * INTO v_part
  FROM public.festival_participants
  WHERE id = p_participation_id
  FOR UPDATE;

  IF v_part IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_PARTICIPATION_NOT_FOUND';
  END IF;

  IF NOT public.caller_can_act_for_band(v_part.band_id) THEN
    RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_NOT_AUTHORISED';
  END IF;

  -- Idempotent: an already settled performance returns its recorded result.
  SELECT * INTO v_existing
  FROM public.festival_performance_history
  WHERE participation_id = p_participation_id
  ORDER BY performance_date DESC NULLS LAST
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'settled', false,
      'already_settled', true,
      'performance_id', v_existing.id,
      'performance_score', v_existing.performance_score,
      'payment_earned', v_existing.payment_earned,
      'fame_earned', v_existing.fame_earned,
      'merch_revenue', v_existing.merch_revenue,
      'new_fans_gained', v_existing.new_fans_gained,
      'critic_score', v_existing.critic_score,
      'fan_score', v_existing.fan_score,
      'review_headline', v_existing.review_headline
    );
  END IF;

  IF coalesce(v_part.status, '') NOT IN ('confirmed', 'pending', 'invited', 'accepted') THEN
    RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_INVALID_STATUS';
  END IF;

  SELECT * INTO v_event FROM public.game_events WHERE id = v_part.event_id;
  SELECT * INTO v_band FROM public.bands WHERE id = v_part.band_id FOR UPDATE;

  IF v_band IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_SETTLEMENT_BAND_NOT_FOUND';
  END IF;

  v_energy_avg  := greatest(0, least(100, coalesce(p_crowd_energy_avg, 60)));
  v_energy_peak := greatest(v_energy_avg, least(100, coalesce(p_crowd_energy_peak, v_energy_avg + 10)));
  v_songs       := greatest(1, least(30, coalesce(p_songs_performed, 8)));

  -- Server-authoritative score: band strength dominates, reported crowd energy is a bounded input.
  v_score := greatest(
    35,
    least(
      100,
      round(
        45
        + least(25, coalesce(v_band.chemistry_level, v_band.chemistry, 50)::numeric * 0.25)
        + least(15, ln(greatest(1, coalesce(v_band.fame, 0)::numeric)) * 2)
        + (v_energy_avg::numeric * 0.15)
        + (random() * 6 - 3)
      )
    )
  );

  v_base_payment := greatest(500, coalesce(v_part.payout_amount, 0));
  IF v_base_payment <= 500 THEN
    v_base_payment := 5000;
  END IF;
  v_base_fame := greatest(25, coalesce((v_event.rewards ->> 'fame')::integer, 100));

  v_multiplier := 0.5 + (v_score::numeric / 100) * 0.9;          -- 0.5 .. 1.4
  v_payment := least(v_base_payment * 3, round(v_base_payment * v_multiplier))::integer;
  v_fame    := least(v_base_fame * 3, round(v_base_fame * v_multiplier))::integer;
  v_merch   := round(v_payment * 0.18 * (v_energy_avg::numeric / 100))::integer;
  v_fans    := round(v_fame * 0.6 * (v_energy_avg::numeric / 100))::integer;

  v_critic    := greatest(1, least(100, v_score + (random() * 10 - 5)::integer));
  v_fan_score := greatest(1, least(100, round((v_score + v_energy_avg) / 2.0)::integer));
  v_headline  := CASE
    WHEN v_score >= 90 THEN 'A festival set that will be talked about for years'
    WHEN v_score >= 75 THEN 'A confident, crowd-pleasing festival performance'
    WHEN v_score >= 60 THEN 'A solid set with flashes of brilliance'
    WHEN v_score >= 45 THEN 'An uneven set that never quite caught fire'
    ELSE 'A difficult afternoon on the festival circuit'
  END;

  UPDATE public.bands
  SET band_balance = coalesce(band_balance, 0) + v_payment + v_merch,
      fame = coalesce(fame, 0) + v_fame
  WHERE id = v_part.band_id;

  UPDATE public.festival_participants
  SET status = 'performed',
      updated_at = now()
  WHERE id = p_participation_id;

  INSERT INTO public.festival_performance_history (
    participation_id, band_id, festival_id, performance_score,
    crowd_energy_peak, crowd_energy_avg, songs_performed,
    payment_earned, fame_earned, merch_revenue, new_fans_gained,
    critic_score, fan_score, review_headline, review_summary,
    slot_type, stage_name, performance_date
  ) VALUES (
    p_participation_id, v_part.band_id, v_part.event_id, v_score,
    v_energy_peak, v_energy_avg, v_songs,
    v_payment, v_fame, v_merch, v_fans,
    v_critic, v_fan_score, v_headline,
    format('Scored %s/100 in front of a crowd averaging %s%% energy across %s songs.', v_score, v_energy_avg, v_songs),
    v_part.slot_type, v_part.stage_name, now()
  )
  RETURNING id INTO v_existing;

  RETURN jsonb_build_object(
    'settled', true,
    'already_settled', false,
    'performance_id', v_existing.id,
    'performance_score', v_score,
    'payment_earned', v_payment,
    'fame_earned', v_fame,
    'merch_revenue', v_merch,
    'new_fans_gained', v_fans,
    'critic_score', v_critic,
    'fan_score', v_fan_score,
    'review_headline', v_headline,
    'crowd_energy_avg', v_energy_avg,
    'crowd_energy_peak', v_energy_peak
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_legacy_festival_participation(uuid, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_legacy_festival_participation(uuid, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_legacy_festival_participation(uuid, integer, integer, integer) TO service_role;