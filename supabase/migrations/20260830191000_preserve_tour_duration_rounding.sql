-- The first 30-minute rollout changed book_tour from whole-hour ceiling to
-- tenths before subtracting the reduction. Preserve the established rounded-up
-- route estimate and subtract exactly thirty minutes from that player-facing
-- duration instead.
DO $migration$
DECLARE
  v_definition text;
  v_old_formula text := $old$        v_duration_hours := greatest(0.5, round((
          v_distance_km / CASE v_leg_mode
            WHEN 'plane' THEN 800 WHEN 'train' THEN 180 WHEN 'tour_bus' THEN 90 ELSE 75 END
          + CASE v_leg_mode WHEN 'plane' THEN 2 WHEN 'train' THEN 1 ELSE 0.5 END
          - 0.5
        ) * 10) / 10.0);$old$;
  v_new_formula text := $new$        v_duration_hours := greatest(0.5, ceil(
          v_distance_km / CASE v_leg_mode
            WHEN 'plane' THEN 800 WHEN 'train' THEN 180 WHEN 'tour_bus' THEN 90 ELSE 75 END
          + CASE v_leg_mode WHEN 'plane' THEN 2 WHEN 'train' THEN 1 ELSE 0.5 END
        ) - 0.5);$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.book_tour(uuid,text,date,date,uuid,integer,jsonb,uuid,text,uuid,text)'::regprocedure
  ) INTO v_definition;

  IF position(v_new_formula IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position(v_old_formula IN v_definition) = 0 THEN
    RAISE EXCEPTION 'book_tour duration formula did not match the expected rollout version';
  END IF;

  EXECUTE replace(v_definition, v_old_formula, v_new_formula);
END;
$migration$;

NOTIFY pgrst, 'reload schema';
