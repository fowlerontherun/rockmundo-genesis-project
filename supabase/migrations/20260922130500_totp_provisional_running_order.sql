-- Keep an editable provisional TOTP running order in sync with accepted invitations.
-- Accepted = production-confirmed; physical studio check-in remains a separate live-day gate.

CREATE OR REPLACE FUNCTION public.totp_refresh_provisional_running_order(p_episode_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_episode
  FROM public.totp_episodes
  WHERE id = p_episode_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_episode.status NOT IN ('scheduled', 'inviting') THEN
    SELECT count(*)::integer INTO v_count
    FROM public.totp_performances
    WHERE episode_id = p_episode_id;
    RETURN v_count;
  END IF;

  DELETE FROM public.totp_performances
  WHERE episode_id = p_episode_id
    AND completed_at IS NULL;

  WITH confirmed_base AS (
    SELECT
      i.id AS invitation_id,
      i.band_id,
      i.song_id,
      i.qualifying_rank,
      s.genre,
      md5(p_episode_id::text || ':' || i.band_id::text || ':' || i.song_id::text) AS editorial_key
    FROM public.totp_invitations i
    JOIN public.songs s ON s.id = i.song_id
    WHERE i.episode_id = p_episode_id
      AND i.status IN ('accepted', 'checked_in')
  ),
  confirmed AS (
    SELECT *,
      row_number() OVER (
        ORDER BY CASE WHEN qualifying_rank = 1 THEN 1 ELSE 0 END ASC, editorial_key ASC
      ) AS running_order
    FROM confirmed_base
  )
  INSERT INTO public.totp_performances (
    episode_id, invitation_id, band_id, song_id, running_order,
    stage_key, camera_profile, presenter_intro
  )
  SELECT
    p_episode_id,
    c.invitation_id,
    c.band_id,
    c.song_id,
    c.running_order,
    CASE
      WHEN lower(coalesce(c.genre, '')) ~ '(rock|metal|punk|grunge|hardcore)' THEN 'rock_stage'
      WHEN c.qualifying_rank <= 5 THEN 'main_stage'
      WHEN mod(c.running_order, 3) = 0 THEN 'studio_floor'
      ELSE 'stage_b'
    END,
    'totp_classic',
    public.totp_presenter_intro(
      v_episode.presenter_key,
      v_episode.show_variant,
      c.qualifying_rank,
      b.name::text,
      s.title
    )
  FROM confirmed c
  JOIN public.bands b ON b.id = c.band_id
  JOIN public.songs s ON s.id = c.song_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.totp_refresh_provisional_running_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_refresh_provisional_running_order(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.totp_sync_provisional_running_order_from_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_episode_id uuid;
BEGIN
  v_episode_id := coalesce(NEW.episode_id, OLD.episode_id);

  IF TG_OP = 'INSERT'
     OR TG_OP = 'DELETE'
     OR OLD.status IS DISTINCT FROM NEW.status
     OR OLD.song_id IS DISTINCT FROM NEW.song_id
     OR OLD.qualifying_rank IS DISTINCT FROM NEW.qualifying_rank THEN
    PERFORM public.totp_refresh_provisional_running_order(v_episode_id);
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_totp_sync_provisional_running_order ON public.totp_invitations;
CREATE TRIGGER trg_totp_sync_provisional_running_order
AFTER INSERT OR UPDATE OR DELETE ON public.totp_invitations
FOR EACH ROW
EXECUTE FUNCTION public.totp_sync_provisional_running_order_from_invitation();

CREATE OR REPLACE FUNCTION public.totp_admin_lock_running_order(p_episode_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_episode
  FROM public.totp_episodes
  WHERE id = p_episode_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top of the Pops episode not found';
  END IF;

  IF v_episode.status IN ('completed', 'cancelled', 'broadcast') THEN
    RAISE EXCEPTION 'This episode can no longer be changed';
  END IF;

  DELETE FROM public.totp_performances
  WHERE episode_id = p_episode_id
    AND completed_at IS NULL;

  WITH confirmed_base AS (
    SELECT
      i.id AS invitation_id,
      i.band_id,
      i.song_id,
      i.qualifying_rank,
      s.genre,
      md5(p_episode_id::text || ':' || i.band_id::text || ':' || i.song_id::text) AS editorial_key
    FROM public.totp_invitations i
    JOIN public.songs s ON s.id = i.song_id
    WHERE i.episode_id = p_episode_id
      AND i.status IN ('accepted', 'checked_in')
  ),
  confirmed AS (
    SELECT *,
      row_number() OVER (
        ORDER BY CASE WHEN qualifying_rank = 1 THEN 1 ELSE 0 END ASC, editorial_key ASC
      ) AS running_order
    FROM confirmed_base
  )
  INSERT INTO public.totp_performances (
    episode_id, invitation_id, band_id, song_id, running_order,
    stage_key, camera_profile, presenter_intro
  )
  SELECT
    p_episode_id,
    c.invitation_id,
    c.band_id,
    c.song_id,
    c.running_order,
    CASE
      WHEN lower(coalesce(c.genre, '')) ~ '(rock|metal|punk|grunge|hardcore)' THEN 'rock_stage'
      WHEN c.qualifying_rank <= 5 THEN 'main_stage'
      WHEN mod(c.running_order, 3) = 0 THEN 'studio_floor'
      ELSE 'stage_b'
    END,
    'totp_classic',
    public.totp_presenter_intro(
      v_episode.presenter_key,
      v_episode.show_variant,
      c.qualifying_rank,
      b.name::text,
      s.title
    )
  FROM confirmed c
  JOIN public.bands b ON b.id = c.band_id
  JOIN public.songs s ON s.id = c.song_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No accepted Top of the Pops invitations are available to lock';
  END IF;

  UPDATE public.totp_episodes
  SET status = 'locked', updated_at = now()
  WHERE id = p_episode_id;

  RETURN v_count;
END;
$function$;

DO $do$
DECLARE
  v_episode_id uuid;
BEGIN
  FOR v_episode_id IN
    SELECT id
    FROM public.totp_episodes
    WHERE status IN ('scheduled', 'inviting')
  LOOP
    PERFORM public.totp_refresh_provisional_running_order(v_episode_id);
  END LOOP;
END;
$do$;
