-- Phase 8: Live Audience Participation and Social Viewing.
BEGIN;

CREATE TABLE IF NOT EXISTS public.gig_audience_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  live_session_id uuid REFERENCES public.gig_live_sessions(id) ON DELETE SET NULL,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_type text NOT NULL CHECK (attendance_type IN ('ticket_holder','invited_guest','vip_guest','band_friend','venue_staff','crew','support_act','festival_attendee','remote_viewer','admin_viewer')),
  ticket_id uuid,
  invitation_id uuid,
  status text NOT NULL DEFAULT 'eligible' CHECK (status IN ('eligible','checked_in','watching','left_early','completed','no_show','removed','cancelled')),
  checked_in_at timestamptz,
  left_at timestamptz,
  last_presence_at timestamptz,
  watch_duration_seconds integer NOT NULL DEFAULT 0 CHECK (watch_duration_seconds >= 0),
  participation_score integer NOT NULL DEFAULT 0 CHECK (participation_score BETWEEN 0 AND 100),
  reward_status text NOT NULL DEFAULT 'pending' CHECK (reward_status IN ('pending','not_eligible','processed','blocked')),
  rewarded_at timestamptz,
  privacy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  moderation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gig_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.gig_audience_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  live_session_id uuid NOT NULL REFERENCES public.gig_live_sessions(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.gig_audience_attendance(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES public.gig_live_segments(id) ON DELETE SET NULL,
  reaction_type text NOT NULL CHECK (reaction_type IN ('cheer','clap','sing_along','hands_up','dance','phone_wave','chant','encore_request','support_performer','highlight')),
  reaction_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.gig_audience_segment_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  live_session_id uuid NOT NULL REFERENCES public.gig_live_sessions(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES public.gig_live_segments(id) ON DELETE CASCADE,
  reaction_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  unique_participants integer NOT NULL DEFAULT 0 CHECK (unique_participants >= 0),
  participation_score integer NOT NULL DEFAULT 0 CHECK (participation_score BETWEEN 0 AND 100),
  participation_level text NOT NULL DEFAULT 'quiet' CHECK (participation_level IN ('quiet','engaged','lively','electric')),
  encore_demand integer NOT NULL DEFAULT 0 CHECK (encore_demand BETWEEN 0 AND 100),
  singalong_strength integer NOT NULL DEFAULT 0 CHECK (singalong_strength BETWEEN 0 AND 100),
  audience_modifier numeric NOT NULL DEFAULT 0 CHECK (audience_modifier BETWEEN -4 AND 4),
  finalised_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(live_session_id, segment_id)
);

CREATE TABLE IF NOT EXISTS public.gig_audience_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  live_session_id uuid REFERENCES public.gig_live_sessions(id) ON DELETE CASCADE,
  poll_type text NOT NULL CHECK (poll_type IN ('encore_song','standout_member','venue_atmosphere','show_highlight','favourite_song')),
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed','expired','cancelled')),
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gig_audience_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.gig_audience_polls(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.gig_audience_attendance(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, attendance_id)
);

CREATE TABLE IF NOT EXISTS public.gig_audience_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.gig_audience_attendance(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall_rating integer NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  sound_rating integer CHECK (sound_rating BETWEEN 1 AND 5),
  production_rating integer CHECK (production_rating BETWEEN 1 AND 5),
  venue_rating integer CHECK (venue_rating BETWEEN 1 AND 5),
  value_rating integer CHECK (value_rating BETWEEN 1 AND 5),
  favourite_song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  standout_member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attendance_id)
);

CREATE TABLE IF NOT EXISTS public.gig_audience_reward_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.gig_audience_attendance(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_type text NOT NULL DEFAULT 'fan_attendance',
  reward_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_gig_audience_attendance_player ON public.gig_audience_attendance(player_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_gig_audience_attendance_session ON public.gig_audience_attendance(live_session_id, status);
CREATE INDEX IF NOT EXISTS idx_gig_audience_reactions_segment ON public.gig_audience_reactions(live_session_id, segment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gig_audience_reactions_player ON public.gig_audience_reactions(player_id, gig_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gig_audience_polls_session ON public.gig_audience_polls(live_session_id, status, closes_at);
CREATE INDEX IF NOT EXISTS idx_gig_audience_ratings_gig ON public.gig_audience_ratings(gig_id, created_at DESC);

ALTER TABLE public.gig_audience_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_audience_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_audience_segment_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_audience_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_audience_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_audience_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_audience_reward_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY audience_attendance_select_own_or_band ON public.gig_audience_attendance FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = player_id AND p.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_id AND public.is_band_leader_or_manager(g.band_id, auth.uid())));
CREATE POLICY audience_attendance_insert_own_denied ON public.gig_audience_attendance FOR INSERT WITH CHECK (false);
CREATE POLICY audience_attendance_update_own_denied ON public.gig_audience_attendance FOR UPDATE USING (false);
CREATE POLICY audience_attendance_delete_denied ON public.gig_audience_attendance FOR DELETE USING (false);
CREATE POLICY audience_reactions_select_eligible ON public.gig_audience_reactions FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_audience_attendance a JOIN public.profiles p ON p.id = a.player_id WHERE a.gig_id = gig_audience_reactions.gig_id AND p.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_id AND public.is_band_leader_or_manager(g.band_id, auth.uid())));
CREATE POLICY audience_reactions_insert_denied ON public.gig_audience_reactions FOR INSERT WITH CHECK (false);
CREATE POLICY audience_reactions_update_denied ON public.gig_audience_reactions FOR UPDATE USING (false);
CREATE POLICY audience_reactions_delete_denied ON public.gig_audience_reactions FOR DELETE USING (false);
CREATE POLICY audience_aggregates_select_eligible ON public.gig_audience_segment_aggregates FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_audience_attendance a JOIN public.profiles p ON p.id = a.player_id WHERE a.gig_id = gig_audience_segment_aggregates.gig_id AND p.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_id AND public.is_band_leader_or_manager(g.band_id, auth.uid())));
CREATE POLICY audience_aggregates_write_denied ON public.gig_audience_segment_aggregates FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY audience_polls_select_eligible ON public.gig_audience_polls FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_audience_attendance a JOIN public.profiles p ON p.id = a.player_id WHERE a.gig_id = gig_audience_polls.gig_id AND p.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_id AND public.is_band_leader_or_manager(g.band_id, auth.uid())));
CREATE POLICY audience_polls_write_denied ON public.gig_audience_polls FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY audience_poll_votes_select_own_or_band ON public.gig_audience_poll_votes FOR SELECT USING (EXISTS (SELECT 1 FROM public.gig_audience_attendance a JOIN public.profiles p ON p.id = a.player_id WHERE a.id = attendance_id AND p.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.gig_audience_polls poll JOIN public.gigs g ON g.id = poll.gig_id WHERE poll.id = poll_id AND public.is_band_leader_or_manager(g.band_id, auth.uid())));
CREATE POLICY audience_poll_votes_write_denied ON public.gig_audience_poll_votes FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY audience_ratings_select_own_or_band ON public.gig_audience_ratings FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = player_id AND p.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_id AND public.is_band_leader_or_manager(g.band_id, auth.uid())));
CREATE POLICY audience_ratings_write_denied ON public.gig_audience_ratings FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY audience_rewards_select_own_or_band ON public.gig_audience_reward_records FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = player_id AND p.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_id AND public.is_band_leader_or_manager(g.band_id, auth.uid())));
CREATE POLICY audience_rewards_write_denied ON public.gig_audience_reward_records FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.current_profile_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT id FROM public.profiles WHERE user_id = auth.uid() ORDER BY created_at LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.check_in_gig_audience(p_gig_id uuid, p_ticket_id uuid DEFAULT NULL, p_attendance_type text DEFAULT 'ticket_holder') RETURNS public.gig_audience_attendance LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid; v_gig record; v_session uuid; v_count integer; v_row public.gig_audience_attendance;
BEGIN
  v_profile := public.current_profile_id(); IF v_profile IS NULL THEN RAISE EXCEPTION 'Profile required'; END IF;
  SELECT g.*, v.capacity, v.city_id AS venue_city_id INTO v_gig FROM public.gigs g LEFT JOIN public.venues v ON v.id = g.venue_id WHERE g.id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gig not found'; END IF;
  IF v_gig.status IN ('cancelled','completed','failed') THEN RAISE EXCEPTION 'Gig is not open for check-in'; END IF;
  IF p_attendance_type NOT IN ('ticket_holder','invited_guest','vip_guest','band_friend','venue_staff','crew','support_act','festival_attendee','remote_viewer','admin_viewer') THEN RAISE EXCEPTION 'Invalid attendance type'; END IF;
  IF p_attendance_type NOT IN ('remote_viewer','admin_viewer') AND v_gig.venue_city_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_profile AND p.current_city_id IS DISTINCT FROM v_gig.venue_city_id) THEN RAISE EXCEPTION 'Player is not in the gig city'; END IF;
  SELECT id INTO v_session FROM public.gig_live_sessions WHERE gig_id = p_gig_id ORDER BY created_at DESC LIMIT 1;
  SELECT count(*) INTO v_count FROM public.gig_audience_attendance WHERE gig_id = p_gig_id AND status IN ('checked_in','watching','completed') AND attendance_type NOT IN ('remote_viewer','admin_viewer');
  IF p_attendance_type NOT IN ('remote_viewer','admin_viewer') AND v_gig.capacity IS NOT NULL AND v_count >= LEAST(COALESCE(v_gig.tickets_sold, v_gig.capacity), v_gig.capacity) THEN RAISE EXCEPTION 'Venue capacity reached'; END IF;
  INSERT INTO public.gig_audience_attendance(gig_id, live_session_id, player_id, attendance_type, ticket_id, status, checked_in_at, last_presence_at, reward_status)
  VALUES (p_gig_id, v_session, v_profile, p_attendance_type, p_ticket_id, CASE WHEN p_attendance_type IN ('remote_viewer','admin_viewer') THEN 'watching' ELSE 'checked_in' END, now(), now(), CASE WHEN p_attendance_type IN ('remote_viewer','admin_viewer') THEN 'not_eligible' ELSE 'pending' END)
  ON CONFLICT (gig_id, player_id) DO UPDATE SET last_presence_at = now(), live_session_id = COALESCE(EXCLUDED.live_session_id, gig_audience_attendance.live_session_id), status = CASE WHEN gig_audience_attendance.status IN ('left_early','eligible') THEN EXCLUDED.status ELSE gig_audience_attendance.status END, updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.record_gig_audience_reaction(p_attendance_id uuid, p_reaction_type text, p_segment_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL) RETURNS public.gig_audience_segment_aggregates LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_att public.gig_audience_attendance; v_session public.gig_live_sessions; v_segment public.gig_live_segments; v_recent integer; v_count integer; v_agg public.gig_audience_segment_aggregates;
