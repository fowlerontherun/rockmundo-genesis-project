-- Targeted production reconciliation of missing durable music event notifications.
-- No payout, wallet, history backfill, or cron changes.
BEGIN;

-- The existing unkeyed 90-second fallback must not suppress distinct keyed
-- events belonging to different characters or different songs.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_game_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $f$
BEGIN
  IF nullif(NEW.metadata->>'event_key','') IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = NEW.user_id
      AND n.profile_id IS NOT DISTINCT FROM NEW.profile_id
      AND n.category = NEW.category AND n.title = NEW.title
      AND n.message = NEW.message
      AND nullif(n.metadata->>'event_key','') IS NULL
      AND n.created_at >= now() - interval '90 seconds'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$f$;
REVOKE ALL ON FUNCTION public.prevent_duplicate_game_notification()
  FROM PUBLIC, anon, authenticated;

-- Internal helper. Its only callers are trusted SQL triggers and a validated
-- profile-owned reconciliation RPC.
CREATE OR REPLACE FUNCTION public.rockmundo_persist_music_event(
  p_user_id uuid, p_profile_id uuid, p_key text, p_category text,
  p_type text, p_title text, p_message text, p_path text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_key IS NULL OR length(p_key)>190
     OR p_key !~ '^(recording_completed|audio_generated|audio_failed):[0-9a-f-]{36}$'
  THEN RETURN false; END IF;
  IF p_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id=p_profile_id AND user_id=p_user_id AND deleted_at IS NULL
  ) THEN RETURN false; END IF;
  INSERT INTO public.notifications
    (user_id,profile_id,category,type,title,message,action_path,metadata)
  VALUES
    (p_user_id,p_profile_id,p_category,p_type,left(p_title,240),
     left(p_message,2000),p_path,
     jsonb_build_object('event_key',p_key,'source','game_event'))
  ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$f$;
