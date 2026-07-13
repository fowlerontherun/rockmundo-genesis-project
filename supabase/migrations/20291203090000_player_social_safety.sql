-- Player blocking, reporting and social-safety foundation.

CREATE TABLE IF NOT EXISTS public.player_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason_category text,
  private_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  CONSTRAINT player_blocks_no_self_block CHECK (blocker_id <> blocked_id),
  CONSTRAINT player_blocks_reason_category_check CHECK (reason_category IS NULL OR reason_category IN ('unwanted_contact','harassment','spam','scam_attempt','inappropriate_content','threatening_behaviour','impersonation','other','prefer_not_to_say'))
);

CREATE UNIQUE INDEX IF NOT EXISTS player_blocks_one_active_direction_idx ON public.player_blocks(blocker_id, blocked_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS player_blocks_blocker_active_idx ON public.player_blocks(blocker_id, created_at DESC) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS player_blocks_blocked_active_idx ON public.player_blocks(blocked_id, created_at DESC) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS player_blocks_pair_active_idx ON public.player_blocks(LEAST(blocker_id, blocked_id), GREATEST(blocker_id, blocked_id)) WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.player_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_player_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  category text NOT NULL,
  subcategory text,
  description text NOT NULL,
  content_type text NOT NULL DEFAULT 'player_profile',
  content_id text,
  status text NOT NULL DEFAULT 'submitted',
  priority text NOT NULL DEFAULT 'normal',
  assigned_moderator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  resolution_summary text,
  duplicate_of_report_id uuid REFERENCES public.player_reports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_reports_no_self_report CHECK (reported_player_id IS NULL OR reporter_id <> reported_player_id),
  CONSTRAINT player_reports_category_check CHECK (category IN ('harassment_bullying','threats_intimidation','hate_discriminatory_abuse','sexual_inappropriate_content','spam','scam_fraud','impersonation','cheating_exploit_abuse','offensive_profile_content','inappropriate_name','personal_information','ban_evasion','other')),
  CONSTRAINT player_reports_status_check CHECK (status IN ('submitted','triage','under_review','awaiting_information','action_taken','no_action','duplicate','closed')),
  CONSTRAINT player_reports_priority_check CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT player_reports_description_length CHECK (char_length(description) BETWEEN 10 AND 2000)
);

CREATE INDEX IF NOT EXISTS player_reports_reporter_idx ON public.player_reports(reporter_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS player_reports_reported_idx ON public.player_reports(reported_player_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS player_reports_queue_idx ON public.player_reports(status, priority, submitted_at DESC);
CREATE INDEX IF NOT EXISTS player_reports_duplicate_lookup_idx ON public.player_reports(reporter_id, reported_player_id, category, content_type, COALESCE(content_id, ''), submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.player_report_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.player_reports(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  source_reference text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_report_evidence_report_idx ON public.player_report_evidence(report_id, created_at);

ALTER TABLE public.player_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_report_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read their own active blocks" ON public.player_blocks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = blocker_id AND p.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Players can create their own blocks" ON public.player_blocks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = blocker_id AND p.user_id = auth.uid()) AND blocker_id <> blocked_id);
CREATE POLICY "Players can soft delete their own blocks" ON public.player_blocks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = blocker_id AND p.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = blocker_id AND p.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Reporters can read limited own reports" ON public.player_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = reporter_id AND p.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Players can submit own reports" ON public.player_reports FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = reporter_id AND p.user_id = auth.uid()));
CREATE POLICY "Only moderators update player reports" ON public.player_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
CREATE POLICY "Report evidence restricted" ON public.player_report_evidence FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.player_reports r JOIN public.profiles p ON p.id = r.reporter_id WHERE r.id = report_id AND p.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
CREATE POLICY "Reporters can insert evidence via submission" ON public.player_report_evidence FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.player_reports r JOIN public.profiles p ON p.id = r.reporter_id WHERE r.id = report_id AND p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() AND COALESCE(is_active, true) IS TRUE AND died_at IS NULL ORDER BY created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_social_block_state(viewer_profile_id uuid, target_profile_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'viewer_blocked_target', EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = viewer_profile_id AND blocked_id = target_profile_id AND removed_at IS NULL),
    'viewer_is_blocked_by_target', EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = target_profile_id AND blocked_id = viewer_profile_id AND removed_at IS NULL),
    'mutual_block', EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = viewer_profile_id AND blocked_id = target_profile_id AND removed_at IS NULL) AND EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = target_profile_id AND blocked_id = viewer_profile_id AND removed_at IS NULL)
  )
$$;

