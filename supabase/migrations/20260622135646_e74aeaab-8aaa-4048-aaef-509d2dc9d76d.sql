
-- City population history & dynamic adjustment system

CREATE TABLE IF NOT EXISTS public.city_population_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  previous_population integer NOT NULL,
  new_population integer NOT NULL,
  reason text NOT NULL,
  source_table text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.city_population_history TO anon, authenticated;
GRANT ALL ON public.city_population_history TO service_role;

ALTER TABLE public.city_population_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Population history readable by all"
  ON public.city_population_history FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_city_population_history_city
  ON public.city_population_history(city_id, created_at DESC);

-- RPC to adjust city population (security definer)
CREATE OR REPLACE FUNCTION public.adjust_city_population(
  p_city_id uuid,
  p_delta integer,
  p_reason text,
  p_source_table text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev integer;
  v_new integer;
BEGIN
  IF p_city_id IS NULL OR p_delta = 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.cities
     SET population = GREATEST(1000, population + p_delta),
         updated_at = now()
   WHERE id = p_city_id
   RETURNING population - p_delta, population
        INTO v_prev, v_new;

  IF v_new IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.city_population_history
    (city_id, delta, previous_population, new_population, reason, source_table, source_id)
  VALUES
    (p_city_id, p_delta, v_prev, v_new, p_reason, p_source_table, p_source_id);

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_city_population(uuid, integer, text, text, uuid)
  TO authenticated, service_role;

-- Trigger: when player travels, shift 1 person from origin to destination
CREATE OR REPLACE FUNCTION public.trg_travel_population_shift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.from_city_id IS NOT NULL AND NEW.from_city_id <> NEW.to_city_id THEN
    PERFORM public.adjust_city_population(NEW.from_city_id, -1, 'player_emigration', 'player_travel_history', NEW.id);
  END IF;
  IF NEW.to_city_id IS NOT NULL THEN
    PERFORM public.adjust_city_population(NEW.to_city_id, 1, 'player_immigration', 'player_travel_history', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS travel_population_shift ON public.player_travel_history;
CREATE TRIGGER travel_population_shift
  AFTER INSERT ON public.player_travel_history
  FOR EACH ROW EXECUTE FUNCTION public.trg_travel_population_shift();

-- Trigger: successful gigs draw new residents to host city (scaled by attendance + new fans)
CREATE OR REPLACE FUNCTION public.trg_gig_population_boost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city_id uuid;
  v_growth integer;
BEGIN
  SELECT v.city_id INTO v_city_id
    FROM public.venues v
   WHERE v.id = NEW.venue_id;

  IF v_city_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_growth := GREATEST(0, COALESCE(NEW.new_followers, 0) / 50
                       + COALESCE(NEW.actual_attendance, 0) / 500);

  IF v_growth > 0 THEN
    PERFORM public.adjust_city_population(v_city_id, v_growth, 'gig_drew_residents', 'gig_outcomes', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gig_population_boost ON public.gig_outcomes;
CREATE TRIGGER gig_population_boost
  AFTER INSERT ON public.gig_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.trg_gig_population_boost();