BEGIN
  SELECT * INTO v_att FROM public.gig_audience_attendance WHERE id = p_attendance_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Attendance not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_att.player_id AND p.user_id = auth.uid()) THEN RAISE EXCEPTION 'Not your attendance'; END IF;
  IF v_att.status IN ('removed','cancelled','no_show') OR v_att.attendance_type IN ('remote_viewer','admin_viewer') THEN RAISE EXCEPTION 'Attendance cannot react'; END IF;
  IF p_reaction_type NOT IN ('cheer','clap','sing_along','hands_up','dance','phone_wave','chant','encore_request','support_performer','highlight') THEN RAISE EXCEPTION 'Invalid reaction'; END IF;
  SELECT * INTO v_session FROM public.gig_live_sessions WHERE id = v_att.live_session_id;
  IF v_session.status NOT IN ('live','paused_for_decision') THEN RAISE EXCEPTION 'Gig is not live'; END IF;
  SELECT * INTO v_segment FROM public.gig_live_segments WHERE id = COALESCE(p_segment_id, (SELECT id FROM public.gig_live_segments WHERE session_id = v_session.id AND segment_index = v_session.current_segment_index LIMIT 1));
  IF NOT FOUND OR v_segment.status NOT IN ('active','resolved') THEN RAISE EXCEPTION 'No active reaction window'; END IF;
  SELECT count(*) INTO v_recent FROM public.gig_audience_reactions WHERE attendance_id = p_attendance_id AND created_at > now() - interval '4 seconds'; IF v_recent > 0 THEN RAISE EXCEPTION 'Reaction cooldown active'; END IF;
  SELECT count(*) INTO v_count FROM public.gig_audience_reactions WHERE attendance_id = p_attendance_id AND segment_id = v_segment.id; IF v_count >= 6 THEN RAISE EXCEPTION 'Song reaction limit reached'; END IF;
  SELECT count(*) INTO v_count FROM public.gig_audience_reactions WHERE attendance_id = p_attendance_id AND gig_id = v_att.gig_id; IF v_count >= 40 THEN RAISE EXCEPTION 'Gig reaction limit reached'; END IF;
  IF p_reaction_type = 'encore_request' AND EXISTS (SELECT 1 FROM public.gig_audience_reactions WHERE attendance_id = p_attendance_id AND reaction_type = 'encore_request') THEN RAISE EXCEPTION 'Encore request already counted'; END IF;
  INSERT INTO public.gig_audience_reactions(gig_id, live_session_id, attendance_id, player_id, segment_id, reaction_type, reaction_context, idempotency_key) VALUES (v_att.gig_id, v_session.id, v_att.id, v_att.player_id, v_segment.id, p_reaction_type, jsonb_build_object('segment_type', v_segment.segment_type), p_idempotency_key) ON CONFLICT (idempotency_key) DO NOTHING;
  INSERT INTO public.gig_audience_segment_aggregates(gig_id, live_session_id, segment_id, reaction_counts, unique_participants, participation_score, participation_level, encore_demand, singalong_strength, audience_modifier)
  SELECT v_att.gig_id, v_session.id, v_segment.id, jsonb_object_agg(reaction_type, reaction_count), count(DISTINCT player_id), LEAST(100, count(*)::integer * 3), CASE WHEN count(*) >= 30 THEN 'electric' WHEN count(*) >= 15 THEN 'lively' WHEN count(*) >= 5 THEN 'engaged' ELSE 'quiet' END, LEAST(100, count(*) FILTER (WHERE reaction_type='encore_request')::integer * 20), LEAST(100, count(*) FILTER (WHERE reaction_type='sing_along')::integer * 15), LEAST(4, count(DISTINCT player_id)::numeric * 0.75)
  FROM (SELECT reaction_type, player_id, count(*) over (partition by reaction_type) reaction_count FROM public.gig_audience_reactions WHERE live_session_id = v_session.id AND segment_id = v_segment.id) r GROUP BY true
  ON CONFLICT (live_session_id, segment_id) DO UPDATE SET reaction_counts = EXCLUDED.reaction_counts, unique_participants = EXCLUDED.unique_participants, participation_score = EXCLUDED.participation_score, participation_level = EXCLUDED.participation_level, encore_demand = EXCLUDED.encore_demand, singalong_strength = EXCLUDED.singalong_strength, audience_modifier = EXCLUDED.audience_modifier, updated_at = now()
  RETURNING * INTO v_agg;
  UPDATE public.gig_audience_attendance SET participation_score = LEAST(100, participation_score + 2), last_presence_at = now(), updated_at = now() WHERE id = v_att.id;
  RETURN v_agg;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_gig_audience_poll_vote(p_poll_id uuid, p_option_key text) RETURNS public.gig_audience_poll_votes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid := public.current_profile_id(); v_poll public.gig_audience_polls; v_att public.gig_audience_attendance; v_vote public.gig_audience_poll_votes;