CREATE OR REPLACE FUNCTION public.get_social_permissions(target_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer uuid := public.current_profile_id(); blocked boolean; viewer_blocked boolean;
BEGIN
  IF viewer IS NULL OR target_profile_id IS NULL OR viewer = target_profile_id THEN
    RETURN jsonb_build_object('can_view_profile', viewer = target_profile_id, 'can_send_friend_request', false, 'can_message', false, 'can_invite_to_band', false, 'can_invite_to_activity', false, 'can_offer_job', false, 'can_send_money', false, 'can_send_item', false, 'can_report', viewer IS NOT NULL AND viewer <> target_profile_id, 'is_blocked_by_viewer', false, 'is_interaction_restricted', viewer IS NULL);
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.player_blocks WHERE removed_at IS NULL AND blocker_id = viewer AND blocked_id = target_profile_id),
         EXISTS (SELECT 1 FROM public.player_blocks WHERE removed_at IS NULL AND blocker_id = target_profile_id AND blocked_id = viewer)
    INTO viewer_blocked, blocked;
  RETURN jsonb_build_object('can_view_profile', NOT blocked, 'can_send_friend_request', NOT (blocked OR viewer_blocked), 'can_message', NOT (blocked OR viewer_blocked), 'can_invite_to_band', NOT (blocked OR viewer_blocked), 'can_invite_to_activity', NOT (blocked OR viewer_blocked), 'can_offer_job', NOT (blocked OR viewer_blocked), 'can_send_money', NOT (blocked OR viewer_blocked), 'can_send_item', NOT (blocked OR viewer_blocked), 'can_report', true, 'is_blocked_by_viewer', viewer_blocked, 'is_interaction_restricted', (blocked OR viewer_blocked), 'neutral_message', CASE WHEN blocked THEN 'This player is unavailable.' ELSE NULL END);
END $$;

CREATE OR REPLACE FUNCTION public.block_player(target_profile_id uuid, reason_category text DEFAULT NULL, private_note text DEFAULT NULL)
RETURNS public.player_blocks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer uuid := public.current_profile_id(); row public.player_blocks;
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'Sign in with an active player profile.'; END IF;
  IF target_profile_id IS NULL OR viewer = target_profile_id THEN RAISE EXCEPTION 'You cannot block yourself.'; END IF;
  INSERT INTO public.player_blocks(blocker_id, blocked_id, reason_category, private_note)
  VALUES (viewer, target_profile_id, reason_category, NULLIF(left(COALESCE(private_note, ''), 500), ''))
  ON CONFLICT (blocker_id, blocked_id) WHERE removed_at IS NULL DO UPDATE SET updated_at = now(), reason_category = EXCLUDED.reason_category, private_note = EXCLUDED.private_note
  RETURNING * INTO row;
  UPDATE public.friendships SET status = CASE WHEN status = 'accepted' THEN 'removed'::public.friendship_status ELSE 'cancelled'::public.friendship_status END, responded_at = now(), updated_at = now()
    WHERE ((requestor_id = viewer AND addressee_id = target_profile_id) OR (requestor_id = target_profile_id AND addressee_id = viewer)) AND status IN ('pending','accepted');
  UPDATE public.notifications SET read_at = now() WHERE (user_id IN (SELECT user_id FROM public.profiles WHERE id IN (viewer, target_profile_id))) AND COALESCE(profile_id::text, metadata->>'profile_id', metadata->>'target_profile_id') IN (viewer::text, target_profile_id::text) AND read_at IS NULL;
  INSERT INTO public.admin_action_audit(actor_user_id, action, target_table, target_id, metadata) SELECT auth.uid(), 'player_blocked', 'player_blocks', row.id::text, jsonb_build_object('blocker_id', viewer, 'blocked_id', target_profile_id) WHERE to_regclass('public.admin_action_audit') IS NOT NULL;
  RETURN row;
END $$;

