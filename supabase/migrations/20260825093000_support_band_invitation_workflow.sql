-- Support Band Marketplace - Phase 2 invitation workflow
-- Adds idempotent invitation creation and transactional accept/decline/cancel actions.

ALTER TABLE public.gig_support_slots
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS response_note text;

CREATE UNIQUE INDEX IF NOT EXISTS gig_support_slots_request_uidx
  ON public.gig_support_slots (request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS gig_support_slots_pending_gig_idx
  ON public.gig_support_slots (gig_id, status, invited_at)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.create_gig_support_offer(
  p_gig_id uuid,
  p_support_band_id uuid,
  p_request_id uuid
) RETURNS public.gig_support_slots
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_gig public.gigs%ROWTYPE;
  v_venue public.venues%ROWTYPE;
  v_slot public.gig_support_slots%ROWTYPE;
  v_city_id uuid;
  v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'support_offer_unauthenticated' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'support_offer_request_invalid' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_actor FROM public.profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_profile_missing' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_slot FROM public.gig_support_slots WHERE request_id = p_request_id;
  IF FOUND THEN
    RETURN v_slot;
  END IF;

  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_gig_invalid' USING ERRCODE='23503';
  END IF;
  IF NOT public.can_manage_band_gigs(v_gig.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'support_offer_forbidden' USING ERRCODE='42501';
  END IF;
  IF v_gig.band_id = p_support_band_id THEN
    RAISE EXCEPTION 'support_offer_self_support' USING ERRCODE='23514';
  END IF;
  IF v_gig.status NOT IN ('scheduled','ready_for_completion') OR v_gig.scheduled_date <= now() THEN
    RAISE EXCEPTION 'support_offer_gig_unavailable' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_venue FROM public.venues WHERE id = v_gig.venue_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_venue_invalid' USING ERRCODE='23503';
  END IF;
  v_city_id := v_venue.city_id;
  v_end := COALESCE(v_gig.scheduled_end, v_gig.scheduled_date + interval '3 hours');

  IF EXISTS (
    SELECT 1 FROM public.gig_support_slots gs
    WHERE gs.gig_id = p_gig_id AND gs.status IN ('accepted','completed')
  ) THEN
    RAISE EXCEPTION 'support_offer_slot_filled' USING ERRCODE='23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gig_support_slots gs
    WHERE gs.gig_id = p_gig_id
      AND gs.support_band_id = p_support_band_id
      AND gs.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'support_offer_already_pending' USING ERRCODE='23505';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.find_available_support_bands(
      v_gig.band_id,
      v_city_id,
      v_gig.scheduled_date,
      v_end,
      false,
      COALESCE(v_venue.capacity,0)
    ) candidate
    WHERE candidate.band_id = p_support_band_id
  ) THEN
    RAISE EXCEPTION 'support_offer_band_unavailable' USING ERRCODE='23P01';
  END IF;

  INSERT INTO public.gig_support_slots (
    gig_id, support_band_id, invited_by, status, revenue_share, request_id
  ) VALUES (
    p_gig_id, p_support_band_id, v_actor.id, 'pending', 0.2000, p_request_id
  )
  RETURNING * INTO v_slot;

  RETURN v_slot;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_gig_support_offer(
  p_support_slot_id uuid,
  p_action text,
  p_response_note text DEFAULT NULL
) RETURNS public.gig_support_slots
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slot public.gig_support_slots%ROWTYPE;
  v_gig public.gigs%ROWTYPE;
  v_venue public.venues%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_end timestamptz;
BEGIN
  IF p_action NOT IN ('accept','decline') THEN
    RAISE EXCEPTION 'support_offer_action_invalid' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_slot
  FROM public.gig_support_slots
  WHERE id = p_support_slot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_not_found' USING ERRCODE='23503';
  END IF;

  IF NOT public.can_manage_band_gigs(v_slot.support_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'support_offer_response_forbidden' USING ERRCODE='42501';
  END IF;

  IF v_slot.status <> 'pending' THEN
    IF (p_action = 'accept' AND v_slot.status = 'accepted')
       OR (p_action = 'decline' AND v_slot.status = 'declined') THEN
      RETURN v_slot;
    END IF;
    RAISE EXCEPTION 'support_offer_not_pending' USING ERRCODE='23514';
  END IF;

  IF p_action = 'decline' THEN
    UPDATE public.gig_support_slots
    SET status = 'declined', responded_at = now(), response_note = p_response_note, updated_at = now()
    WHERE id = v_slot.id
    RETURNING * INTO v_slot;
    RETURN v_slot;
  END IF;

  SELECT * INTO v_gig FROM public.gigs WHERE id = v_slot.gig_id FOR UPDATE;
  IF NOT FOUND OR v_gig.status NOT IN ('scheduled','ready_for_completion') OR v_gig.scheduled_date <= now() THEN
    RAISE EXCEPTION 'support_offer_gig_unavailable' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_band FROM public.bands WHERE id = v_slot.support_band_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_band_invalid' USING ERRCODE='23503';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('support-gig:' || v_gig.id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('support-band:' || v_slot.support_band_id::text, 0));

  SELECT * INTO v_venue FROM public.venues WHERE id = v_gig.venue_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_venue_invalid' USING ERRCODE='23503';
  END IF;
  v_end := COALESCE(v_gig.scheduled_end, v_gig.scheduled_date + interval '3 hours');

  IF EXISTS (
    SELECT 1 FROM public.gig_support_slots gs
    WHERE gs.gig_id = v_gig.id
      AND gs.id <> v_slot.id
      AND gs.status IN ('accepted','completed')
  ) THEN
    RAISE EXCEPTION 'support_offer_slot_filled' USING ERRCODE='23505';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.find_available_support_bands(
      v_gig.band_id,
      v_venue.city_id,
      v_gig.scheduled_date,
      v_end,
      false,
      COALESCE(v_venue.capacity,0)
    ) candidate
    WHERE candidate.band_id = v_slot.support_band_id
  ) THEN
    RAISE EXCEPTION 'support_offer_band_unavailable' USING ERRCODE='23P01';
  END IF;

  UPDATE public.gig_support_slots
  SET status = 'accepted', responded_at = now(), response_note = p_response_note, updated_at = now()
  WHERE id = v_slot.id
  RETURNING * INTO v_slot;

  INSERT INTO public.player_scheduled_activities (
    user_id, profile_id, activity_type, scheduled_start, scheduled_end,
    status, title, location, linked_gig_id, metadata
  )
  SELECT
    p.user_id,
    p.id,
    'gig',
    v_gig.scheduled_date,
    v_end,
    'scheduled',
    'Support gig at ' || v_venue.name,
    v_venue.name,
    v_gig.id,
    jsonb_build_object(
      'band_id', v_slot.support_band_id,
      'headliner_band_id', v_gig.band_id,
      'venueId', v_gig.venue_id,
      'is_band_activity', true,
      'gig_role', 'support',
      'support_slot_id', v_slot.id
    )
  FROM public.profiles p
  WHERE p.id IN (
    SELECT COALESCE(bm.profile_id, mp.id)
    FROM public.band_members bm
    LEFT JOIN public.profiles mp ON mp.user_id = bm.user_id
    WHERE bm.band_id = v_slot.support_band_id
      AND COALESCE(bm.member_status,'active') = 'active'
      AND COALESCE(bm.is_touring_member,false) = false
      AND COALESCE(bm.profile_id,mp.id) IS NOT NULL
    UNION
    SELECT v_band.leader_id
    WHERE EXISTS (SELECT 1 FROM public.profiles lp WHERE lp.id = v_band.leader_id)
  )
  ON CONFLICT (linked_gig_id,profile_id)
    WHERE linked_gig_id IS NOT NULL AND status <> 'cancelled'
  DO NOTHING;

  UPDATE public.gig_support_slots other
  SET status = 'expired', updated_at = now()
  FROM public.gigs other_gig
  WHERE other.gig_id = other_gig.id
    AND other.support_band_id = v_slot.support_band_id
    AND other.id <> v_slot.id
    AND other.status = 'pending'
    AND other_gig.scheduled_date < v_end
    AND COALESCE(other_gig.scheduled_end, other_gig.scheduled_date + interval '3 hours') > v_gig.scheduled_date;

  UPDATE public.gig_support_slots
  SET status = 'expired', updated_at = now()
  WHERE gig_id = v_gig.id
    AND id <> v_slot.id
    AND status = 'pending';

  RETURN v_slot;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_gig_support_offer(
  p_support_slot_id uuid
) RETURNS public.gig_support_slots
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slot public.gig_support_slots%ROWTYPE;
  v_gig public.gigs%ROWTYPE;
BEGIN
  SELECT * INTO v_slot FROM public.gig_support_slots WHERE id = p_support_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_offer_not_found' USING ERRCODE='23503';
  END IF;
  SELECT * INTO v_gig FROM public.gigs WHERE id = v_slot.gig_id;
  IF NOT FOUND OR NOT public.can_manage_band_gigs(v_gig.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'support_offer_cancel_forbidden' USING ERRCODE='42501';
  END IF;
  IF v_slot.status <> 'pending' THEN
    RAISE EXCEPTION 'support_offer_cancel_not_pending' USING ERRCODE='23514';
  END IF;

  UPDATE public.gig_support_slots
  SET status = 'cancelled', updated_at = now(), responded_at = now()
  WHERE id = v_slot.id
  RETURNING * INTO v_slot;
  RETURN v_slot;
END;
$$;

REVOKE ALL ON FUNCTION public.create_gig_support_offer(uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_gig_support_offer(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_gig_support_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_gig_support_offer(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_gig_support_offer(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_gig_support_offer(uuid) TO authenticated;

COMMENT ON FUNCTION public.create_gig_support_offer(uuid,uuid,uuid) IS
  'Creates an idempotent support invitation only when the selected band remains eligible for the scheduled gig.';
COMMENT ON FUNCTION public.respond_to_gig_support_offer(uuid,text,text) IS
  'Accepts or declines a support invitation. Acceptance locks gig/band, revalidates eligibility, blocks active member schedules, and expires conflicts atomically.';
