-- Festival attendee temporary conditions and authoritative activity resolution.
-- Extends the Festival day planner introduced in 20291218255300.
-- No XP/AP, permanent wellness mutation, commercial spend, alcohol purchase,
-- random event, social relationship or performer outcome is resolved here.

ALTER TABLE public.festival_attendee_plan_items
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_status_check;

ALTER TABLE public.festival_attendee_plan_items
  ADD CONSTRAINT festival_attendee_plan_items_status_check
  CHECK (status IN ('planned', 'completed', 'missed', 'cancelled'));

CREATE TABLE public.festival_attendee_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL UNIQUE REFERENCES public.festival_player_attendance(id) ON DELETE CASCADE,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  energy integer NOT NULL CHECK (energy BETWEEN 0 AND 100),
  hunger integer NOT NULL CHECK (hunger BETWEEN 0 AND 100),
  hydration integer NOT NULL CHECK (hydration BETWEEN 0 AND 100),
  mood integer NOT NULL CHECK (mood BETWEEN 0 AND 100),
  intoxication integer NOT NULL DEFAULT 0 CHECK (intoxication BETWEEN 0 AND 100),
  social integer NOT NULL DEFAULT 50 CHECK (social BETWEEN 0 AND 100),
  last_evolved_at timestamptz NOT NULL,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, festival_edition_id)
);

CREATE INDEX festival_attendee_conditions_edition_idx
  ON public.festival_attendee_conditions(festival_edition_id);
CREATE INDEX festival_attendee_conditions_profile_idx
  ON public.festival_attendee_conditions(profile_id);

CREATE TABLE public.festival_attendee_activity_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_item_id uuid NOT NULL UNIQUE REFERENCES public.festival_attendee_plan_items(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.festival_player_attendance(id) ON DELETE CASCADE,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('eat', 'drink', 'explore', 'rest')),
  duration_minutes smallint NOT NULL CHECK (duration_minutes IN (30, 60, 90)),
  before_state jsonb NOT NULL,
  effect jsonb NOT NULL,
  after_state jsonb NOT NULL,
  resolved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX festival_attendee_activity_resolutions_attendance_idx
  ON public.festival_attendee_activity_resolutions(attendance_id, resolved_at DESC);
CREATE INDEX festival_attendee_activity_resolutions_edition_idx
  ON public.festival_attendee_activity_resolutions(festival_edition_id);
CREATE INDEX festival_attendee_activity_resolutions_profile_idx
  ON public.festival_attendee_activity_resolutions(profile_id, resolved_at DESC);

ALTER TABLE public.festival_attendee_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_attendee_activity_resolutions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.festival_attendee_conditions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.festival_attendee_activity_resolutions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.festival_attendee_conditions TO service_role;
GRANT ALL ON TABLE public.festival_attendee_activity_resolutions TO service_role;

CREATE OR REPLACE FUNCTION public._festival_ensure_attendee_conditions(
  p_attendance_id uuid
)
RETURNS public.festival_attendee_conditions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_profile_json jsonb;
  v_conditions public.festival_attendee_conditions%ROWTYPE;
  v_energy integer;
  v_nutrition integer;
  v_hydration integer;
  v_mood integer;