CREATE OR REPLACE FUNCTION public.unblock_player(target_profile_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer uuid := public.current_profile_id(); changed int;
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'Sign in with an active player profile.'; END IF;
  UPDATE public.player_blocks SET removed_at = now(), updated_at = now() WHERE blocker_id = viewer AND blocked_id = target_profile_id AND removed_at IS NULL;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed > 0;
END $$;

CREATE OR REPLACE FUNCTION public.submit_player_report(target_profile_id uuid, category text, description text, content_type text DEFAULT 'player_profile', content_id text DEFAULT NULL, subcategory text DEFAULT NULL, evidence jsonb DEFAULT '{}'::jsonb, block_after_report boolean DEFAULT false)
RETURNS public.player_reports LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer uuid := public.current_profile_id(); report_row public.player_reports; recent_count int; initial_priority text := 'normal';
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'Sign in with an active player profile.'; END IF;
  IF target_profile_id IS NULL OR target_profile_id = viewer THEN RAISE EXCEPTION 'Choose a valid player to report.'; END IF;
  IF char_length(trim(description)) < 10 OR char_length(description) > 2000 THEN RAISE EXCEPTION 'Reports need 10 to 2000 characters.'; END IF;
  SELECT count(*) INTO recent_count FROM public.player_reports WHERE reporter_id = viewer AND submitted_at > now() - interval '10 minutes';
  IF recent_count >= 5 THEN RAISE EXCEPTION 'Please wait before submitting another report.'; END IF;
  IF category IN ('threats_intimidation','personal_information','hate_discriminatory_abuse','ban_evasion','scam_fraud') THEN initial_priority := 'high'; END IF;
  INSERT INTO public.player_reports(reporter_id, reported_player_id, category, subcategory, description, content_type, content_id, priority)
  VALUES (viewer, target_profile_id, category, NULLIF(left(COALESCE(subcategory,''), 80), ''), trim(description), COALESCE(NULLIF(content_type,''), 'player_profile'), NULLIF(left(COALESCE(content_id,''), 120), ''), initial_priority)
  RETURNING * INTO report_row;
  INSERT INTO public.player_report_evidence(report_id, evidence_type, source_reference, snapshot, metadata)
  VALUES (report_row.id, COALESCE(NULLIF(content_type,''), 'player_profile'), content_id, COALESCE(evidence, '{}'::jsonb), jsonb_build_object('captured_at', now(), 'reporter_id', viewer, 'reported_player_id', target_profile_id));
  IF block_after_report THEN PERFORM public.block_player(target_profile_id, 'prefer_not_to_say', 'Blocked after submitting a report.'); END IF;
  RETURN report_row;
END $$;

CREATE OR REPLACE FUNCTION public.are_profiles_blocked(left_profile_id uuid, right_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.player_blocks WHERE removed_at IS NULL AND ((blocker_id = left_profile_id AND blocked_id = right_profile_id) OR (blocker_id = right_profile_id AND blocked_id = left_profile_id))) OR EXISTS (SELECT 1 FROM public.social_profile_blocks WHERE (blocker_profile_id = left_profile_id AND blocked_profile_id = right_profile_id) OR (blocker_profile_id = right_profile_id AND blocked_profile_id = left_profile_id))
$$;

CREATE OR REPLACE FUNCTION public.can_send_friend_request(sender_profile_id uuid, recipient_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sender_profile_id IS NOT NULL AND recipient_profile_id IS NOT NULL AND sender_profile_id <> recipient_profile_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = sender_profile_id)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = recipient_profile_id)
    AND NOT public.are_profiles_blocked(sender_profile_id, recipient_profile_id);
$$;

CREATE OR REPLACE FUNCTION public.get_connection_state(target_profile_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer uuid := public.current_profile_id(); f public.friendships; target_exists boolean; allow_mode text; viewer_blocked boolean; target_blocked boolean;
BEGIN
  IF viewer IS NULL OR target_profile_id IS NULL THEN RETURN 'unavailable'; END IF;
  IF viewer = target_profile_id THEN RETURN 'self'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_profile_id) INTO target_exists;
  IF NOT target_exists THEN RETURN 'unavailable'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = viewer AND blocked_id = target_profile_id AND removed_at IS NULL), EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = target_profile_id AND blocked_id = viewer AND removed_at IS NULL) INTO viewer_blocked, target_blocked;
  IF viewer_blocked THEN RETURN 'blocked_by_viewer'; END IF;
  IF target_blocked THEN RETURN 'viewer_blocked'; END IF;
  SELECT * INTO f FROM public.friendships WHERE (requestor_id = viewer AND addressee_id = target_profile_id) OR (requestor_id = target_profile_id AND addressee_id = viewer) LIMIT 1;
  IF f.status = 'accepted'::public.friendship_status THEN RETURN 'friends'; END IF;
  IF f.status = 'pending'::public.friendship_status AND f.requestor_id = viewer THEN RETURN 'outgoing_pending'; END IF;
  IF f.status = 'pending'::public.friendship_status AND f.addressee_id = viewer THEN RETURN 'incoming_pending'; END IF;
  IF f.status = 'blocked'::public.friendship_status THEN RETURN 'restricted'; END IF;
  SELECT COALESCE(fs.allow_friend_requests, 'everyone') INTO allow_mode FROM public.friendship_settings fs WHERE fs.profile_id = target_profile_id;
  IF allow_mode = 'none' THEN RETURN 'restricted'; END IF;
  RETURN 'not_connected';
END $$;

