-- Align accelerated game-date calculation to sub-day time so every game day occurs,
-- and initialize birthday/age anchors for characters created after the aging rollout.

CREATE OR REPLACE FUNCTION public.rockmundo_game_date_at(_at timestamptz DEFAULT now())
RETURNS TABLE(game_year integer, game_month integer, game_day integer)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days_per_month numeric := 10;
  v_real_days numeric;
  v_game_days integer;
  v_remaining integer;
BEGIN
  SELECT COALESCE(real_world_days_per_game_month, 10)::numeric
    INTO v_days_per_month
  FROM public.game_calendar_config
  WHERE is_active = true
  LIMIT 1;

  v_days_per_month := GREATEST(1, COALESCE(v_days_per_month, 10));
  v_real_days := GREATEST(
    0,
    EXTRACT(EPOCH FROM (_at - TIMESTAMPTZ '2026-01-01 00:00:00+00')) / 86400.0
  );
  v_game_days := FLOOR(v_real_days * (30.0 / v_days_per_month));

  game_year := FLOOR(v_game_days / 360.0)::integer + 1;
  v_remaining := MOD(v_game_days, 360);
  game_month := FLOOR(v_remaining / 30.0)::integer + 1;
  game_day := MOD(v_remaining, 30) + 1;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.initialize_character_age_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  g record;
BEGIN
  SELECT * INTO g FROM public.rockmundo_game_date_at(now());

  NEW.birth_game_month := COALESCE(
    NEW.birth_game_month,
    NULLIF(EXTRACT(MONTH FROM NEW.character_birth_date)::integer, 0),
    1 + MOD(ABS(hashtext(NEW.id::text)::bigint), 12)::integer
  );
  NEW.birth_game_day := COALESCE(
    NEW.birth_game_day,
    NULLIF(LEAST(30, EXTRACT(DAY FROM NEW.character_birth_date)::integer), 0),
    1 + MOD(ABS(hashtext(reverse(NEW.id::text))::bigint), 30)::integer
  );
  NEW.age_anchor_age := COALESCE(NEW.age_anchor_age, GREATEST(16, COALESCE(NEW.age, 16)::integer));
  NEW.age_anchor_game_year := COALESCE(NEW.age_anchor_game_year, g.game_year);
  NEW.age_anchor_game_month := COALESCE(NEW.age_anchor_game_month, g.game_month);
  NEW.age_anchor_game_day := COALESCE(NEW.age_anchor_game_day, g.game_day);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS initialize_character_age_state_before_insert ON public.profiles;
CREATE TRIGGER initialize_character_age_state_before_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.initialize_character_age_state();

DO $$
DECLARE
  g record;
BEGIN
  SELECT * INTO g FROM public.rockmundo_game_date_at(now());
  UPDATE public.profiles
  SET age_anchor_game_year = g.game_year,
      age_anchor_game_month = g.game_month,
      age_anchor_game_day = g.game_day
  WHERE deleted_at IS NULL;
END $$;

NOTIFY pgrst, 'reload schema';