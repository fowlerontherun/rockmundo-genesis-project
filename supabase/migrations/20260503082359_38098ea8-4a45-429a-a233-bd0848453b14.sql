-- Cascade cleanup: when a tour_travel_leg is deleted, delete dependent player travel + scheduled activity rows.
ALTER TABLE public.player_travel_history
  DROP CONSTRAINT IF EXISTS player_travel_history_tour_leg_id_fkey;

ALTER TABLE public.player_travel_history
  ADD CONSTRAINT player_travel_history_tour_leg_id_fkey
  FOREIGN KEY (tour_leg_id) REFERENCES public.tour_travel_legs(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.cleanup_scheduled_activities_for_tour_leg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.player_scheduled_activities
  WHERE activity_type = 'travel'
    AND (metadata->>'tour_leg_id') = OLD.id::text;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_scheduled_activities_tour_leg ON public.tour_travel_legs;
CREATE TRIGGER trg_cleanup_scheduled_activities_tour_leg
  BEFORE DELETE ON public.tour_travel_legs
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_scheduled_activities_for_tour_leg();

-- One-time cleanup: any scheduled travel activities pointing to non-existent legs
DELETE FROM public.player_scheduled_activities
WHERE activity_type = 'travel'
  AND (metadata->>'tour_leg_id') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tour_travel_legs ttl
    WHERE ttl.id::text = metadata->>'tour_leg_id'
  );

-- One-time cleanup: orphaned scheduled player_travel_history rows that were tour legs (now NULL after old FK SET NULL)
-- We can't recover the leg id, but anything still scheduled/in-progress with no from_city is bogus.
DELETE FROM public.player_travel_history
WHERE status IN ('scheduled','in_progress')
  AND tour_leg_id IS NULL
  AND cost_paid = 0
  AND from_city_id IS NULL;