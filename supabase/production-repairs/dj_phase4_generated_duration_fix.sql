-- Follow-up migration: player_scheduled_activities.duration_minutes is GENERATED ALWAYS
-- AS (scheduled_end - scheduled_start) / 60. Never insert or update it directly.
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
      scheduled_start,scheduled_end,status,
      title,description,location,linked_dj_booking_id,metadata)
   VALUES (
      NEW.user_id,NEW.profile_id,'dj_set',
      NEW.starts_at,NEW.ends_at,
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
