-- Per-leg status to mark cancelled/rescheduled travel legs explicitly
ALTER TABLE public.tour_travel_legs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_from_departure timestamptz;

CREATE INDEX IF NOT EXISTS idx_tour_travel_legs_status ON public.tour_travel_legs(status);
CREATE INDEX IF NOT EXISTS idx_tour_travel_legs_tour_status ON public.tour_travel_legs(tour_id, status);

-- Track when a tour's schedule was modified after booking ("rescheduled")
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS original_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.track_tour_reschedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.start_date IS DISTINCT FROM OLD.start_date)
       OR (NEW.end_date IS DISTINCT FROM OLD.end_date) THEN
      IF OLD.status NOT IN ('cancelled','completed') THEN
        NEW.rescheduled_at := now();
        NEW.reschedule_count := COALESCE(OLD.reschedule_count, 0) + 1;
        IF OLD.original_start_date IS NULL THEN
          NEW.original_start_date := OLD.start_date;
          NEW.original_end_date := OLD.end_date;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_tour_reschedule ON public.tours;
CREATE TRIGGER trg_track_tour_reschedule
  BEFORE UPDATE ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION public.track_tour_reschedule();

-- When a tour is marked cancelled (status update), cascade-mark its legs cancelled
-- and clean up future scheduled travel rows so cancelled legs are never selectable.
CREATE OR REPLACE FUNCTION public.cascade_tour_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.tour_travel_legs
       SET status = 'cancelled', cancelled_at = now()
     WHERE tour_id = NEW.id AND status <> 'cancelled';

    -- Cancel any future player travel/activity tied to this tour's legs
    UPDATE public.player_travel_history pth
       SET status = 'cancelled'
      FROM public.tour_travel_legs ttl
     WHERE pth.tour_leg_id = ttl.id
       AND ttl.tour_id = NEW.id
       AND pth.status IN ('scheduled','in_progress')
       AND pth.arrival_time > now();

    UPDATE public.player_scheduled_activities psa
       SET status = 'cancelled'
     WHERE psa.activity_type = 'travel'
       AND psa.status IN ('scheduled','in_progress')
       AND psa.scheduled_end > now()
       AND (psa.metadata->>'tour_id')::uuid = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_tour_cancellation ON public.tours;
CREATE TRIGGER trg_cascade_tour_cancellation
  AFTER UPDATE ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_tour_cancellation();