CREATE OR REPLACE FUNCTION public.search_player_discovery(viewer_profile_id uuid DEFAULT NULL, query jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_profile_id uuid; q text := NULLIF(BTRIM(COALESCE(query->>'search','')), ''); filters jsonb := COALESCE(query->'filters','{}'::jsonb); lim int := LEAST(GREATEST(COALESCE((query->>'pageSize')::int, 18),1),48); pg int := GREATEST(COALESCE((query->>'page')::int,1),1); off int; actor_city uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT id, current_city_id INTO actor_profile_id, actor_city FROM public.profiles WHERE user_id = auth.uid() AND (viewer_profile_id IS NULL OR id = viewer_profile_id) ORDER BY created_at LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile required' USING ERRCODE='42501'; END IF;
  off := (pg - 1) * lim;
  RETURN (WITH candidates AS (
    SELECT p.id, p.user_id, COALESCE(p.display_name,p.username) character_name, p.avatar_url,
      CASE WHEN COALESCE(pps.city_visibility,'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope THEN c.name ELSE NULL END city_name,
      CASE WHEN COALESCE(pps.city_visibility,'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope THEN p.current_city_id ELSE NULL END visible_city_id,
      COALESCE(b.name, NULL) current_band, pdp.primary_instrument, pdp.musical_roles, pdp.preferred_genres, COALESCE(p.fame,0) fame, COALESCE(pdp.career_level, 'Level ' || COALESCE(p.level,1)::text) career_level,
      pdp.availability, pdp.status_message, public.player_discovery_match_score(pdp, filters, actor_city, CASE WHEN COALESCE(pps.city_visibility,'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope THEN p.current_city_id ELSE NULL END) match
    FROM public.profiles p
    JOIN public.player_discovery_profiles pdp ON pdp.profile_id = p.id
    LEFT JOIN public.profile_privacy_settings pps ON pps.profile_id = p.id
    LEFT JOIN public.cities c ON c.id = p.current_city_id
    LEFT JOIN public.band_members bm ON bm.user_id = p.user_id
    LEFT JOIN public.bands b ON b.id = bm.band_id
    WHERE public.can_view_public_profile_summary(actor_profile_id, p.id)
      AND NOT public.are_profiles_blocked(actor_profile_id, p.id)
      AND (q IS NULL OR COALESCE(p.display_name,p.username,'') ILIKE '%'||q||'%' OR COALESCE(pdp.primary_instrument,'') ILIKE '%'||q||'%' OR EXISTS (SELECT 1 FROM unnest(pdp.preferred_genres || pdp.musical_roles || pdp.secondary_instruments) term WHERE term ILIKE '%'||q||'%') OR (COALESCE(pps.city_visibility,'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope AND c.name ILIKE '%'||q||'%') OR COALESCE(pdp.status_message,'') ILIKE '%'||q||'%')
      AND (filters->>'instrument' IS NULL OR lower(pdp.primary_instrument) = lower(filters->>'instrument') OR lower(filters->>'instrument') = ANY(SELECT lower(x) FROM unnest(pdp.secondary_instruments) x))
      AND (filters->>'genre' IS NULL OR lower(filters->>'genre') = ANY(SELECT lower(x) FROM unnest(pdp.preferred_genres) x))
      AND (filters->>'role' IS NULL OR lower(filters->>'role') = ANY(SELECT lower(x) FROM unnest(pdp.musical_roles) x))
      AND (filters->>'city' IS NULL OR (COALESCE(pps.city_visibility,'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope AND c.name ILIKE filters->>'city'))
      AND (filters->>'lookingForBand' IS NULL OR COALESCE((pdp.availability->>'lookingForBand')::boolean,false) = (filters->>'lookingForBand')::boolean)
      AND (filters->>'sessionAvailable' IS NULL OR COALESCE((pdp.availability->>'sessionAvailable')::boolean,false) = (filters->>'sessionAvailable')::boolean)
  ), sorted AS (SELECT * FROM candidates ORDER BY (match->>'percentage')::int DESC, character_name ASC OFFSET off LIMIT lim + 1)
  SELECT jsonb_build_object('results', COALESCE(jsonb_agg(jsonb_build_object('profile_id', id, 'user_id', user_id, 'character_name', character_name, 'avatar_url', avatar_url, 'city_name', city_name, 'activity_state', 'hidden', 'current_band', current_band, 'primary_instrument', primary_instrument, 'primary_role', musical_roles[1], 'preferred_genres', preferred_genres, 'fame', fame, 'career_level', career_level, 'availability', (SELECT COALESCE(jsonb_agg(key), '[]'::jsonb) FROM jsonb_each_text(availability) WHERE value = 'true'), 'status_message', status_message, 'badges', '[]'::jsonb, 'match', match)) FILTER (WHERE rn <= lim), '[]'::jsonb), 'has_more', COUNT(*) > lim, 'approximate_total', CASE WHEN COUNT(*) < 10 THEN NULL ELSE COUNT(*) END) FROM (SELECT *, row_number() over () AS rn FROM sorted) s);
END; $$;