BEGIN
  SELECT * INTO v_poll FROM public.gig_audience_polls WHERE id = p_poll_id; IF NOT FOUND OR v_poll.status <> 'open' OR now() NOT BETWEEN v_poll.opens_at AND v_poll.closes_at THEN RAISE EXCEPTION 'Poll is closed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_poll.options) opt WHERE opt->>'key' = p_option_key) THEN RAISE EXCEPTION 'Invalid poll option'; END IF;
  SELECT * INTO v_att FROM public.gig_audience_attendance WHERE gig_id = v_poll.gig_id AND player_id = v_profile AND status IN ('checked_in','watching','completed') AND attendance_type NOT IN ('remote_viewer','admin_viewer'); IF NOT FOUND THEN RAISE EXCEPTION 'Valid attendance required'; END IF;
  INSERT INTO public.gig_audience_poll_votes(poll_id, attendance_id, player_id, option_key) VALUES (p_poll_id, v_att.id, v_profile, p_option_key) ON CONFLICT (poll_id, attendance_id) DO UPDATE SET option_key = EXCLUDED.option_key RETURNING * INTO v_vote; RETURN v_vote;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_gig_audience_rating(p_attendance_id uuid, p_overall integer, p_sound integer DEFAULT NULL, p_production integer DEFAULT NULL, p_venue integer DEFAULT NULL, p_value integer DEFAULT NULL, p_favourite_song_id uuid DEFAULT NULL, p_standout_member_id uuid DEFAULT NULL) RETURNS public.gig_audience_ratings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_att public.gig_audience_attendance; v_rating public.gig_audience_ratings;
