-- Phase 4: project private DJ booking reservations into canonical character
-- calendar in the SAME transaction, and defend both sides against tampering.
-- No player booking UI, paid settlement, or new rewards are activated here.

ALTER TABLE public.player_scheduled_activities
 ADD COLUMN IF NOT EXISTS linked_dj_booking_id uuid
 REFERENCES public.dj_bookings(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS psa_unique_linked_dj_booking
 ON public.player_scheduled_activities(linked_dj_booking_id)
 WHERE linked_dj_booking_id IS NOT NULL;

-- Retain the existing allowed activity types, adding the new type.
ALTER TABLE public.player_scheduled_activities
 DROP CONSTRAINT IF EXISTS player_scheduled_activities_activity_type_check;
ALTER TABLE public.player_scheduled_activities
 ADD CONSTRAINT player_scheduled_activities_activity_type_check
 CHECK (activity_type=ANY(ARRAY[
  'gig','rehearsal','recording','jam','songwriting','travel','tour',
  'education','work','performance','booking','busking','university',
  'reading','mentorship','youtube_video','health','skill_practice',
  'open_mic','pr_appearance','self_promotion','film_production','jam_session',
  'festival_attendance','festival_performance','release_manufacturing',
  'release_promo','teaching','wellness_fitness','wellness_mindfulness',
  'wellness_rest','wellness_recovery','wellness_medical','wellness_indulgence',
  'social_activity','major_event','other','dj_set'
 ]));

ALTER TABLE public.player_scheduled_activities
 ADD CONSTRAINT dj_schedule_link_requires_type
 CHECK (linked_dj_booking_id IS NULL OR activity_type='dj_set');

-- Trigger fires on all schedule writes: synchronizes profile lock with
-- internal DJ booking RPC, blocks overlapping newly added activities and
-- forbids spoofed DJ entries or editing a system-managed DJ reservation.
CREATE OR REPLACE FUNCTION public.guard_canonical_dj_schedule()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE
  v_trusted boolean := current_user IN ('postgres','service_role');
  v_link uuid;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.linked_dj_booking_id IS NOT NULL AND NOT v_trusted THEN
      RAISE EXCEPTION 'Managed DJ calendar entries cannot be deleted directly'
       USING ERRCODE='42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.profile_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('dj:profile:'||NEW.profile_id::text)::bigint);
  END IF;

  IF TG_OP='UPDATE' AND OLD.linked_dj_booking_id IS NOT NULL
     AND NOT v_trusted THEN
    RAISE EXCEPTION 'Managed DJ calendar entries cannot be edited directly'
      USING ERRCODE='42501';
  END IF;

  IF NOT v_trusted AND
    (NEW.linked_dj_booking_id IS NOT NULL OR NEW.activity_type='dj_set')
  THEN
    RAISE EXCEPTION 'DJ calendar entries require server-side reservation'
      USING ERRCODE='42501';
  END IF;

  IF NEW.linked_dj_booking_id IS NOT NULL THEN
    SELECT b.id INTO v_link
    FROM public.dj_bookings b
    WHERE b.id=NEW.linked_dj_booking_id
      AND b.profile_id=NEW.profile_id AND b.user_id=NEW.user_id
      AND b.starts_at=NEW.scheduled_start AND b.ends_at=NEW.scheduled_end;
    IF v_link IS NULL THEN
      RAISE EXCEPTION 'DJ calendar entry does not match its reservation'
        USING ERRCODE='22023';
    END IF;
  END IF;

  IF NEW.status IN ('scheduled','in_progress') AND EXISTS (
    SELECT 1 FROM public.dj_bookings b
    WHERE b.profile_id=NEW.profile_id
      AND b.status IN ('booked','ready','live','resolving')
      AND b.id IS DISTINCT FROM NEW.linked_dj_booking_id
      AND b.starts_at<NEW.scheduled_end
      AND b.ends_at>NEW.scheduled_start
  ) THEN
    RAISE EXCEPTION 'This activity conflicts with an existing DJ reservation'
      USING ERRCODE='23P01';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_canonical_dj_schedule() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_canonical_dj_schedule_write ON public.player_scheduled_activities;
CREATE TRIGGER guard_canonical_dj_schedule_write
 BEFORE INSERT OR UPDATE OR DELETE ON public.player_scheduled_activities
 FOR EACH ROW EXECUTE FUNCTION public.guard_canonical_dj_schedule();

-- The booking function inserts the parent booking. This AFTER trigger writes
-- its corresponding player calendar row atomically or rolls everything back.
CREATE OR REPLACE FUNCTION public.project_dj_booking_into_calendar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
 v_club text;
 v_city text;
 v_status text;
BEGIN
 SELECT n.name,c.name INTO v_club,v_city
 FROM public.city_night_clubs n JOIN public.cities c ON c.id=n.city_id
 WHERE n.id=NEW.club_id;
 IF v_club IS NULL THEN
   RAISE EXCEPTION 'DJ club missing for calendar projection' USING ERRCODE='22023';
 END IF;
 v_status := CASE NEW.status
   WHEN 'booked' THEN 'scheduled'
   WHEN 'ready' THEN 'scheduled'
   WHEN 'live' THEN 'in_progress'
   WHEN 'resolving' THEN 'in_progress'
   WHEN 'completed' THEN 'completed'
   WHEN 'cancelled' THEN 'cancelled'
   WHEN 'missed' THEN 'missed'
   ELSE 'scheduled' END;

 IF TG_OP='INSERT' THEN
   INSERT INTO public.player_scheduled_activities(
      user_id,profile_id,activity_type,
      scheduled_start,scheduled_end,duration_minutes,status,
      title,description,location,linked_dj_booking_id,metadata)
   VALUES (
      NEW.user_id,NEW.profile_id,'dj_set',
      NEW.starts_at,NEW.ends_at,
      ceil(extract(epoch FROM NEW.ends_at-NEW.starts_at)/60)::integer,
      v_status,'DJ set · '||v_club,
      'Nightclub DJ performance reservation — preparation only',
      coalesce(v_city,'')||' · '||v_club,NEW.id,
      jsonb_build_object(
        'dj_booking_id',NEW.id,
        'dj_club_id',NEW.club_id,
        'dj_setlist_id',NEW.setlist_id,
        'dj_setlist_version',NEW.setlist_version,
        'system_managed',true)
   );
 ELSE
   UPDATE public.player_scheduled_activities a
     SET status=v_status,
       scheduled_start=NEW.starts_at,
       scheduled_end=NEW.ends_at,
       duration_minutes=ceil(extract(epoch FROM NEW.ends_at-NEW.starts_at)/60)::integer,
       updated_at=now()
    WHERE a.linked_dj_booking_id=NEW.id;
   IF NOT FOUND THEN
     RAISE EXCEPTION 'DJ booking calendar entry is missing'
       USING ERRCODE='23503';
   END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.project_dj_booking_into_calendar() FROM PUBLIC;

DROP TRIGGER IF EXISTS project_dj_booking_to_calendar_insert ON public.dj_bookings;
CREATE TRIGGER project_dj_booking_to_calendar_insert
 AFTER INSERT ON public.dj_bookings FOR EACH ROW
 EXECUTE FUNCTION public.project_dj_booking_into_calendar();

DROP TRIGGER IF EXISTS project_dj_booking_to_calendar_update ON public.dj_bookings;
CREATE TRIGGER project_dj_booking_to_calendar_update
 AFTER UPDATE OF status,starts_at,ends_at ON public.dj_bookings
 FOR EACH ROW
 WHEN (
   OLD.status IS DISTINCT FROM NEW.status OR
   OLD.starts_at IS DISTINCT FROM NEW.starts_at OR
   OLD.ends_at IS DISTINCT FROM NEW.ends_at
 )
 EXECUTE FUNCTION public.project_dj_booking_into_calendar();

-- Cancellation is still private (service_role-only). Requires original
-- actor, a pre-start booking, and updates the mirrored calendar in one tx.
CREATE OR REPLACE FUNCTION public.cancel_dj_booking_internal(p_booking_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid := (SELECT auth.uid()); v_row public.dj_bookings%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_booking_id IS NULL THEN
   RAISE EXCEPTION 'Authenticated DJ booking owner required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_row FROM public.dj_bookings
  WHERE id=p_booking_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DJ booking not owned by actor' USING ERRCODE='42501'; END IF;
 IF v_row.status='cancelled' THEN RETURN v_row.id; END IF;
 IF v_row.status NOT IN ('booked','ready') OR v_row.starts_at<=now() THEN
   RAISE EXCEPTION 'DJ booking cannot be cancelled after it starts'
     USING ERRCODE='22023';
 END IF;
 UPDATE public.dj_bookings SET status='cancelled',updated_at=now()
  WHERE id=v_row.id;
 RETURN v_row.id;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_dj_booking_internal(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_dj_booking_internal(uuid) TO service_role;

COMMENT ON COLUMN public.player_scheduled_activities.linked_dj_booking_id IS
 'Canonical server-managed DJ slot; source of truth is dj_bookings. Client edits/deletes forbidden.';
