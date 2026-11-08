-- Proposal responses have one authority; legacy standalone offers remain supported.
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.respond_to_gig_support_offer(
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
  IF auth.uid() IS NULL OR p_action IS NULL OR p_action NOT IN ('accept','decline') THEN
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
      v_gig.tour_id IS NOT NULL,
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

CREATE OR REPLACE FUNCTION private.respond_to_tour_support_offers(p_offers jsonb,p_action text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_offer jsonb; v_slot public.gig_support_slots%ROWTYPE; v_gig public.gigs%ROWTYPE;
 v_tour uuid; v_band uuid; v_headliner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'tour_support_forbidden' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('accept','decline') OR p_offers IS NULL OR jsonb_typeof(p_offers)<>'array' THEN
   RAISE EXCEPTION 'tour_support_response_invalid' USING ERRCODE='22023';
 END IF;
 IF jsonb_array_length(p_offers) NOT BETWEEN 1 AND 100 OR
   (SELECT count(DISTINCT x->>'slot_id') FROM jsonb_array_elements(p_offers) x)<>jsonb_array_length(p_offers) THEN
   RAISE EXCEPTION 'tour_support_response_invalid' USING ERRCODE='22023';
 END IF;
 -- Validate the entire reviewed itinerary before changing any slot.
 FOR v_offer IN SELECT x FROM jsonb_array_elements(p_offers) x ORDER BY x->>'slot_id' LOOP
   SELECT * INTO v_slot FROM public.gig_support_slots WHERE id=(v_offer->>'slot_id')::uuid FOR UPDATE;
   IF NOT FOUND OR NOT COALESCE(public.can_manage_band_gigs(v_slot.support_band_id,auth.uid()),false) THEN
     RAISE EXCEPTION 'tour_support_forbidden' USING ERRCODE='42501';
   END IF;
   SELECT * INTO v_gig FROM public.gigs WHERE id=v_slot.gig_id FOR UPDATE;
   IF NOT FOUND OR v_gig.tour_id IS NULL OR v_slot.gig_id IS DISTINCT FROM (v_offer->>'gig_id')::uuid THEN
     RAISE EXCEPTION 'tour_support_gig_mismatch' USING ERRCODE='23514';
   END IF;
   IF v_tour IS NULL THEN v_tour:=v_gig.tour_id; v_band:=v_slot.support_band_id; v_headliner:=v_gig.band_id; END IF;
   IF v_tour<>v_gig.tour_id OR v_band<>v_slot.support_band_id OR v_headliner<>v_gig.band_id THEN
     RAISE EXCEPTION 'tour_support_mixed_offers' USING ERRCODE='23514';
   END IF;
   IF p_action='accept' AND (
      v_gig.tour_id IS DISTINCT FROM (v_offer->>'tour_id')::uuid OR
      v_gig.venue_id IS DISTINCT FROM (v_offer->>'venue_id')::uuid OR
      v_gig.scheduled_date IS DISTINCT FROM (v_offer->>'scheduled_date')::timestamptz OR
      v_gig.scheduled_end IS DISTINCT FROM (v_offer->>'scheduled_end')::timestamptz OR
      v_slot.revenue_share IS DISTINCT FROM (v_offer->>'revenue_share')::numeric) THEN
     RAISE EXCEPTION 'tour_support_itinerary_changed' USING ERRCODE='23514';
   END IF;
 END LOOP;
 FOR v_offer IN SELECT x FROM jsonb_array_elements(p_offers) x ORDER BY x->>'slot_id' LOOP
   PERFORM private.respond_to_gig_support_offer((v_offer->>'slot_id')::uuid,p_action,NULL);
 END LOOP;
 RETURN jsonb_array_length(p_offers);
END;
$$;

REVOKE ALL ON FUNCTION private.respond_to_gig_support_offer(uuid,text,text),private.respond_to_tour_support_offers(jsonb,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.respond_to_gig_support_offer(p_support_slot_id uuid,p_action text,p_response_note text DEFAULT NULL)
RETURNS public.gig_support_slots LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.gig_support_slots%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR p_action IS NULL OR p_action NOT IN ('accept','decline') THEN RAISE EXCEPTION 'support_offer_action_invalid' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM public.gig_support_slots WHERE id=p_support_slot_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'support_offer_not_found' USING ERRCODE='23503'; END IF;
 IF NOT COALESCE(public.can_manage_band_gigs(s.support_band_id,auth.uid()),false) THEN RAISE EXCEPTION 'support_offer_response_forbidden' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.support_tour_proposals p WHERE s.id=ANY(p.slot_ids)) THEN RAISE EXCEPTION 'support_offer_proposal_response_required' USING ERRCODE='23514'; END IF;
 RETURN private.respond_to_gig_support_offer(p_support_slot_id,p_action,p_response_note);
END; $$;
CREATE OR REPLACE FUNCTION public.respond_to_tour_support_offers(p_offers jsonb,p_action text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_offer jsonb; v_slot public.gig_support_slots%ROWTYPE; v_gig public.gigs%ROWTYPE;
 v_tour uuid; v_band uuid; v_headliner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'tour_support_forbidden' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('accept','decline') OR p_offers IS NULL OR jsonb_typeof(p_offers)<>'array' THEN
   RAISE EXCEPTION 'tour_support_response_invalid' USING ERRCODE='22023';
 END IF;
 IF jsonb_array_length(p_offers) NOT BETWEEN 1 AND 100 OR
   (SELECT count(DISTINCT x->>'slot_id') FROM jsonb_array_elements(p_offers) x)<>jsonb_array_length(p_offers) THEN
   RAISE EXCEPTION 'tour_support_response_invalid' USING ERRCODE='22023';
 END IF;
 -- Validate the entire reviewed itinerary before changing any slot.
 FOR v_offer IN SELECT x FROM jsonb_array_elements(p_offers) x ORDER BY x->>'slot_id' LOOP
   SELECT * INTO v_slot FROM public.gig_support_slots WHERE id=(v_offer->>'slot_id')::uuid FOR UPDATE;
   IF NOT FOUND OR NOT COALESCE(public.can_manage_band_gigs(v_slot.support_band_id,auth.uid()),false) THEN
     RAISE EXCEPTION 'tour_support_forbidden' USING ERRCODE='42501';
   END IF;
   IF EXISTS(SELECT 1 FROM public.support_tour_proposals p WHERE v_slot.id=ANY(p.slot_ids)) THEN RAISE EXCEPTION 'support_offer_proposal_response_required' USING ERRCODE='23514'; END IF;
   SELECT * INTO v_gig FROM public.gigs WHERE id=v_slot.gig_id FOR UPDATE;
   IF NOT FOUND OR v_gig.tour_id IS NULL OR v_slot.gig_id IS DISTINCT FROM (v_offer->>'gig_id')::uuid THEN
     RAISE EXCEPTION 'tour_support_gig_mismatch' USING ERRCODE='23514';
   END IF;
   IF v_tour IS NULL THEN v_tour:=v_gig.tour_id; v_band:=v_slot.support_band_id; v_headliner:=v_gig.band_id; END IF;
   IF v_tour<>v_gig.tour_id OR v_band<>v_slot.support_band_id OR v_headliner<>v_gig.band_id THEN
     RAISE EXCEPTION 'tour_support_mixed_offers' USING ERRCODE='23514';
   END IF;
   IF p_action='accept' AND (
      v_gig.tour_id IS DISTINCT FROM (v_offer->>'tour_id')::uuid OR
      v_gig.venue_id IS DISTINCT FROM (v_offer->>'venue_id')::uuid OR
      v_gig.scheduled_date IS DISTINCT FROM (v_offer->>'scheduled_date')::timestamptz OR
      v_gig.scheduled_end IS DISTINCT FROM (v_offer->>'scheduled_end')::timestamptz OR
      v_slot.revenue_share IS DISTINCT FROM (v_offer->>'revenue_share')::numeric) THEN
     RAISE EXCEPTION 'tour_support_itinerary_changed' USING ERRCODE='23514';
   END IF;
 END LOOP;
 FOR v_offer IN SELECT x FROM jsonb_array_elements(p_offers) x ORDER BY x->>'slot_id' LOOP
   PERFORM public.respond_to_gig_support_offer((v_offer->>'slot_id')::uuid,p_action,NULL);
 END LOOP;
 RETURN jsonb_array_length(p_offers);
END;
$$;

CREATE OR REPLACE FUNCTION private.close_changed_support_proposal(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.support_tour_proposals%ROWTYPE; old_flag text;
BEGIN
 SELECT * INTO p FROM public.support_tour_proposals WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.status NOT IN ('pending','changed') THEN RETURN; END IF;
 old_flag:=current_setting('app.support_proposal',true); PERFORM set_config('app.support_proposal','1',true);
 IF p.status='pending' THEN UPDATE public.support_tour_proposals SET status='changed',updated_at=now() WHERE id=p.id; END IF;
 UPDATE public.gig_support_slots SET status='expired',updated_at=now() WHERE id=ANY(p.slot_ids) AND status='pending';
 PERFORM set_config('app.support_proposal',COALESCE(old_flag,''),true);
END; $$;
REVOKE ALL ON FUNCTION private.close_changed_support_proposal(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.close_proposal_after_slot_removal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p record;
BEGIN
 IF OLD.status IS NOT DISTINCT FROM NEW.status OR OLD.status<>'pending' OR NEW.status NOT IN ('cancelled','expired','declined') THEN RETURN NEW; END IF;
 FOR p IN SELECT id FROM public.support_tour_proposals WHERE NEW.id=ANY(slot_ids) AND status='pending' ORDER BY id LOOP
  IF p.id::text IS DISTINCT FROM current_setting('app.support_proposal_response_id',true) THEN PERFORM private.close_changed_support_proposal(p.id); END IF;
 END LOOP;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.close_proposal_after_slot_removal() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER play_together_proposal_slot_cleanup AFTER UPDATE OF status ON public.gig_support_slots FOR EACH ROW EXECUTE FUNCTION private.close_proposal_after_slot_removal();
CREATE OR REPLACE FUNCTION public.respond_support_tour_proposal(p_id uuid,p_action text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.support_tour_proposals%ROWTYPE; slot uuid; old_flag text; old_response_id text;
BEGIN
 SELECT * INTO p FROM public.support_tour_proposals WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR p_action IS NULL OR p_action NOT IN ('accept','decline','withdraw') OR
  NOT COALESCE(public.can_manage_band_gigs(CASE WHEN p_action='withdraw' THEN p.headliner_band_id ELSE p.support_band_id END,auth.uid()),false) THEN RAISE EXCEPTION 'proposal_forbidden' USING ERRCODE='42501'; END IF;
 IF p.status<>'pending' THEN IF p.status='changed' THEN PERFORM private.close_changed_support_proposal(p.id); END IF; RETURN p.status; END IF;
 IF p.expires_at<=now() THEN
  old_flag:=current_setting('app.support_proposal',true); PERFORM set_config('app.support_proposal','1',true);
  UPDATE public.support_tour_proposals SET status='expired',updated_at=now() WHERE id=p.id;
  UPDATE public.gig_support_slots SET status='expired',updated_at=now() WHERE id=ANY(p.slot_ids) AND status='pending';
  PERFORM set_config('app.support_proposal',COALESCE(old_flag,''),true); RETURN 'expired';
 END IF;
 IF (SELECT count(*) FROM public.gig_support_slots WHERE id=ANY(p.slot_ids) AND status='pending')<>cardinality(p.slot_ids) THEN PERFORM private.close_changed_support_proposal(p.id); RETURN 'changed'; END IF;
 old_flag:=current_setting('app.support_proposal',true); PERFORM set_config('app.support_proposal','1',true);
 old_response_id:=current_setting('app.support_proposal_response_id',true); PERFORM set_config('app.support_proposal_response_id',p.id::text,true);
 IF p_action='accept' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('support-band:'||p.support_band_id::text,0));
  PERFORM public.validate_support_route(p.support_band_id,ARRAY(SELECT (x->>'gig_id')::uuid FROM jsonb_array_elements(p.itinerary) x));
  PERFORM private.respond_to_tour_support_offers(p.itinerary,'accept');
 ELSIF p_action='decline' THEN PERFORM private.respond_to_tour_support_offers(p.itinerary,'decline');
 ELSE FOREACH slot IN ARRAY p.slot_ids LOOP PERFORM public.cancel_gig_support_offer(slot); END LOOP;
 END IF;
 PERFORM set_config('app.support_proposal',COALESCE(old_flag,''),true);
 PERFORM set_config('app.support_proposal_response_id',COALESCE(old_response_id,''),true);
 UPDATE public.support_tour_proposals SET status=CASE p_action WHEN 'accept' THEN 'accepted' WHEN 'decline' THEN 'declined' ELSE 'withdrawn' END,updated_at=now() WHERE id=p.id RETURNING * INTO p;
 RETURN p.status;
END; $$;
CREATE OR REPLACE FUNCTION public.list_support_tour_proposals(p_band_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false) THEN RAISE EXCEPTION 'proposal_forbidden' USING ERRCODE='42501'; END IF;
 RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC),'[]') FROM (
  SELECT p.*,(SELECT COALESCE(jsonb_object_agg(s.id::text,s.status),'{}') FROM public.gig_support_slots s WHERE s.id=ANY(p.slot_ids)) AS slot_statuses,h.name headliner_name,b.name support_name,t.name tour_name,
   CASE WHEN p.status='pending' AND p.expires_at<=now() THEN 'expired' ELSE p.status END display_status
  FROM public.support_tour_proposals p JOIN public.bands h ON h.id=p.headliner_band_id JOIN public.bands b ON b.id=p.support_band_id JOIN public.tours t ON t.id=p.tour_id
  WHERE p_band_id IN (p.headliner_band_id,p.support_band_id) ORDER BY p.created_at DESC LIMIT 100) r);
END; $$;

CREATE OR REPLACE FUNCTION public.expire_support_tour_proposals() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; n integer:=0; old_flag text;
BEGIN
 old_flag:=current_setting('app.support_proposal',true); PERFORM set_config('app.support_proposal','1',true);
 FOR r IN SELECT id,slot_ids FROM public.support_tour_proposals WHERE status='pending' AND expires_at<=now() ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT 100 LOOP
  UPDATE public.support_tour_proposals SET status='expired',updated_at=now() WHERE id=r.id;
  UPDATE public.gig_support_slots SET status='expired',updated_at=now() WHERE id=ANY(r.slot_ids) AND status='pending'; n:=n+1;
 END LOOP;
 PERFORM set_config('app.support_proposal',COALESCE(old_flag,''),true);
 RETURN n;
END; $$;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT id FROM public.support_tour_proposals WHERE status='changed' ORDER BY id LOOP PERFORM private.close_changed_support_proposal(r.id); END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.respond_to_gig_support_offer(uuid,text,text),public.respond_to_tour_support_offers(jsonb,text),public.respond_support_tour_proposal(uuid,text),public.list_support_tour_proposals(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_to_gig_support_offer(uuid,text,text),public.respond_to_tour_support_offers(jsonb,text),public.respond_support_tour_proposal(uuid,text),public.list_support_tour_proposals(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