BEGIN
  SELECT * INTO v_att FROM public.gig_audience_attendance WHERE id = p_attendance_id AND player_id = public.current_profile_id(); IF NOT FOUND OR v_att.status <> 'completed' THEN RAISE EXCEPTION 'Completed attendance required'; END IF;
  IF v_att.attendance_type IN ('remote_viewer','admin_viewer') THEN RAISE EXCEPTION 'Remote viewers cannot rate attendance'; END IF;
  INSERT INTO public.gig_audience_ratings(gig_id, attendance_id, player_id, overall_rating, sound_rating, production_rating, venue_rating, value_rating, favourite_song_id, standout_member_id) VALUES (v_att.gig_id, v_att.id, v_att.player_id, p_overall, p_sound, p_production, p_venue, p_value, p_favourite_song_id, p_standout_member_id) ON CONFLICT (attendance_id) DO UPDATE SET overall_rating = EXCLUDED.overall_rating, sound_rating = EXCLUDED.sound_rating, production_rating = EXCLUDED.production_rating, venue_rating = EXCLUDED.venue_rating, value_rating = EXCLUDED.value_rating, favourite_song_id = EXCLUDED.favourite_song_id, standout_member_id = EXCLUDED.standout_member_id, updated_at = now() RETURNING * INTO v_rating; RETURN v_rating;
