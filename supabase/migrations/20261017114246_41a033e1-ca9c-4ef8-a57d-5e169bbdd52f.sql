CREATE TABLE IF NOT EXISTS public.gig_audience_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  poll_type text NOT NULL CHECK (poll_type IN ('encore','crowd_energy')), question text NOT NULL, options jsonb NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')), opens_at timestamptz NOT NULL DEFAULT now(), closes_at timestamptz,
  winning_option text, vote_count integer NOT NULL DEFAULT 0, crowd_effect numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (gig_id, poll_type));
CREATE TABLE IF NOT EXISTS public.gig_audience_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), poll_id uuid NOT NULL REFERENCES public.gig_audience_polls(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.gig_audience_attendance(id) ON DELETE CASCADE, profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (poll_id, profile_id));
CREATE TABLE IF NOT EXISTS public.profile_pinned_badges (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3), pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, slot), UNIQUE (profile_id, achievement_id));

GRANT SELECT ON public.gig_audience_polls, public.gig_audience_poll_votes, public.profile_pinned_badges TO authenticated;
GRANT ALL ON public.gig_audience_polls, public.gig_audience_poll_votes, public.profile_pinned_badges TO service_role;
ALTER TABLE public.gig_audience_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_audience_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_pinned_badges ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_gig_polls(p_gig_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM gig_audience_attendance a JOIN profiles p ON p.id = a.profile_id WHERE a.gig_id = p_gig_id AND p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM gigs g JOIN band_members bm ON bm.band_id = g.band_id WHERE g.id = p_gig_id AND (bm.user_id = auth.uid() OR bm.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())));
$$;
REVOKE ALL ON FUNCTION public.can_view_gig_polls(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_gig_polls(uuid) TO authenticated, service_role;

CREATE POLICY "Attendees and band view gig polls" ON public.gig_audience_polls FOR SELECT TO authenticated USING (public.can_view_gig_polls(gig_id));
CREATE POLICY "Attendees and band view poll votes" ON public.gig_audience_poll_votes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.gig_audience_polls x WHERE x.id = poll_id AND public.can_view_gig_polls(x.gig_id)));
CREATE POLICY "Signed-in view pinned badges" ON public.profile_pinned_badges FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.ensure_gig_audience_polls(p_gig_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT public.can_view_gig_polls(p_gig_id) THEN RAISE EXCEPTION 'Check in to this gig first'; END IF;
  SELECT status INTO v_status FROM gigs WHERE id = p_gig_id;
  IF v_status IS DISTINCT FROM 'in_progress' THEN RETURN 0; END IF;
  INSERT INTO gig_audience_polls (gig_id, poll_type, question, options) VALUES
    (p_gig_id, 'encore', 'Should they play an encore?', '[{"key":"encore","label":"One more song!"},{"key":"done","label":"Great show, that''s enough"}]'),
    (p_gig_id, 'crowd_energy', 'What''s the crowd doing?', '[{"key":"singalong","label":"Singing along"},{"key":"mosh","label":"Mosh pit"},{"key":"dance","label":"Dancing"},{"key":"chill","label":"Just chilling"}]')
  ON CONFLICT (gig_id, poll_type) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

CREATE OR REPLACE FUNCTION public.submit_gig_audience_poll_vote(p_poll_id uuid, p_option_key text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_poll gig_audience_polls; v_att gig_audience_attendance;
BEGIN
  SELECT * INTO v_poll FROM gig_audience_polls WHERE id = p_poll_id;
  IF v_poll.id IS NULL OR v_poll.status <> 'open' THEN RAISE EXCEPTION 'This poll is closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_poll.options) o WHERE o->>'key' = p_option_key) THEN RAISE EXCEPTION 'Invalid option'; END IF;
  SELECT a.* INTO v_att FROM gig_audience_attendance a JOIN profiles p ON p.id = a.profile_id
   WHERE a.gig_id = v_poll.gig_id AND p.user_id = auth.uid() ORDER BY a.last_presence_at DESC NULLS LAST LIMIT 1;
  IF v_att.id IS NULL THEN RAISE EXCEPTION 'Check in to this gig to vote'; END IF;
  IF EXISTS (SELECT 1 FROM gigs g JOIN band_members bm ON bm.band_id = g.band_id WHERE g.id = v_poll.gig_id AND bm.profile_id = v_att.profile_id) THEN RAISE EXCEPTION 'Band members cannot vote on their own gig'; END IF;
  INSERT INTO gig_audience_poll_votes (poll_id, attendance_id, profile_id, option_key) VALUES (p_poll_id, v_att.id, v_att.profile_id, p_option_key)
  ON CONFLICT (poll_id, profile_id) DO UPDATE SET option_key = EXCLUDED.option_key, updated_at = now();
  RETURN p_option_key;
END $$;

-- Called by the gig completion job. Closes polls and returns the crowd rating modifier (-0.03 .. +0.08).
CREATE OR REPLACE FUNCTION public.settle_gig_audience_polls(p_gig_id uuid) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_total numeric := 0; v_votes int; v_win text; v_effect numeric; v_share numeric;
BEGIN
  FOR r IN SELECT * FROM gig_audience_polls WHERE gig_id = p_gig_id FOR UPDATE LOOP
    IF r.status = 'closed' THEN v_total := v_total + r.crowd_effect; CONTINUE; END IF;
    SELECT count(*) INTO v_votes FROM gig_audience_poll_votes WHERE poll_id = r.id;
    SELECT option_key INTO v_win FROM gig_audience_poll_votes WHERE poll_id = r.id GROUP BY option_key ORDER BY count(*) DESC, option_key LIMIT 1;
    v_effect := 0;
    IF v_votes > 0 THEN
      IF r.poll_type = 'crowd_energy' THEN
        v_effect := LEAST(0.06, 0.012 * ln(1 + v_votes));
        IF v_win = 'chill' THEN v_effect := v_effect - 0.03; END IF;
      ELSE
        SELECT count(*) FILTER (WHERE option_key = 'encore')::numeric / v_votes INTO v_share FROM gig_audience_poll_votes WHERE poll_id = r.id;
        v_effect := round(0.02 * v_share, 4);
      END IF;
    END IF;
    UPDATE gig_audience_polls SET status = 'closed', closes_at = now(), vote_count = v_votes, winning_option = v_win, crowd_effect = round(v_effect, 4) WHERE id = r.id;
    v_total := v_total + v_effect;
  END LOOP;
  RETURN GREATEST(-0.03, LEAST(0.08, v_total));
END $$;
REVOKE ALL ON FUNCTION public.settle_gig_audience_polls(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_gig_audience_polls(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.pin_achievement_badge(p_profile_id uuid, p_achievement_id uuid, p_slot int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not your character'; END IF;
  IF p_slot NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Pick slot 1 to 3'; END IF;
  IF p_achievement_id IS NULL THEN DELETE FROM profile_pinned_badges WHERE profile_id = p_profile_id AND slot = p_slot; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM player_achievements WHERE achievement_id = p_achievement_id AND unlocked_at IS NOT NULL AND (profile_id = p_profile_id OR (profile_id IS NULL AND user_id = auth.uid()))) THEN RAISE EXCEPTION 'Unlock this achievement first'; END IF;
  DELETE FROM profile_pinned_badges WHERE profile_id = p_profile_id AND (slot = p_slot OR achievement_id = p_achievement_id);
  INSERT INTO profile_pinned_badges (profile_id, achievement_id, slot) VALUES (p_profile_id, p_achievement_id, p_slot);
END $$;

REVOKE ALL ON FUNCTION public.ensure_gig_audience_polls(uuid), public.submit_gig_audience_poll_vote(uuid,text), public.pin_achievement_badge(uuid,uuid,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_gig_audience_polls(uuid), public.submit_gig_audience_poll_vote(uuid,text), public.pin_achievement_badge(uuid,uuid,int) TO authenticated, service_role;