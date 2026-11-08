-- Restore missing feature objects without replaying live economy migrations.
DO $repair$ BEGIN IF to_regclass('public.band_touring_shortlist') IS NULL THEN EXECUTE $install$
-- Private band shortlists and minimal labelmate discovery; booking eligibility remains authoritative.
CREATE TABLE public.band_touring_shortlist (
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  target_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (band_id, target_band_id),
  CHECK (band_id <> target_band_id)
);
CREATE INDEX band_touring_shortlist_target_idx ON public.band_touring_shortlist(target_band_id);
ALTER TABLE public.band_touring_shortlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_touring_shortlist FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.band_touring_shortlist TO authenticated;
GRANT ALL ON public.band_touring_shortlist TO service_role;
CREATE POLICY shortlist_read ON public.band_touring_shortlist FOR SELECT TO authenticated
  USING (public.can_manage_band_gigs(band_id, (SELECT auth.uid())));
CREATE POLICY shortlist_add ON public.band_touring_shortlist FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_band_gigs(band_id, (SELECT auth.uid())));
CREATE POLICY shortlist_remove ON public.band_touring_shortlist FOR DELETE TO authenticated
  USING (public.can_manage_band_gigs(band_id, (SELECT auth.uid())));

CREATE FUNCTION public.set_band_shortlisted(p_band_id uuid, p_target_band_id uuid, p_saved boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id, auth.uid()), false) THEN
    RAISE EXCEPTION 'band_discovery_forbidden' USING ERRCODE='42501';
  END IF;
  IF p_saved IS NULL THEN RAISE EXCEPTION 'shortlist_state_required' USING ERRCODE='22023'; END IF;
  IF p_saved THEN
    INSERT INTO public.band_touring_shortlist(band_id, target_band_id)
      VALUES (p_band_id, p_target_band_id) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.band_touring_shortlist WHERE band_id=p_band_id AND target_band_id=p_target_band_id;
  END IF;
END;
$$;

