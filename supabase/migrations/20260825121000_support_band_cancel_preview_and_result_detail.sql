-- Support Band Marketplace Phase 9: safe cancellation preview and detailed result access.

CREATE OR REPLACE FUNCTION public.preview_support_band_cancellation(p_support_slot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.gig_support_slots%ROWTYPE;
  g public.gigs%ROWTYPE;
  v_hours numeric;
  v_rel numeric := 0;
  v_rep integer := 0;
  v_relationship integer := 0;
BEGIN
  SELECT * INTO s FROM public.gig_support_slots WHERE id=p_support_slot_id;
  IF s.id IS NULL THEN RAISE EXCEPTION 'support_cancel_slot_not_found' USING ERRCODE='23503'; END IF;
  SELECT * INTO g FROM public.gigs WHERE id=s.gig_id;
  IF g.id IS NULL THEN RAISE EXCEPTION 'support_cancel_gig_not_found' USING ERRCODE='23503'; END IF;
  IF NOT public.can_manage_band_gigs(s.support_band_id, auth.uid()) THEN RAISE EXCEPTION 'support_cancel_preview_forbidden' USING ERRCODE='42501'; END IF;
  IF s.status <> 'accepted' OR g.scheduled_date <= now() THEN RAISE EXCEPTION 'support_cancel_preview_unavailable' USING ERRCODE='23514'; END IF;

  v_hours := GREATEST(0, EXTRACT(EPOCH FROM (g.scheduled_date-now()))/3600.0);
  IF v_hours < 24 THEN v_rel:=25; v_rep:=30; v_relationship:=18;
  ELSIF v_hours < 72 THEN v_rel:=15; v_rep:=18; v_relationship:=10;
  ELSIF v_hours < 168 THEN v_rel:=8; v_rep:=10; v_relationship:=6;
  ELSE v_rel:=4; v_rep:=5; v_relationship:=3;
  END IF;

  RETURN jsonb_build_object(
    'supportSlotId',s.id,'gigId',g.id,'scheduledDate',g.scheduled_date,
    'hoursBeforeShow',round(v_hours,2),'reliabilityPenalty',v_rel,
    'reputationPenalty',v_rep,'relationshipPenalty',v_relationship,
    'severity',CASE WHEN v_hours<24 THEN 'severe' WHEN v_hours<72 THEN 'high' WHEN v_hours<168 THEN 'moderate' ELSE 'low' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_support_band_cancellation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preview_support_band_cancellation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_support_gig_contribution(p_gig_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN h.id IS NULL THEN NULL ELSE jsonb_build_object(
    'gigId',h.gig_id,
    'supportSlotId',h.support_slot_id,
    'supportBandId',h.support_band_id,
    'supportBandName',sb.name,
    'headlinerBandId',h.headliner_band_id,
    'headlinerBandName',hb.name,
    'attendance',h.attendance,
    'performanceRating',h.performance_rating,
    'ticketRevenue',h.ticket_revenue,
    'supportPayment',h.support_payment,
    'ticketDemandMultiplier',h.ticket_demand_multiplier,
    'ticketDemandBoostPercent',round((h.ticket_demand_multiplier-1)*100,1),
    'supportFameGain',h.support_fame_gain,
    'supportFanGain',h.support_fan_gain,
    'supportPopularityGain',h.support_popularity_gain,
    'headlinerFameGain',h.headliner_fame_gain,
    'headlinerPopularityGain',h.headliner_popularity_gain,
    'relationshipGain',h.relationship_gain,
    'reputationGain',h.reputation_gain,
    'performedAt',h.performed_at
  ) END
  FROM public.band_support_history h
  JOIN public.bands sb ON sb.id=h.support_band_id
  JOIN public.bands hb ON hb.id=h.headliner_band_id
  WHERE h.gig_id=p_gig_id
    AND (public.can_manage_band_gigs(h.support_band_id,auth.uid()) OR public.can_manage_band_gigs(h.headliner_band_id,auth.uid()));
$$;

REVOKE ALL ON FUNCTION public.get_support_gig_contribution(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_support_gig_contribution(uuid) TO authenticated;
