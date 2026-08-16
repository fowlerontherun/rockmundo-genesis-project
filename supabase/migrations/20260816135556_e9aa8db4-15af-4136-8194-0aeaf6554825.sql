CREATE TABLE IF NOT EXISTS public.social_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type text NOT NULL,
  host_player_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Social activity',
  description text,
  status text NOT NULL DEFAULT 'scheduled',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  city_id uuid,
  location_id uuid,
  band_id uuid,
  cost_payer text NOT NULL DEFAULT 'split',
  estimated_cost integer NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'participants_only',
  quality text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_activity_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.social_activities(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  response text NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  attended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, profile_id)
);

GRANT SELECT ON public.social_activities TO authenticated;
GRANT ALL ON public.social_activities TO service_role;
GRANT SELECT ON public.social_activity_participants TO authenticated;
GRANT ALL ON public.social_activity_participants TO service_role;

ALTER TABLE public.social_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_activity_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their social activities" ON public.social_activities;
CREATE POLICY "Participants can view their social activities"
  ON public.social_activities FOR SELECT TO authenticated
  USING (
    host_player_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.social_activity_participants sap
       JOIN public.profiles pr ON pr.id = sap.profile_id
       WHERE sap.activity_id = social_activities.id AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can view their social activity rows" ON public.social_activity_participants;
CREATE POLICY "Participants can view their social activity rows"
  ON public.social_activity_participants FOR SELECT TO authenticated
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.social_activities sa
       JOIN public.profiles pr ON pr.id = sa.host_player_id
       WHERE sa.id = social_activity_participants.activity_id AND pr.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS social_activities_host_idx ON public.social_activities(host_player_id, start_at DESC);
CREATE INDEX IF NOT EXISTS social_activity_participants_profile_idx ON public.social_activity_participants(profile_id, activity_id);

CREATE OR REPLACE FUNCTION public.create_social_activity(
  p_activity_type text,
  p_participant_ids uuid[],
  p_start_at timestamptz,
  p_duration_minutes integer,
  p_cost_payer text,
  p_city_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_band_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_visibility text DEFAULT 'participants_only'
)
RETURNS public.social_activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_host uuid := public._caller_profile_id();
  v_row public.social_activities;
  v_ids uuid[] := coalesce(p_participant_ids, ARRAY[]::uuid[]);
  v_target uuid;
BEGIN
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile to arrange activities.' USING ERRCODE='P0001';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 15 OR p_duration_minutes > 480 THEN
    RAISE EXCEPTION 'Choose a valid duration.' USING ERRCODE='P0001';
  END IF;
  IF p_start_at IS NULL OR p_start_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Choose a future date and time.' USING ERRCODE='P0001';
  END IF;
  IF array_length(v_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Invite at least one other player.' USING ERRCODE='P0001';
  END IF;
  IF array_length(v_ids, 1) > 15 THEN
    RAISE EXCEPTION 'Too many participants for this activity.' USING ERRCODE='P0001';
  END IF;

  FOREACH v_target IN ARRAY v_ids LOOP
    IF v_target = v_host THEN
      RAISE EXCEPTION 'You are already the host of this activity.' USING ERRCODE='P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_target AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'One of the invited players could not be found.' USING ERRCODE='P0001';
    END IF;
    IF public._social_blocked(v_host, v_target) THEN
      RAISE EXCEPTION 'One of the invited players is not available for invites.' USING ERRCODE='P0001';
    END IF;
  END LOOP;

  INSERT INTO public.social_activities (
    activity_type, host_player_id, title, description, status, start_at, end_at,
    duration_minutes, city_id, location_id, band_id, cost_payer, visibility
  ) VALUES (
    p_activity_type, v_host,
    coalesce(nullif(btrim(p_title), ''), initcap(replace(p_activity_type, '_', ' '))),
    p_note, 'scheduled', p_start_at, p_start_at + make_interval(mins => p_duration_minutes),
    p_duration_minutes, p_city_id, p_location_id, p_band_id,
    coalesce(p_cost_payer, 'split'), coalesce(p_visibility, 'participants_only')
  ) RETURNING * INTO v_row;

  INSERT INTO public.social_activity_participants (activity_id, profile_id, response, responded_at, attended)
  VALUES (v_row.id, v_host, 'accepted', now(), false);

  INSERT INTO public.social_activity_participants (activity_id, profile_id)
  SELECT v_row.id, unnest(v_ids)
  ON CONFLICT (activity_id, profile_id) DO NOTHING;

  RETURN v_row;
END $function$;

GRANT EXECUTE ON FUNCTION public.create_social_activity(text, uuid[], timestamptz, integer, text, uuid, uuid, uuid, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.respond_social_activity_invitation(p_activity_id uuid, p_response text)
RETURNS public.social_activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_row public.social_activities;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile.' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_row FROM public.social_activities WHERE id = p_activity_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'That activity could not be found.' USING ERRCODE='P0001';
  END IF;
  IF v_row.status NOT IN ('scheduled') THEN
    RAISE EXCEPTION 'This activity can no longer be updated.' USING ERRCODE='P0001';
  END IF;

  IF p_response = 'cancelled' THEN
    IF v_row.host_player_id IS DISTINCT FROM v_profile THEN
      RAISE EXCEPTION 'Only the host can cancel this activity.' USING ERRCODE='P0001';
    END IF;
    UPDATE public.social_activities SET status = 'cancelled', updated_at = now()
     WHERE id = p_activity_id RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Choose accept, decline or cancel.' USING ERRCODE='P0001';
  END IF;

  UPDATE public.social_activity_participants
     SET response = p_response, responded_at = now()
   WHERE activity_id = p_activity_id AND profile_id = v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You were not invited to this activity.' USING ERRCODE='P0001';
  END IF;

  RETURN v_row;
END $function$;

GRANT EXECUTE ON FUNCTION public.respond_social_activity_invitation(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_social_activity(p_activity_id uuid)
RETURNS public.social_activities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_row public.social_activities;
  v_attendees integer;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile.' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_row FROM public.social_activities WHERE id = p_activity_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'That activity could not be found.' USING ERRCODE='P0001';
  END IF;
  IF v_row.host_player_id IS DISTINCT FROM v_profile THEN
    RAISE EXCEPTION 'Only the host can complete this activity.' USING ERRCODE='P0001';
  END IF;
  IF v_row.status = 'completed' THEN
    RETURN v_row;
  END IF;
  IF v_row.status <> 'scheduled' THEN
    RAISE EXCEPTION 'This activity can no longer be completed.' USING ERRCODE='P0001';
  END IF;

  UPDATE public.social_activity_participants
     SET attended = (response = 'accepted')
   WHERE activity_id = p_activity_id;

  SELECT count(*) INTO v_attendees
    FROM public.social_activity_participants
   WHERE activity_id = p_activity_id AND attended;

  UPDATE public.profiles p
     SET mood = least(100, greatest(0, coalesce(p.mood, 50) + 4)),
         stress = least(100, greatest(0, coalesce(p.stress, 30) - 3)),
         energy = least(100, greatest(0, coalesce(p.energy, 100) - 5)),
         happiness = least(100, greatest(0, coalesce(p.happiness, 50) + 3)),
         updated_at = now()
   WHERE p.id IN (
     SELECT sap.profile_id FROM public.social_activity_participants sap
      WHERE sap.activity_id = p_activity_id AND sap.attended
   );

  UPDATE public.social_activities
     SET status = 'completed',
         completed_at = now(),
         quality = CASE WHEN v_attendees >= 4 THEN 'great' WHEN v_attendees >= 2 THEN 'enjoyable' ELSE 'uneventful' END,
         updated_at = now()
   WHERE id = p_activity_id
  RETURNING * INTO v_row;

  RETURN v_row;
END $function$;

GRANT EXECUTE ON FUNCTION public.complete_social_activity(uuid) TO authenticated, service_role;