-- Definer access is needed to match active contracts without exposing contract finances.
CREATE FUNCTION public.get_band_discovery_context(p_band_id uuid)
RETURNS TABLE(band_id uuid, shortlisted boolean, labelmate boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id, auth.uid()), false) THEN
    RAISE EXCEPTION 'band_discovery_forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH labelmates AS (
    SELECT DISTINCT peer.band_id
    FROM public.artist_label_contracts own
    JOIN public.artist_label_contracts peer ON peer.label_id=own.label_id
    WHERE own.band_id=p_band_id AND peer.band_id<>p_band_id
      AND own.status='active' AND peer.status='active'
      AND (own.start_date IS NULL OR own.start_date<=current_date)
      AND (peer.start_date IS NULL OR peer.start_date<=current_date)
      AND (own.end_date IS NULL OR own.end_date>=current_date)
      AND (peer.end_date IS NULL OR peer.end_date>=current_date)
  ), saved AS (
    SELECT s.target_band_id AS band_id FROM public.band_touring_shortlist s WHERE s.band_id=p_band_id
  )
  SELECT COALESCE(s.band_id, l.band_id), s.band_id IS NOT NULL, l.band_id IS NOT NULL
  FROM saved s FULL JOIN labelmates l ON l.band_id=s.band_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_band_shortlisted(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_band_discovery_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_band_shortlisted(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_band_discovery_context(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

$install$; END IF; END; $repair$;
DO $repair$ BEGIN IF to_regclass('public.band_touring_friendships') IS NULL THEN EXECUTE $install$
-- Band-level consent, independent of player friendships and booking commitments.
CREATE TABLE public.band_touring_friendships (
  band_low uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  band_high uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  requested_by_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','accepted','declined','removed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (band_low,band_high),
  CHECK (band_low < band_high),
  CHECK (requested_by_band_id IN (band_low,band_high))
);
CREATE INDEX band_touring_friendships_high_idx ON public.band_touring_friendships(band_high);
ALTER TABLE public.band_touring_friendships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_touring_friendships FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.band_touring_friendships TO authenticated;
GRANT ALL ON public.band_touring_friendships TO service_role;
CREATE POLICY band_friendship_read ON public.band_touring_friendships FOR SELECT TO authenticated
USING (public.can_manage_band_gigs(band_low,(SELECT auth.uid())) OR public.can_manage_band_gigs(band_high,(SELECT auth.uid())));

CREATE FUNCTION public.change_band_friendship(p_band_id uuid,p_target_band_id uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_low uuid := LEAST(p_band_id,p_target_band_id);
  v_high uuid := GREATEST(p_band_id,p_target_band_id);
  v_row public.band_touring_friendships%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false) THEN
    RAISE EXCEPTION 'band_friendship_forbidden' USING ERRCODE='42501';
  END IF;
  IF p_band_id IS NULL OR p_target_band_id IS NULL OR p_band_id=p_target_band_id
     OR p_action IS NULL OR p_action NOT IN ('request','accept','decline','remove') THEN
    RAISE EXCEPTION 'band_friendship_invalid' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('band-friendship:'||v_low::text||':'||v_high::text,0));
  SELECT * INTO v_row FROM public.band_touring_friendships WHERE band_low=v_low AND band_high=v_high FOR UPDATE;
  IF p_action='request' THEN
    IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id=p_target_band_id AND status='active') THEN
      RAISE EXCEPTION 'band_friendship_target_unavailable' USING ERRCODE='23503';
    END IF;
    IF v_row.status IN ('pending','accepted') THEN RETURN; END IF;
    IF v_row.status='declined' AND v_row.updated_at>now()-interval '7 days' THEN
      RAISE EXCEPTION 'band_friendship_request_cooldown' USING ERRCODE='23514';
    END IF;
    INSERT INTO public.band_touring_friendships(band_low,band_high,requested_by_band_id,status)
      VALUES(v_low,v_high,p_band_id,'pending')
      ON CONFLICT (band_low,band_high) DO UPDATE SET requested_by_band_id=p_band_id,status='pending',updated_at=now();
  ELSIF p_action IN ('accept','decline') THEN
    IF v_row.requested_by_band_id IS NULL OR v_row.requested_by_band_id=p_band_id THEN
      RAISE EXCEPTION 'band_friendship_recipient_required' USING ERRCODE='42501';
    END IF;
    IF (p_action='accept' AND v_row.status='accepted') OR (p_action='decline' AND v_row.status='declined') THEN RETURN; END IF;
    IF v_row.status<>'pending' THEN RAISE EXCEPTION 'band_friendship_not_pending' USING ERRCODE='23514'; END IF;
    UPDATE public.band_touring_friendships SET status=CASE WHEN p_action='accept' THEN 'accepted' ELSE 'declined' END,updated_at=now()
      WHERE band_low=v_low AND band_high=v_high;
  ELSE
    IF v_row.status='removed' THEN RETURN; END IF;
    IF v_row.status IS NULL OR v_row.status NOT IN ('pending','accepted') THEN
      RAISE EXCEPTION 'band_friendship_not_active' USING ERRCODE='23514';
    END IF;
    IF v_row.status='pending' AND v_row.requested_by_band_id<>p_band_id THEN
      RAISE EXCEPTION 'band_friendship_sender_required' USING ERRCODE='42501';
    END IF;
    UPDATE public.band_touring_friendships SET status='removed',updated_at=now() WHERE band_low=v_low AND band_high=v_high;
  END IF;
END;
$$;

CREATE FUNCTION public.list_band_friendships(p_band_id uuid)
RETURNS TABLE(band_id uuid,band_name text,status text,incoming boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false) THEN
    RAISE EXCEPTION 'band_friendship_forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT b.id,b.name::text,f.status,f.requested_by_band_id<>p_band_id
    FROM public.band_touring_friendships f JOIN public.bands b
      ON b.id=CASE WHEN f.band_low=p_band_id THEN f.band_high ELSE f.band_low END
    WHERE p_band_id IN (f.band_low,f.band_high) AND f.status IN ('pending','accepted')
    ORDER BY f.status DESC,b.name,b.id;
END;
$$;
REVOKE ALL ON FUNCTION public.change_band_friendship(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_band_friendships(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.change_band_friendship(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_band_friendships(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

$install$; END IF; END; $repair$;
DO $repair$ BEGIN IF to_regclass('public.label_play_together_suggestions') IS NULL THEN EXECUTE $install$
-- Label recommendations collect interest; booking consent remains with the gig/tour RPCs.
CREATE TABLE public.label_play_together_suggestions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
 headliner_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
 support_band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
 note text NOT NULL DEFAULT '' CHECK (length(note)<=500),
 headliner_response text NOT NULL DEFAULT 'pending' CHECK (headliner_response IN ('pending','interested','declined')),
 support_response text NOT NULL DEFAULT 'pending' CHECK (support_response IN ('pending','interested','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (headliner_band_id<>support_band_id)
);
-- One recommendation per label/pair, including reversed roles. Retries never reset a response.
CREATE UNIQUE INDEX label_play_together_pair_idx ON public.label_play_together_suggestions
 (label_id,least(headliner_band_id,support_band_id),greatest(headliner_band_id,support_band_id));
CREATE INDEX label_play_together_headliner_idx ON public.label_play_together_suggestions(headliner_band_id);
CREATE INDEX label_play_together_support_idx ON public.label_play_together_suggestions(support_band_id);
ALTER TABLE public.label_play_together_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.label_play_together_suggestions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.label_play_together_suggestions TO authenticated;
GRANT ALL ON public.label_play_together_suggestions TO service_role;
CREATE POLICY suggestions_read ON public.label_play_together_suggestions FOR SELECT TO authenticated USING (
 public._can_manage_label(label_id) OR
 public.can_manage_band_gigs(headliner_band_id,(SELECT auth.uid())) OR
 public.can_manage_band_gigs(support_band_id,(SELECT auth.uid()))
);

-- Expose only band identity, never contract finances.
CREATE FUNCTION public.get_label_play_together_roster(p_label_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public._can_manage_label(p_label_id),false) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.name,b.id),'[]'::jsonb) INTO v_result FROM (
   SELECT DISTINCT b.id,b.name FROM public.artist_label_contracts c JOIN public.bands b ON b.id=c.band_id
   WHERE c.label_id=p_label_id AND c.status='active' AND b.status='active'
   AND (c.start_date IS NULL OR c.start_date<=current_date) AND (c.end_date IS NULL OR c.end_date>=current_date)
 ) b;
 RETURN v_result;
END; $$;

CREATE FUNCTION public.suggest_label_play_together(p_label_id uuid,p_headliner_band_id uuid,p_support_band_id uuid,p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public._can_manage_label(p_label_id),false) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 IF p_headliner_band_id IS NULL OR p_support_band_id IS NULL OR p_headliner_band_id=p_support_band_id OR length(COALESCE(p_note,''))>500 THEN
   RAISE EXCEPTION 'label_suggestion_invalid' USING ERRCODE='22023';
 END IF;
 IF (SELECT count(DISTINCT c.band_id) FROM public.artist_label_contracts c JOIN public.bands b ON b.id=c.band_id
     WHERE c.label_id=p_label_id AND c.band_id IN (p_headliner_band_id,p_support_band_id) AND c.status='active' AND b.status='active'
     AND (c.start_date IS NULL OR c.start_date<=current_date) AND (c.end_date IS NULL OR c.end_date>=current_date))<>2 THEN
   RAISE EXCEPTION 'label_suggestion_roster_changed' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.label_play_together_suggestions(label_id,headliner_band_id,support_band_id,note)
 VALUES(p_label_id,p_headliner_band_id,p_support_band_id,btrim(COALESCE(p_note,''))) ON CONFLICT DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN SELECT id INTO v_id FROM public.label_play_together_suggestions
   WHERE label_id=p_label_id AND least(headliner_band_id,support_band_id)=least(p_headliner_band_id,p_support_band_id)
   AND greatest(headliner_band_id,support_band_id)=greatest(p_headliner_band_id,p_support_band_id); END IF;
 RETURN v_id;
END; $$;

CREATE FUNCTION public.respond_to_label_play_together(p_suggestion_id uuid,p_band_id uuid,p_response text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row public.label_play_together_suggestions%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_row FROM public.label_play_together_suggestions WHERE id=p_suggestion_id FOR UPDATE;
 IF NOT FOUND OR p_band_id NOT IN (v_row.headliner_band_id,v_row.support_band_id) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 IF p_response IS NULL OR p_response NOT IN ('interested','declined') THEN
   RAISE EXCEPTION 'label_suggestion_invalid' USING ERRCODE='22023';
 END IF;
 IF p_response='interested' THEN
   IF (SELECT count(DISTINCT c.band_id) FROM public.artist_label_contracts c JOIN public.bands b ON b.id=c.band_id
       WHERE c.label_id=v_row.label_id AND c.band_id IN (v_row.headliner_band_id,v_row.support_band_id) AND c.status='active' AND b.status='active'
       AND (c.start_date IS NULL OR c.start_date<=current_date) AND (c.end_date IS NULL OR c.end_date>=current_date))<>2 THEN
     RAISE EXCEPTION 'label_suggestion_roster_changed' USING ERRCODE='23514';
   END IF;
   PERFORM public.set_band_shortlisted(p_band_id,CASE WHEN p_band_id=v_row.headliner_band_id THEN v_row.support_band_id ELSE v_row.headliner_band_id END,true);
 END IF;
 UPDATE public.label_play_together_suggestions SET
   headliner_response=CASE WHEN p_band_id=headliner_band_id THEN p_response ELSE headliner_response END,
   support_response=CASE WHEN p_band_id=support_band_id THEN p_response ELSE support_response END,updated_at=now()
 WHERE id=p_suggestion_id;
END; $$;

CREATE FUNCTION public.list_label_play_together(p_label_id uuid DEFAULT NULL,p_band_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR (p_label_id IS NULL)=(p_band_id IS NULL) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 IF (p_label_id IS NOT NULL AND NOT COALESCE(public._can_manage_label(p_label_id),false)) OR
    (p_band_id IS NOT NULL AND NOT COALESCE(public.can_manage_band_gigs(p_band_id,auth.uid()),false)) THEN
   RAISE EXCEPTION 'label_suggestion_forbidden' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.id),'[]'::jsonb) INTO v_result FROM (
   SELECT s.*,l.name AS label_name,h.name AS headliner_name,b.name AS support_name,
     (SELECT count(DISTINCT c.band_id)=2 FROM public.artist_label_contracts c JOIN public.bands a ON a.id=c.band_id
      WHERE c.label_id=s.label_id AND c.band_id IN (s.headliner_band_id,s.support_band_id) AND c.status='active' AND a.status='active'
      AND (c.start_date IS NULL OR c.start_date<=current_date) AND (c.end_date IS NULL OR c.end_date>=current_date)) AS roster_current
   FROM public.label_play_together_suggestions s JOIN public.labels l ON l.id=s.label_id
   JOIN public.bands h ON h.id=s.headliner_band_id JOIN public.bands b ON b.id=s.support_band_id
   WHERE (p_label_id IS NOT NULL AND s.label_id=p_label_id) OR (p_band_id IS NOT NULL AND p_band_id IN (s.headliner_band_id,s.support_band_id))
   ORDER BY s.created_at DESC,s.id LIMIT 100
 ) x;
 RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.get_label_play_together_roster(uuid),public.suggest_label_play_together(uuid,uuid,uuid,text),
 public.respond_to_label_play_together(uuid,uuid,text),public.list_label_play_together(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_label_play_together_roster(uuid),public.suggest_label_play_together(uuid,uuid,uuid,text),
 public.respond_to_label_play_together(uuid,uuid,text),public.list_label_play_together(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

$install$; END IF; END; $repair$;
-- Match the saved gig context for both invitation and acceptance.
-- Single-gig and touring opt-ins remain independent.

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
      v_gig.tour_id IS NOT NULL,
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

REVOKE ALL ON FUNCTION public.create_gig_support_offer(uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_gig_support_offer(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_gig_support_offer(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_gig_support_offer(uuid,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';

DO $repair$ BEGIN IF to_regprocedure('public.create_tour_support_offers(uuid,uuid,uuid,uuid[],uuid)') IS NULL THEN EXECUTE $install$
-- Batch wrappers keep existing per-show lifecycle, schedule and settlement authority.
CREATE FUNCTION public.create_tour_support_offers(
 p_headliner_band_id uuid,p_tour_id uuid,p_support_band_id uuid,p_gig_ids uuid[],p_request_id uuid
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_id uuid; v_gig public.gigs%ROWTYPE; v_slot public.gig_support_slots%ROWTYPE; v_request uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_headliner_band_id,auth.uid()),false) THEN
   RAISE EXCEPTION 'tour_support_forbidden' USING ERRCODE='42501';
 END IF;
 IF p_tour_id IS NULL OR p_support_band_id IS NULL OR p_request_id IS NULL OR
    COALESCE(cardinality(p_gig_ids),0) NOT BETWEEN 1 AND 100 OR
    EXISTS(SELECT 1 FROM unnest(p_gig_ids) x WHERE x IS NULL) OR
    (SELECT count(DISTINCT x) FROM unnest(p_gig_ids) x)<>cardinality(p_gig_ids) THEN
   RAISE EXCEPTION 'tour_support_dates_invalid' USING ERRCODE='22023';
 END IF;
 FOR v_id IN SELECT x FROM unnest(p_gig_ids) x ORDER BY x LOOP
   SELECT * INTO v_gig FROM public.gigs WHERE id=v_id FOR UPDATE;
   IF NOT FOUND OR v_gig.tour_id IS DISTINCT FROM p_tour_id OR v_gig.band_id IS DISTINCT FROM p_headliner_band_id THEN
     RAISE EXCEPTION 'tour_support_gig_mismatch' USING ERRCODE='23514';
   END IF;
   v_request := md5(p_request_id::text||':'||v_id::text)::uuid;
   SELECT * INTO v_slot FROM public.gig_support_slots WHERE request_id=v_request;
   IF FOUND THEN
     IF v_slot.gig_id<>v_id OR v_slot.support_band_id<>p_support_band_id THEN
       RAISE EXCEPTION 'tour_support_request_mismatch' USING ERRCODE='23514';
     END IF;
     CONTINUE;
   END IF;
   IF NOT EXISTS(SELECT 1 FROM public.find_tour_support_show_candidates(p_headliner_band_id,p_tour_id) c
     WHERE c.gig_id=v_id AND c.support_band_id=p_support_band_id AND c.travel_feasible) THEN
     RAISE EXCEPTION 'tour_support_band_unavailable' USING ERRCODE='23P01';
   END IF;
   PERFORM public.create_gig_support_offer(v_id,p_support_band_id,v_request);
 END LOOP;
 RETURN cardinality(p_gig_ids);
END;
$$;

CREATE FUNCTION public.respond_to_tour_support_offers(p_offers jsonb,p_action text)
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
   PERFORM public.respond_to_gig_support_offer((v_offer->>'slot_id')::uuid,p_action,NULL);
 END LOOP;
 RETURN jsonb_array_length(p_offers);
END;
$$;
REVOKE ALL ON FUNCTION public.create_tour_support_offers(uuid,uuid,uuid,uuid[],uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.respond_to_tour_support_offers(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_tour_support_offers(uuid,uuid,uuid,uuid[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_tour_support_offers(jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';

$install$; END IF; END; $repair$;