BEGIN
  SELECT attendance.* INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_attendance_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT profile.* INTO v_profile
  FROM public.profiles profile
  WHERE profile.id = v_attendance.profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  -- to_jsonb keeps this compatible with production databases where the newer
  -- permanent profiles.hydration column has not been introduced yet.
  v_profile_json := to_jsonb(v_profile);
  v_energy := least(100, greatest(0, coalesce((v_profile_json->>'energy')::integer, 80)));
  v_nutrition := least(100, greatest(0, coalesce((v_profile_json->>'nutrition')::integer, 68)));
  v_hydration := least(100, greatest(0, coalesce(nullif(v_profile_json->>'hydration', '')::integer, 75)));
  v_mood := least(
    100,
    greatest(
      0,
      coalesce(
        nullif(v_profile_json->>'mood', '')::integer,
        nullif(v_profile_json->>'happiness', '')::integer,
        70
      )
    )
  );

  INSERT INTO public.festival_attendee_conditions (
    attendance_id, festival_edition_id, profile_id,
    energy, hunger, hydration, mood, intoxication, social, last_evolved_at
  ) VALUES (
    v_attendance.id,
    v_attendance.festival_edition_id,
    v_attendance.profile_id,
    v_energy,
    least(100, greatest(0, 100 - v_nutrition)),
    v_hydration,
    v_mood,
    0,
    50,
    coalesce(v_attendance.checked_in_at, now())
  )
  ON CONFLICT (attendance_id) DO NOTHING;

  SELECT conditions.* INTO v_conditions
  FROM public.festival_attendee_conditions conditions
  WHERE conditions.attendance_id = p_attendance_id;

  RETURN v_conditions;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_ensure_attendee_conditions(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_ensure_attendee_conditions(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_seed_conditions_on_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'attending' THEN
    PERFORM public._festival_ensure_attendee_conditions(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_seed_conditions_on_attendance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_seed_conditions_on_attendance()
  TO service_role;

DROP TRIGGER IF EXISTS festival_seed_conditions_after_insert
  ON public.festival_player_attendance;
CREATE TRIGGER festival_seed_conditions_after_insert
AFTER INSERT ON public.festival_player_attendance
FOR EACH ROW
WHEN (NEW.status = 'attending')
EXECUTE FUNCTION public._festival_seed_conditions_on_attendance();

DROP TRIGGER IF EXISTS festival_seed_conditions_after_update
  ON public.festival_player_attendance;
CREATE TRIGGER festival_seed_conditions_after_update
AFTER UPDATE OF status, checked_in_at ON public.festival_player_attendance
FOR EACH ROW
WHEN (NEW.status = 'attending')
EXECUTE FUNCTION public._festival_seed_conditions_on_attendance();

INSERT INTO public.festival_attendee_conditions (
  attendance_id, festival_edition_id, profile_id,
  energy, hunger, hydration, mood, intoxication, social, last_evolved_at
)
SELECT
  attendance.id,
  attendance.festival_edition_id,
  attendance.profile_id,
  least(100, greatest(0, coalesce((to_jsonb(profile)->>'energy')::integer, 80))),
  least(100, greatest(0, 100 - coalesce((to_jsonb(profile)->>'nutrition')::integer, 68))),
  least(100, greatest(0, coalesce(nullif(to_jsonb(profile)->>'hydration', '')::integer, 75))),
  least(
    100,
    greatest(
      0,
      coalesce(
        nullif(to_jsonb(profile)->>'mood', '')::integer,
        nullif(to_jsonb(profile)->>'happiness', '')::integer,
        70
      )
    )
  ),
  0,
  50,
  coalesce(attendance.checked_in_at, now())
FROM public.festival_player_attendance attendance
JOIN public.profiles profile ON profile.id = attendance.profile_id
WHERE attendance.status = 'attending'
ON CONFLICT (attendance_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public._festival_evolve_attendee_conditions(
  p_attendance_id uuid,
  p_as_of timestamptz DEFAULT now()
)
RETURNS public.festival_attendee_conditions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_conditions public.festival_attendee_conditions%ROWTYPE;
  v_elapsed_minutes integer;
  v_ticks integer;
BEGIN
  SELECT attendance.* INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_attendance_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_attendance.status <> 'attending' THEN
    RAISE EXCEPTION 'festival_not_attending' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public._festival_ensure_attendee_conditions(p_attendance_id);

  SELECT conditions.* INTO v_conditions
  FROM public.festival_attendee_conditions conditions
  WHERE conditions.attendance_id = p_attendance_id
  FOR UPDATE;

  v_elapsed_minutes := greatest(
    0,
    floor(extract(epoch FROM (p_as_of - v_conditions.last_evolved_at)) / 60.0)::integer
  );
  v_ticks := floor(v_elapsed_minutes / 30.0)::integer;

  IF v_ticks <= 0 THEN
    RETURN v_conditions;
  END IF;

  UPDATE public.festival_attendee_conditions
  SET energy = greatest(0, energy - (2 * v_ticks)),
      hunger = least(100, hunger + (3 * v_ticks)),
      hydration = greatest(0, hydration - (3 * v_ticks)),
      mood = greatest(0, mood - floor(v_ticks / 2.0)::integer),
      intoxication = greatest(0, intoxication - (4 * v_ticks)),
      social = greatest(0, social - v_ticks),
      last_evolved_at = least(
        p_as_of,
        last_evolved_at + make_interval(mins => 30 * v_ticks)
      ),
      updated_at = now()
  WHERE attendance_id = p_attendance_id
  RETURNING * INTO v_conditions;

  RETURN v_conditions;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_evolve_attendee_conditions(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_evolve_attendee_conditions(uuid, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_festival_conditions(
  p_attendance_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context jsonb;
  v_conditions public.festival_attendee_conditions%ROWTYPE;
BEGIN
  v_context := public._festival_day_plan_context(p_attendance_id);
  v_conditions := public._festival_evolve_attendee_conditions(p_attendance_id, now());

  RETURN jsonb_build_object(
    'attendanceId', v_conditions.attendance_id,
    'festivalEditionId', v_conditions.festival_edition_id,
    'energy', v_conditions.energy,
    'hunger', v_conditions.hunger,
    'hydration', v_conditions.hydration,
    'mood', v_conditions.mood,
    'intoxication', v_conditions.intoxication,
    'social', v_conditions.social,
    'lastEvolvedAt', v_conditions.last_evolved_at,
    'lastActivityAt', v_conditions.last_activity_at,
    'serverNow', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_conditions(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_conditions(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._festival_guard_plan_consumed_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status IN ('planned', 'completed')
     AND EXISTS (
       SELECT 1
       FROM public.festival_attendee_plan_items other
       WHERE other.attendance_id = NEW.attendance_id
         AND other.id <> NEW.id
         AND other.status IN ('planned', 'completed')
         AND tstzrange(other.starts_at, other.ends_at, '[)')
             && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
     ) THEN
    RAISE EXCEPTION 'festival_plan_overlap' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS festival_guard_plan_consumed_overlap
  ON public.festival_attendee_plan_items;
CREATE TRIGGER festival_guard_plan_consumed_overlap
BEFORE INSERT OR UPDATE OF attendance_id, starts_at, ends_at, status
ON public.festival_attendee_plan_items
FOR EACH ROW
EXECUTE FUNCTION public._festival_guard_plan_consumed_overlap();

CREATE OR REPLACE FUNCTION public.resolve_festival_plan_activity(
  p_plan_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_item public.festival_attendee_plan_items%ROWTYPE;
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_before public.festival_attendee_conditions%ROWTYPE;
  v_after public.festival_attendee_conditions%ROWTYPE;
  v_existing public.festival_attendee_activity_resolutions%ROWTYPE;
  v_resolution public.festival_attendee_activity_resolutions%ROWTYPE;
  v_scale numeric;
  v_energy_delta integer := 0;
  v_hunger_delta integer := 0;
  v_hydration_delta integer := 0;
  v_mood_delta integer := 0;
  v_intoxication_delta integer := 0;
  v_social_delta integer := 0;
  v_before_json jsonb;
  v_effect_json jsonb;
  v_after_json jsonb;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT item.* INTO v_item
  FROM public.festival_attendee_plan_items item
  WHERE item.id = p_plan_item_id
    AND item.profile_id = v_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_plan_item_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT attendance.* INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = v_item.attendance_id
    AND attendance.profile_id = v_profile_id;

  IF NOT FOUND OR v_attendance.status <> 'attending' THEN
    RAISE EXCEPTION 'festival_not_attending' USING ERRCODE = 'P0001';
  END IF;

  IF v_item.activity_type NOT IN ('eat', 'drink', 'explore', 'rest') THEN
    RAISE EXCEPTION 'festival_activity_not_supported' USING ERRCODE = 'P0001';
  END IF;

  IF v_item.status = 'completed' THEN
    SELECT resolution.* INTO v_existing
    FROM public.festival_attendee_activity_resolutions resolution
    WHERE resolution.plan_item_id = v_item.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'festival_activity_resolution_missing' USING ERRCODE = 'P0001';
    END IF;

    RETURN jsonb_build_object(
      'planItemId', v_existing.plan_item_id,
      'attendanceId', v_existing.attendance_id,
      'activityType', v_existing.activity_type,
      'durationMinutes', v_existing.duration_minutes,
      'status', 'completed',
      'before', v_existing.before_state,
      'effect', v_existing.effect,
      'after', v_existing.after_state,
      'resolvedAt', v_existing.resolved_at,
      'duplicate', true
    );
  END IF;

  IF v_item.status = 'cancelled' THEN
    RAISE EXCEPTION 'festival_plan_item_cancelled' USING ERRCODE = 'P0001';
  END IF;

  IF v_item.status = 'missed' THEN
    RETURN jsonb_build_object(
      'planItemId', v_item.id,
      'attendanceId', v_item.attendance_id,
      'activityType', v_item.activity_type,
      'durationMinutes', v_item.duration_minutes,
      'status', 'missed',
      'reason', 'activity_window_missed',
      'resolvedAt', v_item.resolved_at,
      'duplicate', true
    );
  END IF;

  IF now() < v_item.starts_at THEN
    RAISE EXCEPTION 'festival_activity_not_started' USING ERRCODE = 'P0001';
  END IF;

  IF now() >= v_item.ends_at THEN
    UPDATE public.festival_attendee_plan_items
    SET status = 'missed',
        resolved_at = coalesce(resolved_at, ends_at),
        updated_at = now()
    WHERE id = v_item.id
    RETURNING * INTO v_item;

    RETURN jsonb_build_object(
      'planItemId', v_item.id,
      'attendanceId', v_item.attendance_id,
      'activityType', v_item.activity_type,
      'durationMinutes', v_item.duration_minutes,
      'status', 'missed',
      'reason', 'activity_window_missed',
      'resolvedAt', v_item.resolved_at,
      'duplicate', false
    );
  END IF;

  v_before := public._festival_evolve_attendee_conditions(v_item.attendance_id, now());
  v_scale := v_item.duration_minutes::numeric / 30.0;

  CASE v_item.activity_type
    WHEN 'eat' THEN
      v_energy_delta := round(4 * v_scale)::integer;
      v_hunger_delta := -round(24 * v_scale)::integer;
      v_hydration_delta := round(3 * v_scale)::integer;
      v_mood_delta := round(2 * v_scale)::integer;
    WHEN 'drink' THEN
      v_hydration_delta := round(22 * v_scale)::integer;
      v_mood_delta := least(3, round(1 * v_scale)::integer);
    WHEN 'explore' THEN
      v_energy_delta := -round(5 * v_scale)::integer;
      v_hunger_delta := round(3 * v_scale)::integer;
      v_hydration_delta := -round(4 * v_scale)::integer;
      v_mood_delta := round(5 * v_scale)::integer;
      v_social_delta := round(3 * v_scale)::integer;
    WHEN 'rest' THEN
      v_energy_delta := round(9 * v_scale)::integer;
      v_hunger_delta := round(2 * v_scale)::integer;
      v_hydration_delta := -round(1 * v_scale)::integer;
      v_mood_delta := round(3 * v_scale)::integer;
  END CASE;

  v_before_json := jsonb_build_object(
    'energy', v_before.energy,
    'hunger', v_before.hunger,
    'hydration', v_before.hydration,
    'mood', v_before.mood,
    'intoxication', v_before.intoxication,
    'social', v_before.social
  );

  UPDATE public.festival_attendee_conditions
  SET energy = least(100, greatest(0, energy + v_energy_delta)),
      hunger = least(100, greatest(0, hunger + v_hunger_delta)),
      hydration = least(100, greatest(0, hydration + v_hydration_delta)),
      mood = least(100, greatest(0, mood + v_mood_delta)),
      intoxication = least(100, greatest(0, intoxication + v_intoxication_delta)),
      social = least(100, greatest(0, social + v_social_delta)),
      last_activity_at = now(),
      updated_at = now()
  WHERE attendance_id = v_item.attendance_id
  RETURNING * INTO v_after;

  v_effect_json := jsonb_build_object(
    'energy', v_energy_delta,
    'hunger', v_hunger_delta,
    'hydration', v_hydration_delta,
    'mood', v_mood_delta,
    'intoxication', v_intoxication_delta,
    'social', v_social_delta
  );

  v_after_json := jsonb_build_object(
    'energy', v_after.energy,
    'hunger', v_after.hunger,
    'hydration', v_after.hydration,
    'mood', v_after.mood,
    'intoxication', v_after.intoxication,
    'social', v_after.social
  );

  INSERT INTO public.festival_attendee_activity_resolutions (
    plan_item_id, attendance_id, festival_edition_id, profile_id,
    activity_type, duration_minutes, before_state, effect, after_state, resolved_at
  ) VALUES (
    v_item.id,
    v_item.attendance_id,
    v_item.festival_edition_id,
    v_item.profile_id,
    v_item.activity_type,
    v_item.duration_minutes,
    v_before_json,
    v_effect_json,
    v_after_json,
    now()
  )
  RETURNING * INTO v_resolution;

  UPDATE public.festival_attendee_plan_items
  SET status = 'completed',
      resolved_at = v_resolution.resolved_at,
      updated_at = now()
  WHERE id = v_item.id;

  RETURN jsonb_build_object(
    'planItemId', v_resolution.plan_item_id,
    'attendanceId', v_resolution.attendance_id,
    'activityType', v_resolution.activity_type,
    'durationMinutes', v_resolution.duration_minutes,
    'status', 'completed',
    'before', v_resolution.before_state,
    'effect', v_resolution.effect,
    'after', v_resolution.after_state,
    'resolvedAt', v_resolution.resolved_at,
    'duplicate', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_festival_plan_activity(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_festival_plan_activity(uuid)
  TO authenticated, service_role;

COMMENT ON TABLE public.festival_attendee_conditions IS
  'Temporary server-authoritative Festival-only attendee condition overlay. It does not directly replace permanent profile wellness values.';
COMMENT ON TABLE public.festival_attendee_activity_resolutions IS
  'Immutable exact-once outcomes for executable Festival planner activities.';
COMMENT ON TABLE public.festival_attendee_plan_items IS
  'Server-authoritative Festival attendee timeline. Planned blocks become completed, missed or cancelled; executable outcomes are persisted separately.';
COMMENT ON FUNCTION public.get_my_festival_conditions(uuid) IS
  'Returns the active character temporary Festival condition overlay after server-side elapsed-time evolution.';
COMMENT ON FUNCTION public.resolve_festival_plan_activity(uuid) IS
  'Resolves one active Eat, Drink, Explore or Rest planner block exactly once, persists before/effect/after state and marks the block completed.';
