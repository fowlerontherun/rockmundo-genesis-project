-- Festival C6: bounded attendee condition simulation layered onto the existing
-- temporary Festival condition authority. This migration deliberately reuses
-- festival_attendee_conditions and the existing Wellness profile fields rather
-- than creating a second permanent health model.

ALTER TABLE public.festival_attendee_conditions
  ADD COLUMN IF NOT EXISTS comfort integer NOT NULL DEFAULT 70 CHECK (comfort BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS inspiration integer NOT NULL DEFAULT 50 CHECK (inspiration BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS last_context_evolved_at timestamptz;

UPDATE public.festival_attendee_conditions
SET last_context_evolved_at = COALESCE(last_context_evolved_at, last_evolved_at, now())
WHERE last_context_evolved_at IS NULL;

ALTER TABLE public.festival_attendee_conditions
  ALTER COLUMN last_context_evolved_at SET DEFAULT now(),
  ALTER COLUMN last_context_evolved_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.festival_attendee_condition_context_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_item_id uuid NOT NULL UNIQUE REFERENCES public.festival_attendee_plan_items(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.festival_player_attendance(id) ON DELETE CASCADE,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN (
    'watch_act', 'eat', 'drink', 'explore', 'rest', 'camping', 'vip', 'vendor', 'free_time'
  )),
  effect jsonb NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS festival_condition_context_attendance_idx
  ON public.festival_attendee_condition_context_resolutions(attendance_id, resolved_at DESC);

ALTER TABLE public.festival_attendee_condition_context_resolutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.festival_attendee_condition_context_resolutions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.festival_attendee_condition_context_resolutions TO service_role;

CREATE OR REPLACE FUNCTION public._festival_evolve_c6_conditions(
  p_attendance_id uuid,
  p_as_of timestamptz DEFAULT now()
)
RETURNS public.festival_attendee_conditions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_conditions public.festival_attendee_conditions%ROWTYPE;
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_edition_json jsonb := '{}'::jsonb;
  v_elapsed_minutes integer;
  v_ticks integer;
  v_comfort_decay integer := 0;
  v_inspiration_decay integer := 0;
  v_weather text;
  v_site_type text;
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

  SELECT to_jsonb(edition) INTO v_edition_json
  FROM public.festival_editions_v2 edition
  WHERE edition.id = v_attendance.festival_edition_id;

  v_elapsed_minutes := greatest(
    0,
    floor(extract(epoch FROM (p_as_of - v_conditions.last_context_evolved_at)) / 60.0)::integer
  );
  v_ticks := floor(v_elapsed_minutes / 30.0)::integer;

  IF v_ticks <= 0 THEN
    RETURN v_conditions;
  END IF;

  v_weather := lower(coalesce(
    v_edition_json->>'weather_condition',
    v_edition_json->>'weather',
    ''
  ));
  v_site_type := lower(coalesce(v_edition_json->>'site_type', ''));

  -- Comfort naturally falls over a long festival day. Outdoor sites and any
  -- authoritative adverse-weather marker make that bounded decay slightly
  -- stronger; missing weather data remains neutral.
  v_comfort_decay := v_ticks;
  IF v_site_type = 'outdoor' THEN
    v_comfort_decay := v_comfort_decay + floor(v_ticks / 2.0)::integer;
  END IF;
  IF v_weather ~ '(rain|storm|cold|heat|hot|wind)' THEN
    v_comfort_decay := v_comfort_decay + v_ticks;
  END IF;

  v_inspiration_decay := floor(v_ticks / 2.0)::integer;

  UPDATE public.festival_attendee_conditions
  SET comfort = greatest(0, comfort - v_comfort_decay),
      inspiration = greatest(0, inspiration - v_inspiration_decay),
      last_context_evolved_at = least(
        p_as_of,
        last_context_evolved_at + make_interval(mins => 30 * v_ticks)
      ),
      updated_at = now()
  WHERE attendance_id = p_attendance_id
  RETURNING * INTO v_conditions;

  RETURN v_conditions;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_evolve_c6_conditions(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_evolve_c6_conditions(uuid, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_apply_completed_plan_context(
  p_attendance_id uuid,
  p_as_of timestamptz DEFAULT now()
)
RETURNS public.festival_attendee_conditions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_conditions public.festival_attendee_conditions%ROWTYPE;
  v_item public.festival_attendee_plan_items%ROWTYPE;
  v_scale integer;
  v_energy integer;
  v_hunger integer;
  v_hydration integer;
  v_mood integer;
  v_comfort integer;
  v_inspiration integer;
BEGIN
  SELECT conditions.* INTO v_conditions
  FROM public.festival_attendee_conditions conditions
  WHERE conditions.attendance_id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_conditions := public._festival_ensure_attendee_conditions(p_attendance_id);
  END IF;

  FOR v_item IN
    SELECT item.*
    FROM public.festival_attendee_plan_items item
    WHERE item.attendance_id = p_attendance_id
      AND item.status = 'completed'
      AND item.resolved_at IS NOT NULL
      AND item.resolved_at <= p_as_of
      AND NOT EXISTS (
        SELECT 1
        FROM public.festival_attendee_condition_context_resolutions resolution
        WHERE resolution.plan_item_id = item.id
      )
    ORDER BY item.resolved_at, item.id
    FOR UPDATE
  LOOP
    v_scale := greatest(1, least(3, ceil(v_item.duration_minutes / 30.0)::integer));
    v_energy := 0;
    v_hunger := 0;
    v_hydration := 0;
    v_mood := 0;
    v_comfort := 0;
    v_inspiration := 0;

    CASE v_item.activity_type
      WHEN 'watch_act' THEN
        v_energy := -2 * v_scale;
        v_hydration := -2 * v_scale;
        v_mood := 4 * v_scale;
        v_comfort := -1 * v_scale;
        v_inspiration := 6 * v_scale;
      WHEN 'eat' THEN
        v_comfort := 2 * v_scale;
        v_mood := 1 * v_scale;
      WHEN 'drink' THEN
        v_comfort := 1 * v_scale;
      WHEN 'explore' THEN
        v_energy := -1 * v_scale;
        v_hydration := -1 * v_scale;
        v_mood := 2 * v_scale;
        v_inspiration := 3 * v_scale;
      WHEN 'rest' THEN
        v_comfort := 4 * v_scale;
        v_inspiration := 1 * v_scale;
      WHEN 'camping' THEN
        v_energy := 4 * v_scale;
        v_comfort := 3 * v_scale;
        v_mood := 1 * v_scale;
      WHEN 'vip' THEN
        v_comfort := 5 * v_scale;
        v_mood := 3 * v_scale;
        v_inspiration := 2 * v_scale;
      WHEN 'vendor' THEN
        v_mood := 1 * v_scale;
        v_inspiration := 1 * v_scale;
      WHEN 'free_time' THEN
        v_energy := 2 * v_scale;
        v_comfort := 3 * v_scale;
        v_mood := 2 * v_scale;
      ELSE
        CONTINUE;
    END CASE;

    INSERT INTO public.festival_attendee_condition_context_resolutions (
      plan_item_id,
      attendance_id,
      festival_edition_id,
      profile_id,
      activity_type,
      effect,
      resolved_at
    ) VALUES (
      v_item.id,
      v_item.attendance_id,
      v_item.festival_edition_id,
      v_item.profile_id,
      v_item.activity_type,
      jsonb_build_object(
        'energy', v_energy,
        'hunger', v_hunger,
        'hydration', v_hydration,
        'mood', v_mood,
        'comfort', v_comfort,
        'inspiration', v_inspiration
      ),
      v_item.resolved_at
    )
    ON CONFLICT (plan_item_id) DO NOTHING;

    IF FOUND THEN
      UPDATE public.festival_attendee_conditions
      SET energy = least(100, greatest(0, energy + v_energy)),
          hunger = least(100, greatest(0, hunger + v_hunger)),
          hydration = least(100, greatest(0, hydration + v_hydration)),
          mood = least(100, greatest(0, mood + v_mood)),
          comfort = least(100, greatest(0, comfort + v_comfort)),
          inspiration = least(100, greatest(0, inspiration + v_inspiration)),
          updated_at = now()
      WHERE attendance_id = p_attendance_id
      RETURNING * INTO v_conditions;
    END IF;
  END LOOP;

  RETURN v_conditions;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_apply_completed_plan_context(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_apply_completed_plan_context(uuid, timestamptz)
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
  v_conditions := public._festival_evolve_c6_conditions(p_attendance_id, now());
  v_conditions := public._festival_apply_completed_plan_context(p_attendance_id, now());

  RETURN jsonb_build_object(
    'attendanceId', v_conditions.attendance_id,
    'festivalEditionId', v_conditions.festival_edition_id,
    'energy', v_conditions.energy,
    'hunger', v_conditions.hunger,
    'hydration', v_conditions.hydration,
    'mood', v_conditions.mood,
    'intoxication', v_conditions.intoxication,
    'social', v_conditions.social,
    'comfort', v_conditions.comfort,
    'inspiration', v_conditions.inspiration,
    'lastEvolvedAt', greatest(v_conditions.last_evolved_at, v_conditions.last_context_evolved_at),
    'lastActivityAt', v_conditions.last_activity_at,
    'serverNow', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_conditions(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_conditions(uuid)
  TO authenticated, service_role;

-- Blend only bounded physical condition back into normal Wellness when Festival
-- attendance ends. This is intentionally conservative so a Festival cannot be
-- used to reset or farm permanent Wellness state.
CREATE OR REPLACE FUNCTION public._festival_reconcile_wellness_on_exit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_conditions public.festival_attendee_conditions%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_new_energy integer;
  v_new_nutrition integer;
BEGIN
  IF OLD.status <> 'attending' OR NEW.status = 'attending' THEN
    RETURN NEW;
  END IF;

  SELECT conditions.* INTO v_conditions
  FROM public.festival_attendee_conditions conditions
  WHERE conditions.attendance_id = NEW.id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT profile.* INTO v_profile
  FROM public.profiles profile
  WHERE profile.id = NEW.profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_new_energy := least(100, greatest(0, round((coalesce(v_profile.energy, 75) + v_conditions.energy) / 2.0)::integer));
  v_new_nutrition := least(100, greatest(0, round((coalesce(v_profile.nutrition, 75) + (100 - v_conditions.hunger)) / 2.0)::integer));

  UPDATE public.profiles
  SET energy = v_new_energy,
      nutrition = v_new_nutrition
  WHERE id = NEW.profile_id;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_reconcile_wellness_on_exit()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_reconcile_wellness_on_exit()
  TO service_role;

DROP TRIGGER IF EXISTS festival_reconcile_wellness_on_exit
  ON public.festival_player_attendance;
CREATE TRIGGER festival_reconcile_wellness_on_exit
AFTER UPDATE OF status ON public.festival_player_attendance
FOR EACH ROW
WHEN (OLD.status = 'attending' AND NEW.status <> 'attending')
EXECUTE FUNCTION public._festival_reconcile_wellness_on_exit();
