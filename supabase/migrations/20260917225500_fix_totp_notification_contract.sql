-- Top of the Pops notification compatibility with the current notifications schema.
-- TOTP originally shipped while category/title were optional. They are now required.

CREATE OR REPLACE FUNCTION public.totp_normalize_notification_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.action_path = '/top-of-the-pops'
     OR coalesce(NEW.title, '') = 'Top of the Pops'
     OR coalesce(NEW.message, '') LIKE 'Top of the Pops%' THEN
    NEW.category := coalesce(NEW.category, 'career');
    NEW.title := coalesce(NEW.title, 'Top of the Pops');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS totp_normalize_notification_contract ON public.notifications;
CREATE TRIGGER totp_normalize_notification_contract
BEFORE INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.totp_normalize_notification_contract();

CREATE OR REPLACE FUNCTION public.totp_notify_new_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leader_user uuid;
  v_band_name text;
  v_song_title text;
  v_episode_date date;
BEGIN
  SELECT p.user_id, b.name::text
  INTO v_leader_user, v_band_name
  FROM public.bands b
  JOIN public.profiles p ON p.id = b.leader_id
  WHERE b.id = NEW.band_id;

  SELECT title INTO v_song_title
  FROM public.songs
  WHERE id = NEW.song_id;

  SELECT episode_date INTO v_episode_date
  FROM public.totp_episodes
  WHERE id = NEW.episode_id;

  IF v_leader_user IS NOT NULL THEN
    INSERT INTO public.notifications(
      user_id, category, type, title, message, action_path, metadata
    ) VALUES (
      v_leader_user,
      'career',
      'info',
      'Top of the Pops',
      format(
        'Top of the Pops invitation! %s is invited to London on %s to perform %s, currently #%s in the qualifying UK chart.',
        v_band_name,
        v_episode_date,
        v_song_title,
        NEW.qualifying_rank
      ),
      '/top-of-the-pops',
      jsonb_build_object(
        'episode_id', NEW.episode_id,
        'invitation_id', NEW.id,
        'band_id', NEW.band_id,
        'song_id', NEW.song_id,
        'qualifying_rank', NEW.qualifying_rank
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_notify_new_invitation() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.totp_normalize_notification_contract() IS
  'Compatibility guard that supplies required category/title values only for Top of the Pops notifications emitted by older TOTP server functions.';
