
-- 1) Per-character travel notification preferences
CREATE TABLE IF NOT EXISTS public.travel_notification_preferences (
  profile_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  notify_status_changes boolean NOT NULL DEFAULT true,
  notify_eta_delays boolean NOT NULL DEFAULT true,
  notify_rejoin_available boolean NOT NULL DEFAULT true,
  email_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.travel_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own travel prefs"
ON public.travel_notification_preferences
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own travel prefs"
ON public.travel_notification_preferences
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users update own travel prefs"
ON public.travel_notification_preferences
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own travel prefs"
ON public.travel_notification_preferences
FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_travel_prefs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_travel_prefs ON public.travel_notification_preferences;
CREATE TRIGGER trg_touch_travel_prefs
BEFORE UPDATE ON public.travel_notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.touch_travel_prefs_updated_at();

-- 2) Inbox notifier driven by travel_timeline_events
CREATE OR REPLACE FUNCTION public.notify_travel_timeline_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prefs public.travel_notification_preferences;
  v_target_user uuid;
  v_title text;
  v_message text;
  v_priority public.inbox_priority := 'normal';
  v_from text;
  v_to text;
  v_should_notify boolean := false;
  v_notify_kind text;
BEGIN
  -- Resolve user id (event row may not have it for legacy data)
  v_target_user := NEW.user_id;
  IF v_target_user IS NULL THEN
    SELECT user_id INTO v_target_user FROM public.profiles WHERE id = NEW.profile_id;
  END IF;
  IF v_target_user IS NULL THEN RETURN NEW; END IF;

  -- Decide if this event type should ever notify, and which preference flag gates it
  IF NEW.event_type IN ('departed', 'arrived', 'cancelled', 'rescheduled') THEN
    v_notify_kind := 'status';
    v_should_notify := true;
  ELSIF NEW.event_type = 'eta_updated' THEN
    -- Only notify when ETA slipped LATER (a delay)
    IF NEW.previous_eta IS NOT NULL AND NEW.new_eta IS NOT NULL AND NEW.new_eta > NEW.previous_eta THEN
      v_notify_kind := 'eta';
      v_should_notify := true;
    END IF;
  ELSIF NEW.event_type = 'rejoined' THEN
    v_notify_kind := 'rejoin';
    v_should_notify := true;
  ELSE
    RETURN NEW;
  END IF;

  IF NOT v_should_notify THEN RETURN NEW; END IF;

  -- Load (or default) preferences
  SELECT * INTO v_prefs FROM public.travel_notification_preferences WHERE profile_id = NEW.profile_id;
  IF NOT FOUND THEN
    -- Defaults: in-app on, all categories on
    v_prefs.in_app_enabled := true;
    v_prefs.notify_status_changes := true;
    v_prefs.notify_eta_delays := true;
    v_prefs.notify_rejoin_available := true;
  END IF;

  IF NOT v_prefs.in_app_enabled THEN RETURN NEW; END IF;
  IF v_notify_kind = 'status' AND NOT v_prefs.notify_status_changes THEN RETURN NEW; END IF;
  IF v_notify_kind = 'eta'    AND NOT v_prefs.notify_eta_delays    THEN RETURN NEW; END IF;
  IF v_notify_kind = 'rejoin' AND NOT v_prefs.notify_rejoin_available THEN RETURN NEW; END IF;

  -- Resolve city names for nicer copy
  IF NEW.from_city_id IS NOT NULL THEN
    SELECT name INTO v_from FROM public.cities WHERE id = NEW.from_city_id;
  END IF;
  IF NEW.to_city_id IS NOT NULL THEN
    SELECT name INTO v_to FROM public.cities WHERE id = NEW.to_city_id;
  END IF;

  CASE NEW.event_type
    WHEN 'departed'    THEN v_title := 'Travel: Departed';
                            v_message := format('Leg in progress%s%s.', CASE WHEN v_from IS NOT NULL THEN ' from ' || v_from ELSE '' END, CASE WHEN v_to IS NOT NULL THEN ' to ' || v_to ELSE '' END);
    WHEN 'arrived'     THEN v_title := 'Travel: Arrived';
                            v_message := format('Arrived%s.', CASE WHEN v_to IS NOT NULL THEN ' in ' || v_to ELSE '' END);
    WHEN 'cancelled'   THEN v_title := 'Travel: Cancelled';
                            v_message := format('Travel leg%s%s was cancelled.', CASE WHEN v_from IS NOT NULL THEN ' from ' || v_from ELSE '' END, CASE WHEN v_to IS NOT NULL THEN ' to ' || v_to ELSE '' END);
                            v_priority := 'high';
    WHEN 'rescheduled' THEN v_title := 'Travel: Rescheduled';
                            v_message := 'Your travel was rescheduled — check the timeline for new dates.';
                            v_priority := 'high';
    WHEN 'eta_updated' THEN v_title := 'Travel: Delay';
                            v_message := format('ETA pushed back to %s%s.', to_char(NEW.new_eta AT TIME ZONE 'UTC', 'Mon DD HH24:MI UTC'), CASE WHEN v_to IS NOT NULL THEN ' (arriving in ' || v_to || ')' ELSE '' END);
                            v_priority := 'high';
    WHEN 'rejoined'    THEN v_title := 'Tour Catch-up Available';
                            v_message := COALESCE(NEW.message, 'Rejoined tour transport.');
    ELSE v_title := 'Travel update'; v_message := COALESCE(NEW.message, 'Travel status updated.');
  END CASE;

  INSERT INTO public.player_inbox (
    user_id, category, priority, title, message,
    metadata, action_type, action_data,
    related_entity_type, related_entity_id
  ) VALUES (
    v_target_user, 'system', v_priority, v_title, v_message,
    jsonb_build_object(
      'event_type', NEW.event_type,
      'tour_id', NEW.tour_id,
      'tour_leg_id', NEW.tour_leg_id,
      'from_city_id', NEW.from_city_id,
      'to_city_id', NEW.to_city_id,
      'previous_eta', NEW.previous_eta,
      'new_eta', NEW.new_eta,
      'kind', v_notify_kind,
      'email_opt_in', COALESCE(v_prefs.email_enabled, false)
    ),
    'navigate',
    jsonb_build_object('route', '/travel', 'tab', 'history'),
    'travel_timeline_event', NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_travel_timeline_event ON public.travel_timeline_events;
CREATE TRIGGER trg_notify_travel_timeline_event
AFTER INSERT ON public.travel_timeline_events
FOR EACH ROW EXECUTE FUNCTION public.notify_travel_timeline_event();