END; $$;

CREATE OR REPLACE FUNCTION public.process_gig_audience_rewards(p_gig_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.gig_audience_reward_records(gig_id, attendance_id, player_id, reward_type, reward_snapshot, idempotency_key)
  SELECT gig_id, id, player_id, 'fan_attendance', jsonb_build_object('fan_xp', LEAST(30, 8 + participation_score / 4), 'social_xp', LEAST(10, 2 + participation_score / 12), 'participation_score', participation_score), gig_id::text || ':audience:' || id::text
  FROM public.gig_audience_attendance WHERE gig_id = p_gig_id AND status = 'completed' AND attendance_type NOT IN ('remote_viewer','admin_viewer') AND reward_status = 'pending'
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.gig_audience_attendance SET reward_status = 'processed', rewarded_at = now(), updated_at = now() WHERE gig_id = p_gig_id AND status = 'completed' AND reward_status = 'pending' AND attendance_type NOT IN ('remote_viewer','admin_viewer');
  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.check_in_gig_audience(uuid,uuid,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.check_in_gig_audience(uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.record_gig_audience_reaction(uuid,text,uuid,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.record_gig_audience_reaction(uuid,text,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_gig_audience_poll_vote(uuid,text) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.submit_gig_audience_poll_vote(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_gig_audience_rating(uuid,integer,integer,integer,integer,integer,uuid,uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.submit_gig_audience_rating(uuid,integer,integer,integer,integer,integer,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.process_gig_audience_rewards(uuid) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.process_gig_audience_rewards(uuid) TO service_role;

COMMIT;
