-- Festival C7: attendee social/random moments with bounded, idempotent outcomes.
-- Builds on canonical Festival attendance, C5 planner, C6 condition simulation,
-- and the existing player social-safety block helper.

CREATE TABLE public.festival_attendee_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.festival_player_attendance(id) ON DELETE CASCADE,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  related_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  moment_key text NOT NULL,
  category text NOT NULL CHECK (category IN ('band_encounter','social','inspiration','vendor','camping','nightlife')),
  title text NOT NULL,
  body text NOT NULL,
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array'),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','choice_made','resolved','expired')),
  chosen_option text,
  outcome jsonb,
  available_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  outcome_due_at timestamptz,
  resolved_at timestamptz,
  idempotency_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT festival_attendee_moments_related_not_self CHECK (related_profile_id IS NULL OR related_profile_id <> profile_id)
);

CREATE INDEX festival_attendee_moments_attendance_idx
  ON public.festival_attendee_moments(attendance_id, created_at DESC);
CREATE INDEX festival_attendee_moments_profile_idx
  ON public.festival_attendee_moments(profile_id, created_at DESC);
CREATE INDEX festival_attendee_moments_pending_idx
  ON public.festival_attendee_moments(attendance_id, status, expires_at)
  WHERE status IN ('pending','choice_made');

ALTER TABLE public.festival_attendee_moments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.festival_attendee_moments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.festival_attendee_moments TO service_role;