REVOKE ALL ON FUNCTION public.rockmundo_persist_music_event(
  uuid,uuid,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rockmundo_persist_music_event(
  uuid,uuid,text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.rockmundo_music_event_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE
  v_key text; v_cat text; v_type text; v_title text; v_message text;
  v_path text; v_band uuid; v_profile uuid; v_user uuid; v_song_title text;
  v_rec record;
BEGIN
  IF TG_TABLE_NAME='recording_sessions' THEN
    IF NEW.status IS DISTINCT FROM 'completed'
       OR OLD.status IS NOT DISTINCT FROM 'completed' THEN RETURN NEW; END IF;
    v_key:='recording_completed:'||NEW.id::text;
    v_cat:='recording'; v_type:='success'; v_title:='Recording Complete!';
    v_path:='/recording-studio'; v_band:=NEW.band_id;
    v_profile:=NEW.profile_id; v_user:=NEW.user_id;
    SELECT title INTO v_song_title FROM public.songs WHERE id=NEW.song_id;
    v_message:='Recording completed for "'||coalesce(v_song_title,'your song')||'".';
  ELSIF TG_TABLE_NAME='songs' THEN
    IF OLD.audio_generation_status IS DISTINCT FROM 'generating'
       OR NEW.audio_generation_status NOT IN ('completed','failed')
    THEN RETURN NEW; END IF;
    v_band:=NEW.band_id; v_profile:=NEW.profile_id; v_user:=NEW.user_id;
    v_path:='/song-catalog';
    IF NEW.audio_generation_status='completed' THEN
      v_key:='audio_generated:'||NEW.id::text; v_cat:='record_label';
      v_type:='success'; v_title:='🎵 Audio Generated!';
      v_message:='AI audio for "'||coalesce(NEW.title,'your song')||'" is ready to play!';
    ELSE
      v_key:='audio_failed:'||NEW.id::text; v_cat:='recording';
      v_type:='warning'; v_title:='Audio Generation Failed';
      v_message:='Could not generate audio for "'||coalesce(NEW.title,'your song')||'". Try again later.';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Deliver independently to the canonical owner and current active band
  -- characters, never arbitrary users supplied by the client.
  FOR v_rec IN
    SELECT DISTINCT p.user_id,p.id AS profile_id FROM public.profiles p
    WHERE p.deleted_at IS NULL AND (
      p.id=v_profile OR
      (v_band IS NOT NULL AND EXISTS(
        SELECT 1 FROM public.band_members bm
        WHERE bm.band_id=v_band AND bm.profile_id=p.id
          AND bm.member_status='active'))
    )
  LOOP
    PERFORM public.rockmundo_persist_music_event(
      v_rec.user_id,v_rec.profile_id,v_key,v_cat,v_type,v_title,v_message,v_path);
  END LOOP;

  -- Account-owned solo songs without a canonical character remain account
  -- notifications rather than being assigned to a random active character.
  IF v_profile IS NULL AND v_band IS NULL AND v_user IS NOT NULL THEN
    PERFORM public.rockmundo_persist_music_event(
      v_user,NULL,v_key,v_cat,v_type,v_title,v_message,v_path);
  END IF;
  RETURN NEW;
END;
$f$;
REVOKE ALL ON FUNCTION public.rockmundo_music_event_on_change()
  FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS rockmundo_recording_durable_notification ON public.recording_sessions;
CREATE TRIGGER rockmundo_recording_durable_notification
AFTER UPDATE OF status ON public.recording_sessions
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status='completed')
EXECUTE FUNCTION public.rockmundo_music_event_on_change();

DROP TRIGGER IF EXISTS rockmundo_audio_durable_notification ON public.songs;
CREATE TRIGGER rockmundo_audio_durable_notification
AFTER UPDATE OF audio_generation_status ON public.songs
FOR EACH ROW WHEN (OLD.audio_generation_status='generating' AND
                   NEW.audio_generation_status IN ('completed','failed'))
EXECUTE FUNCTION public.rockmundo_music_event_on_change();

-- Called on login, reconnect, and return to the game. Read-only scan of the
-- caller's own events; adds only missing recent events and never changes gameplay.
CREATE OR REPLACE FUNCTION public.reconcile_my_game_notifications(p_profile_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $f$
DECLARE v_user uuid:=auth.uid(); v_row record; v_count integer:=0; v_key text;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=p_profile_id AND p.user_id=v_user
      AND p.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'NOTIFICATION_RECONCILIATION_FORBIDDEN' USING ERRCODE='42501'; END IF;

  FOR v_row IN
    SELECT r.id,r.completed_at,r.song_id,coalesce(s.title,'your song') AS title
    FROM public.recording_sessions r LEFT JOIN public.songs s ON s.id=r.song_id
    WHERE r.status='completed' AND r.completed_at>=now()-interval '72 hours'
      AND (r.profile_id=p_profile_id OR
           (r.band_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.band_members bm
              WHERE bm.band_id=r.band_id AND bm.profile_id=p_profile_id
                AND bm.member_status='active')))
  LOOP
    v_key:='recording_completed:'||v_row.id::text;
    -- Legacy browser-generated notifications lacked event keys.
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id=v_user AND n.profile_id=p_profile_id
      AND (n.metadata->>'event_key'=v_key
        OR (n.category='recording' AND n.title ILIKE 'Recording Complete%'
        AND n.created_at BETWEEN v_row.completed_at-interval '5 minutes'
                             AND v_row.completed_at+interval '10 minutes'))
    ) THEN
      IF public.rockmundo_persist_music_event(
        v_user,p_profile_id,v_key,'recording','success',
        'Recording Complete!','Recording completed for "'||v_row.title||'".',
        '/recording-studio')
      THEN v_count:=v_count+1; END IF;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT s.id,s.title,s.audio_generation_status,s.audio_generated_at,s.updated_at
    FROM public.songs s
    WHERE s.audio_generation_status IN ('completed','failed')
      AND (CASE WHEN s.audio_generation_status='completed'
                THEN coalesce(s.audio_generated_at,s.updated_at)
                ELSE s.updated_at END)>=now()-interval '72 hours'
      AND (s.profile_id=p_profile_id OR (s.band_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM public.band_members bm WHERE bm.band_id=s.band_id
          AND bm.profile_id=p_profile_id AND bm.member_status='active')))
  LOOP
    IF v_row.audio_generation_status='completed' THEN
      v_key:='audio_generated:'||v_row.id::text;
    ELSE
      v_key:='audio_failed:'||v_row.id::text;
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM public.notifications n
      WHERE n.user_id=v_user AND n.profile_id=p_profile_id
        AND (n.metadata->>'event_key'=v_key
          OR (n.title=CASE WHEN v_row.audio_generation_status='completed'
                           THEN '🎵 Audio Generated!' ELSE 'Audio Generation Failed' END
              AND n.created_at BETWEEN coalesce(v_row.audio_generated_at,v_row.updated_at)-interval '5 minutes'
                                   AND coalesce(v_row.audio_generated_at,v_row.updated_at)+interval '10 minutes'))
    ) THEN
      IF v_row.audio_generation_status='completed' THEN
        IF public.rockmundo_persist_music_event(
          v_user,p_profile_id,v_key,'record_label','success',
          '🎵 Audio Generated!','AI audio for "'||coalesce(v_row.title,'your song')||'" is ready to play!',
          '/song-catalog')
        THEN v_count:=v_count+1; END IF;
      ELSE
        IF public.rockmundo_persist_music_event(
          v_user,p_profile_id,v_key,'recording','warning',
          'Audio Generation Failed','Could not generate audio for "'||coalesce(v_row.title,'your song')||'". Try again later.',
          '/song-catalog')
        THEN v_count:=v_count+1; END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$f$;
REVOKE ALL ON FUNCTION public.reconcile_my_game_notifications(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_my_game_notifications(uuid) TO authenticated;

COMMIT;