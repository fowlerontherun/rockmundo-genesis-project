
CREATE OR REPLACE FUNCTION public.log_player_travel_timeline_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tour_id uuid;
  v_band_id uuid;
  v_event_type text;
  v_message text;
  v_prev_eta timestamptz;
  v_new_eta timestamptz;
  v_meta jsonb;
BEGIN
  -- Resolve tour and band for context (only when leg-linked)
  IF NEW.tour_leg_id IS NOT NULL THEN
    SELECT l.tour_id, t.band_id
      INTO v_tour_id, v_band_id
    FROM public.tour_travel_legs l
    LEFT JOIN public.tours t ON t.id = l.tour_id
    WHERE l.id = NEW.tour_leg_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_event_type := CASE NEW.status
      WHEN 'in_progress' THEN 'departed'
      WHEN 'completed' THEN 'arrived'
      WHEN 'scheduled' THEN 'booked'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'created'
    END;
    v_message := CASE NEW.status
      WHEN 'in_progress' THEN 'Departed — leg in progress'
      WHEN 'completed' THEN 'Arrived at destination'
      WHEN 'scheduled' THEN 'Travel booked'
      WHEN 'cancelled' THEN 'Travel cancelled'
      ELSE 'Travel record created'
    END;
    v_meta := jsonb_build_object(
      'transport_type', NEW.transport_type,
      'duration_hours', NEW.travel_duration_hours,
      'status', NEW.status,
      'cost_paid', NEW.cost_paid
    );

    INSERT INTO public.travel_timeline_events (
      profile_id, user_id, band_id, tour_id, tour_leg_id, travel_history_id,
      from_city_id, to_city_id, event_type, message, new_eta, metadata
    ) VALUES (
      NEW.profile_id, NEW.user_id, v_band_id, v_tour_id, NEW.tour_leg_id, NEW.id,
      NEW.from_city_id, NEW.to_city_id, v_event_type, v_message, NEW.arrival_time, v_meta
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_prev_eta := OLD.arrival_time;
    v_new_eta := NEW.arrival_time;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := CASE NEW.status
        WHEN 'in_progress' THEN 'departed'
        WHEN 'completed' THEN 'arrived'
        WHEN 'cancelled' THEN 'cancelled'
        WHEN 'scheduled' THEN 'rescheduled'
        ELSE 'status_changed'
      END;
      v_message := CASE NEW.status
        WHEN 'in_progress' THEN 'Departed — leg now in progress'
        WHEN 'completed' THEN 'Arrived at destination'
        WHEN 'cancelled' THEN 'Travel leg cancelled'
        WHEN 'scheduled' THEN 'Travel rescheduled'
        ELSE format('Status changed to %s', NEW.status)
      END;
      v_meta := jsonb_build_object(
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'transport_type', NEW.transport_type,
        'duration_hours', NEW.travel_duration_hours
      );

      INSERT INTO public.travel_timeline_events (
        profile_id, user_id, band_id, tour_id, tour_leg_id, travel_history_id,
        from_city_id, to_city_id, event_type, message, previous_eta, new_eta, metadata
      ) VALUES (
        NEW.profile_id, NEW.user_id, v_band_id, v_tour_id, NEW.tour_leg_id, NEW.id,
        NEW.from_city_id, NEW.to_city_id, v_event_type, v_message, v_prev_eta, v_new_eta, v_meta
      );
    ELSIF v_new_eta IS DISTINCT FROM v_prev_eta THEN
      v_meta := jsonb_build_object(
        'transport_type', NEW.transport_type,
        'duration_hours', NEW.travel_duration_hours,
        'status', NEW.status
      );

      INSERT INTO public.travel_timeline_events (
        profile_id, user_id, band_id, tour_id, tour_leg_id, travel_history_id,
        from_city_id, to_city_id, event_type, message, previous_eta, new_eta, metadata
      ) VALUES (
        NEW.profile_id, NEW.user_id, v_band_id, v_tour_id, NEW.tour_leg_id, NEW.id,
        NEW.from_city_id, NEW.to_city_id,
        'eta_updated', 'Estimated arrival updated', v_prev_eta, v_new_eta, v_meta
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_player_travel_timeline_event ON public.player_travel_history;
CREATE TRIGGER trg_log_player_travel_timeline_event
AFTER INSERT OR UPDATE ON public.player_travel_history
FOR EACH ROW
EXECUTE FUNCTION public.log_player_travel_timeline_event();
