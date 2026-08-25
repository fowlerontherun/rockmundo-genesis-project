-- C7 social-safety hardening for delayed choices/outcomes.

CREATE OR REPLACE FUNCTION public._festival_assert_moment_still_available(
  p_moment_id uuid
)
RETURNS public.festival_attendee_moments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_moment public.festival_attendee_moments%ROWTYPE;
  v_attendance public.festival_player_attendance%ROWTYPE;
BEGIN
  SELECT * INTO v_moment
  FROM public.festival_attendee_moments
  WHERE id = p_moment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_moment_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_attendance
  FROM public.festival_player_attendance
  WHERE id = v_moment.attendance_id
    AND profile_id = v_moment.profile_id;

  IF NOT FOUND OR v_attendance.status <> 'attending' THEN
    RAISE EXCEPTION 'festival_not_attending' USING ERRCODE = 'P0001';
  END IF;

  IF v_moment.related_profile_id IS NOT NULL
     AND public.are_profiles_blocked(v_moment.profile_id, v_moment.related_profile_id) THEN
    UPDATE public.festival_attendee_moments
    SET status = CASE WHEN status = 'resolved' THEN status ELSE 'expired' END,
        updated_at = now()
    WHERE id = v_moment.id;
    RAISE EXCEPTION 'festival_moment_social_unavailable' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_moment;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_assert_moment_still_available(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_assert_moment_still_available(uuid) TO service_role;

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
  v_moment := public._festival_assert_moment_still_available(p_moment_id);
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
  SET status = 'resolved',
      outcome = jsonb_build_object('conditionEffect', v_effect),
      resolved_at = now(),
      updated_at = now()
  WHERE id = v_moment.id
  RETURNING * INTO v_moment;

  RETURN v_moment;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_apply_moment_outcome(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_apply_moment_outcome(uuid) TO service_role;

-- Re-check block state immediately before a player locks in a social choice.
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
  v_moment := public._festival_assert_moment_still_available(p_moment_id);
  IF v_moment.profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'festival_moment_not_found' USING ERRCODE = 'P0001';
  END IF;

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