CREATE OR REPLACE FUNCTION public._festival_moment_context(p_attendance_id uuid)
RETURNS TABLE (
  attendance public.festival_player_attendance,
  profile_id uuid,
  festival_local_hour integer,
  has_camping boolean,
  has_vip boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_profile_id uuid := public.current_profile_id();
  v_ticket jsonb;
  v_timezone text := 'UTC';
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.* INTO v_attendance
  FROM public.festival_player_attendance a
  WHERE a.id = p_attendance_id
    AND a.profile_id = v_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_attendance_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_attendance.status <> 'attending' THEN
    RAISE EXCEPTION 'festival_not_attending' USING ERRCODE = 'P0001';
  END IF;

  SELECT to_jsonb(t) INTO v_ticket
  FROM public.festival_issued_tickets t
  WHERE t.id = v_attendance.ticket_id;

  SELECT coalesce(c.timezone, 'UTC') INTO v_timezone
  FROM public.festival_editions_v2 e
  LEFT JOIN public.cities c ON c.id = e.city_id
  WHERE e.id = v_attendance.festival_edition_id;

  RETURN QUERY SELECT
    v_attendance,
    v_profile_id,
    extract(hour FROM (now() AT TIME ZONE v_timezone))::integer,
    coalesce((v_ticket->>'includes_camping')::boolean, false),
    coalesce((v_ticket->>'includes_vip_area')::boolean, false);
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_moment_context(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_moment_context(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._festival_moment_options(p_moment_key text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE p_moment_key
    WHEN 'crowd_songwriting_spark' THEN jsonb_build_array(
      jsonb_build_object('id','capture_idea','label','Capture the idea','description','Step aside and save the spark while it is fresh.','delayMinutes',0),
      jsonb_build_object('id','stay_present','label','Stay in the moment','description','Keep watching and enjoy the set.','delayMinutes',0)
    )
    WHEN 'campfire_story' THEN jsonb_build_array(
      jsonb_build_object('id','join_in','label','Join the campfire','description','Share stories with nearby festival-goers.','delayMinutes',0),
      jsonb_build_object('id','early_night','label','Get an early night','description','Protect tomorrow’s energy.','delayMinutes',0)
    )
    WHEN 'vendor_discovery' THEN jsonb_build_array(
      jsonb_build_object('id','chat_vendor','label','Chat with the vendor','description','Ask about the story behind the stall.','delayMinutes',0),
      jsonb_build_object('id','keep_moving','label','Keep moving','description','Save your time for the next activity.','delayMinutes',0)
    )
    WHEN 'afterparty_invite' THEN jsonb_build_array(
      jsonb_build_object('id','go_afterparty','label','Go to the afterparty','description','Stay out late and see where the night goes.','delayMinutes',30),
      jsonb_build_object('id','head_back','label','Head back','description','Call it a night while you still feel good.','delayMinutes',0)
    )
    WHEN 'fellow_fan_encounter' THEN jsonb_build_array(
      jsonb_build_object('id','say_hello','label','Say hello','description','Have a friendly chat. You can decide separately whether to connect afterwards.','delayMinutes',0),
      jsonb_build_object('id','give_space','label','Give them space','description','Enjoy the shared moment without starting a conversation.','delayMinutes',0)
    )
    WHEN 'artist_crossing' THEN jsonb_build_array(
      jsonb_build_object('id','quick_chat','label','Have a quick chat','description','Keep it respectful and brief.','delayMinutes',0),
      jsonb_build_object('id','nod_and_move','label','Nod and move on','description','Let them enjoy the festival too.','delayMinutes',0)
    )
    ELSE '[]'::jsonb
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_festival_moments(p_attendance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context record;
  v_items jsonb;
BEGIN
  SELECT * INTO v_context FROM public._festival_moment_context(p_attendance_id);

  UPDATE public.festival_attendee_moments
  SET status = 'expired', updated_at = now()
  WHERE attendance_id = p_attendance_id
    AND status = 'pending'
    AND expires_at <= now();

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'category', m.category,
    'title', m.title,
    'body', m.body,
    'options', m.options,
    'status', m.status,
    'chosenOption', m.chosen_option,
    'outcome', m.outcome,
    'relatedProfileId', m.related_profile_id,
    'availableAt', m.available_at,
    'expiresAt', m.expires_at,
    'outcomeDueAt', m.outcome_due_at,
    'resolvedAt', m.resolved_at,
    'context', m.context
  ) ORDER BY m.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM public.festival_attendee_moments m
  WHERE m.attendance_id = p_attendance_id
    AND m.profile_id = v_context.profile_id
    AND m.created_at >= now() - interval '3 days';

  RETURN jsonb_build_object(
    'attendanceId', p_attendance_id,
    'festivalEditionId', (v_context.attendance).festival_edition_id,
    'items', v_items,
    'serverNow', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_moments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_moments(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trigger_my_festival_moment(
  p_attendance_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context record;
  v_existing public.festival_attendee_moments%ROWTYPE;
  v_recent_count integer;
  v_last_created timestamptz;
  v_recent_activity text;
  v_key text;
  v_category text;
  v_title text;
  v_body text;
  v_related uuid;
  v_related_name text;
  v_row public.festival_attendee_moments%ROWTYPE;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'festival_moment_idempotency_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_context FROM public._festival_moment_context(p_attendance_id);
  PERFORM pg_advisory_xact_lock(hashtextextended('festival-moment:' || p_attendance_id::text, 0));

  SELECT * INTO v_existing
  FROM public.festival_attendee_moments
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.attendance_id <> p_attendance_id THEN
      RAISE EXCEPTION 'festival_moment_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'status', v_existing.status, 'duplicate', true);
  END IF;

  SELECT count(*), max(created_at) INTO v_recent_count, v_last_created
  FROM public.festival_attendee_moments
  WHERE attendance_id = p_attendance_id
    AND created_at >= date_trunc('day', now())
    AND status <> 'expired';

  IF v_recent_count >= 6 THEN
    RAISE EXCEPTION 'festival_moment_daily_limit' USING ERRCODE = 'P0001';
  END IF;
  IF v_last_created IS NOT NULL AND v_last_created > now() - interval '90 minutes' THEN
    RAISE EXCEPTION 'festival_moment_cooldown' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.festival_attendee_moments
    WHERE attendance_id = p_attendance_id AND status IN ('pending','choice_made')
  ) THEN
    RAISE EXCEPTION 'festival_moment_pending' USING ERRCODE = 'P0001';
  END IF;

  SELECT item.activity_type INTO v_recent_activity
  FROM public.festival_attendee_plan_items item
  WHERE item.attendance_id = p_attendance_id
    AND item.status = 'completed'
    AND item.resolved_at >= now() - interval '3 hours'
  ORDER BY item.resolved_at DESC
  LIMIT 1;

  -- Prefer context-appropriate moments; social encounters are used only when an
  -- eligible, unblocked checked-in attendee exists.
  IF v_recent_activity = 'watch_act' THEN
    v_key := 'crowd_songwriting_spark'; v_category := 'inspiration';
    v_title := 'A melody cuts through the crowd';
    v_body := 'Something in the performance gives you the start of a new musical idea.';
  ELSIF v_recent_activity = 'vendor' THEN
    v_key := 'vendor_discovery'; v_category := 'vendor';
    v_title := 'A stall catches your attention';
    v_body := 'The person running it has a story that sounds more interesting than another quick purchase.';
  ELSIF v_context.has_camping AND (v_context.festival_local_hour >= 20 OR v_context.festival_local_hour <= 2) THEN
    v_key := 'campfire_story'; v_category := 'camping';
    v_title := 'Stories around the campsite';
    v_body := 'A nearby group has settled around a small campfire and the conversation is easy-going.';
  ELSIF v_context.festival_local_hour >= 22 OR v_context.festival_local_hour <= 2 THEN
    v_key := 'afterparty_invite'; v_category := 'nightlife';
    v_title := 'An afterparty invitation';
    v_body := 'Word spreads about a late gathering elsewhere on the festival site.';
  ELSE
    SELECT other.profile_id, coalesce(nullif(other_profile.display_name,''), nullif(other_profile.name,''), 'another festival-goer')
      INTO v_related, v_related_name
    FROM public.festival_player_attendance other
    JOIN public.profiles other_profile ON other_profile.id = other.profile_id
    WHERE other.festival_edition_id = (v_context.attendance).festival_edition_id
      AND other.status = 'attending'
      AND other.profile_id <> v_context.profile_id
      AND NOT public.are_profiles_blocked(v_context.profile_id, other.profile_id)
    ORDER BY random()
    LIMIT 1;

    IF v_related IS NOT NULL THEN
      v_key := 'fellow_fan_encounter'; v_category := 'social';
      v_title := 'You recognise another festival-goer';
      v_body := coalesce(v_related_name, 'Another festival-goer') || ' seems to be enjoying the same part of the festival.';
    ELSE
      v_key := 'artist_crossing'; v_category := 'band_encounter';
      v_title := 'A musician passes through the crowd';
      v_body := 'You spot a performer moving between areas without an entourage or announcement.';
    END IF;
  END IF;

  INSERT INTO public.festival_attendee_moments (
    attendance_id, festival_edition_id, profile_id, related_profile_id,
    moment_key, category, title, body, options, context,
    expires_at, idempotency_key
  ) VALUES (
    p_attendance_id, (v_context.attendance).festival_edition_id, v_context.profile_id, v_related,
    v_key, v_category, v_title, v_body, public._festival_moment_options(v_key),
    jsonb_build_object('recentActivity', v_recent_activity, 'localHour', v_context.festival_local_hour),
    now() + interval '2 hours', p_idempotency_key
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'duplicate', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.trigger_my_festival_moment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trigger_my_festival_moment(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._festival_apply_moment_outcome(p_moment_id uuid)
RETURNS public.festival_attendee_moments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_moment public.festival_attendee_moments%ROWTYPE;
  v_effect jsonb := '{}'::jsonb;
  v_energy integer := 0;
  v_hunger integer := 0;
  v_hydration integer := 0;
  v_mood integer := 0;
  v_comfort integer := 0;
  v_inspiration integer := 0;
  v_social integer := 0;
BEGIN
  SELECT * INTO v_moment
  FROM public.festival_attendee_moments
  WHERE id = p_moment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_moment_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_moment.status = 'resolved' THEN RETURN v_moment; END IF;
  IF v_moment.status <> 'choice_made' THEN
    RAISE EXCEPTION 'festival_moment_choice_required' USING ERRCODE = 'P0001';
  END IF;
  IF v_moment.outcome_due_at IS NOT NULL AND now() < v_moment.outcome_due_at THEN
    RAISE EXCEPTION 'festival_moment_outcome_not_ready' USING ERRCODE = 'P0001';
  END IF;

  CASE v_moment.moment_key || ':' || v_moment.chosen_option
    WHEN 'crowd_songwriting_spark:capture_idea' THEN v_inspiration := 12; v_mood := 3;
    WHEN 'crowd_songwriting_spark:stay_present' THEN v_inspiration := 5; v_mood := 6;
    WHEN 'campfire_story:join_in' THEN v_social := 8; v_mood := 5; v_energy := -2;
    WHEN 'campfire_story:early_night' THEN v_energy := 7; v_comfort := 5;
    WHEN 'vendor_discovery:chat_vendor' THEN v_inspiration := 4; v_social := 3; v_mood := 2;
    WHEN 'vendor_discovery:keep_moving' THEN v_energy := 1;
    WHEN 'afterparty_invite:go_afterparty' THEN v_social := 10; v_mood := 7; v_energy := -10; v_hydration := -7; v_comfort := -4;
    WHEN 'afterparty_invite:head_back' THEN v_energy := 5; v_comfort := 4;
    WHEN 'fellow_fan_encounter:say_hello' THEN v_social := 7; v_mood := 4;
    WHEN 'fellow_fan_encounter:give_space' THEN v_mood := 1;
    WHEN 'artist_crossing:quick_chat' THEN v_inspiration := 6; v_social := 3; v_mood := 3;
    WHEN 'artist_crossing:nod_and_move' THEN v_mood := 1;
    ELSE RAISE EXCEPTION 'festival_moment_option_invalid' USING ERRCODE = 'P0001';
  END CASE;

  PERFORM public._festival_evolve_attendee_conditions(v_moment.attendance_id, now());

  UPDATE public.festival_attendee_conditions c
  SET energy = least(100, greatest(0, c.energy + v_energy)),
      hunger = least(100, greatest(0, c.hunger + v_hunger)),
      hydration = least(100, greatest(0, c.hydration + v_hydration)),
      mood = least(100, greatest(0, c.mood + v_mood)),
      comfort = least(100, greatest(0, c.comfort + v_comfort)),
      inspiration = least(100, greatest(0, c.inspiration + v_inspiration)),
      social = least(100, greatest(0, c.social + v_social)),
      last_activity_at = now(),
      updated_at = now()
  WHERE c.attendance_id = v_moment.attendance_id;

  v_effect := jsonb_build_object(
    'energy', v_energy, 'hunger', v_hunger, 'hydration', v_hydration,
    'mood', v_mood, 'comfort', v_comfort, 'inspiration', v_inspiration, 'social', v_social
  );

  UPDATE public.festival_attendee_moments
  SET status = 'resolved', outcome = jsonb_build_object('conditionEffect', v_effect),
      resolved_at = now(), updated_at = now()
  WHERE id = v_moment.id
  RETURNING * INTO v_moment;

  RETURN v_moment;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_apply_moment_outcome(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_apply_moment_outcome(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.choose_festival_moment_option(
  p_moment_id uuid,
  p_option_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_moment public.festival_attendee_moments%ROWTYPE;
  v_option jsonb;
  v_delay integer := 0;
BEGIN
  SELECT * INTO v_moment
  FROM public.festival_attendee_moments
  WHERE id = p_moment_id AND profile_id = v_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'festival_moment_not_found' USING ERRCODE = 'P0001'; END IF;
  IF v_moment.status = 'resolved' THEN
    RETURN jsonb_build_object('id', v_moment.id, 'status', v_moment.status, 'outcomeDueAt', v_moment.outcome_due_at, 'outcome', v_moment.outcome, 'duplicate', true);
  END IF;
  IF v_moment.status = 'choice_made' THEN
    IF v_moment.chosen_option <> p_option_id THEN
      RAISE EXCEPTION 'festival_moment_choice_locked' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('id', v_moment.id, 'status', v_moment.status, 'outcomeDueAt', v_moment.outcome_due_at, 'outcome', v_moment.outcome, 'duplicate', true);
  END IF;
  IF v_moment.status <> 'pending' OR v_moment.expires_at <= now() THEN
    UPDATE public.festival_attendee_moments SET status = 'expired', updated_at = now() WHERE id = v_moment.id AND status = 'pending';
    RAISE EXCEPTION 'festival_moment_expired' USING ERRCODE = 'P0001';
  END IF;

  SELECT option_item INTO v_option
  FROM jsonb_array_elements(v_moment.options) option_item
  WHERE option_item->>'id' = p_option_id
  LIMIT 1;
  IF v_option IS NULL THEN RAISE EXCEPTION 'festival_moment_option_invalid' USING ERRCODE = 'P0001'; END IF;

  v_delay := coalesce((v_option->>'delayMinutes')::integer, 0);
  UPDATE public.festival_attendee_moments
  SET status = 'choice_made', chosen_option = p_option_id,
      outcome_due_at = now() + make_interval(mins => v_delay), updated_at = now()
  WHERE id = v_moment.id
  RETURNING * INTO v_moment;

  IF v_delay = 0 THEN
    v_moment := public._festival_apply_moment_outcome(v_moment.id);
  END IF;

  RETURN jsonb_build_object('id', v_moment.id, 'status', v_moment.status, 'outcomeDueAt', v_moment.outcome_due_at, 'outcome', v_moment.outcome, 'duplicate', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.choose_festival_moment_option(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_festival_moment_option(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_festival_moment_outcome(p_moment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_moment public.festival_attendee_moments%ROWTYPE;
BEGIN
  SELECT * INTO v_moment
  FROM public.festival_attendee_moments
  WHERE id = p_moment_id AND profile_id = v_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_moment_not_found' USING ERRCODE = 'P0001'; END IF;

  v_moment := public._festival_apply_moment_outcome(v_moment.id);
  RETURN jsonb_build_object('id', v_moment.id, 'status', v_moment.status, 'outcomeDueAt', v_moment.outcome_due_at, 'outcome', v_moment.outcome, 'duplicate', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_festival_moment_outcome(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_festival_moment_outcome(uuid) TO authenticated, service_role;

COMMENT ON TABLE public.festival_attendee_moments IS
  'C7 server-owned attendee moments. Outcomes are bounded to Festival condition state; friendships, finance, XP/AP and permanent relationships are not mutated here.';
