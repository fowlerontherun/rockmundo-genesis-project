-- Top of the Pops phase 5: deterministic guest presenters and milestone presentation variants.
-- Presenter selection is episode-driven, never player-driven, and is frozen into canonical replay payloads.

ALTER TABLE public.totp_episodes
  ADD COLUMN IF NOT EXISTS show_variant text NOT NULL DEFAULT 'regular';

ALTER TABLE public.totp_episodes
  DROP CONSTRAINT IF EXISTS totp_episodes_show_variant_check;
ALTER TABLE public.totp_episodes
  ADD CONSTRAINT totp_episodes_show_variant_check
  CHECK (show_variant IN ('regular','guest_host','milestone'));

CREATE OR REPLACE FUNCTION public.totp_presenter_key_for_episode(p_episode_number bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN mod(p_episode_number,25) = 0 THEN 'alex_rayne'
    WHEN mod(p_episode_number,5) = 0 THEN
      CASE mod((p_episode_number / 5)::integer - 1,3)
        WHEN 0 THEN 'maya_stone'
        WHEN 1 THEN 'jack_mercer'
        ELSE 'nia_vale'
      END
    ELSE 'alex_rayne'
  END;
$$;

CREATE OR REPLACE FUNCTION public.totp_show_variant_for_episode(p_episode_number bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN mod(p_episode_number,25) = 0 THEN 'milestone'
    WHEN mod(p_episode_number,5) = 0 THEN 'guest_host'
    ELSE 'regular'
  END;
$$;

CREATE OR REPLACE FUNCTION public.totp_presenter_display_name(p_presenter_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_presenter_key
    WHEN 'maya_stone' THEN 'Maya Stone'
    WHEN 'jack_mercer' THEN 'Jack Mercer'
    WHEN 'nia_vale' THEN 'Nia Vale'
    ELSE 'Alex Rayne'
  END;
$$;

CREATE OR REPLACE FUNCTION public.totp_presenter_intro(
  p_presenter_key text,
  p_show_variant text,
  p_rank integer,
  p_band_name text,
  p_song_title text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_show_variant = 'milestone' THEN
    RETURN format('A milestone night on Top of the Pops — at number %s, welcome %s performing %s!', p_rank, p_band_name, p_song_title);
  END IF;

  RETURN CASE p_presenter_key
    WHEN 'maya_stone' THEN format('Chart watchers, this is Maya Stone. At number %s, give it up for %s with %s!', p_rank, p_band_name, p_song_title)
    WHEN 'jack_mercer' THEN format('London, make some noise. At number %s this week, here are %s performing %s!', p_rank, p_band_name, p_song_title)
    WHEN 'nia_vale' THEN format('Tonight on RockMundo Television, number %s belongs to %s with %s. Here they are!', p_rank, p_band_name, p_song_title)
    ELSE format('At number %s this week, please welcome %s performing %s!', p_rank, p_band_name, p_song_title)
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_assign_episode_presentation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.totp_episodes
  SET presenter_key = public.totp_presenter_key_for_episode(NEW.episode_number),
      show_variant = public.totp_show_variant_for_episode(NEW.episode_number),
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_assign_episode_presentation() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS totp_assign_episode_presentation_trigger ON public.totp_episodes;
CREATE TRIGGER totp_assign_episode_presentation_trigger
AFTER INSERT ON public.totp_episodes
FOR EACH ROW
EXECUTE FUNCTION public.totp_assign_episode_presentation();

-- Backfill any episodes created before this migration.
UPDATE public.totp_episodes
SET presenter_key = public.totp_presenter_key_for_episode(episode_number),
    show_variant = public.totp_show_variant_for_episode(episode_number),
    updated_at = now();

CREATE OR REPLACE FUNCTION public.totp_public_episode(p_episode_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
  v_performances jsonb;
BEGIN
  IF p_episode_id IS NULL THEN
    SELECT * INTO v_episode FROM public.totp_episodes WHERE status <> 'cancelled'
    ORDER BY CASE WHEN broadcast_at >= now() THEN 0 ELSE 1 END, CASE WHEN broadcast_at >= now() THEN broadcast_at END ASC, broadcast_at DESC LIMIT 1;
  ELSE
    SELECT * INTO v_episode FROM public.totp_episodes WHERE id = p_episode_id AND status <> 'cancelled';
  END IF;
  IF v_episode.id IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'performance_id', tp.id,
      'running_order', tp.running_order,
      'band_id', tp.band_id,
      'band_name', b.name,
      'song_id', tp.song_id,
      'song_title', s.title,
      'stage_key', CASE WHEN tp.stage_key = 'secondary_stage' THEN 'stage_b' ELSE tp.stage_key END,
      'presenter_intro', tp.presenter_intro,
      'qualifying_rank', i.qualifying_rank
    ) ORDER BY tp.running_order), '[]'::jsonb)
  INTO v_performances
  FROM public.totp_performances tp
  JOIN public.bands b ON b.id = tp.band_id
  JOIN public.songs s ON s.id = tp.song_id
  JOIN public.totp_invitations i ON i.id = tp.invitation_id
  WHERE tp.episode_id = v_episode.id;

  RETURN jsonb_build_object(
    'id', v_episode.id,
    'episode_number', v_episode.episode_number,
    'episode_date', v_episode.episode_date,
    'status', v_episode.status,
    'check_in_at', v_episode.check_in_at,
    'broadcast_at', v_episode.broadcast_at,
    'presenter_key', v_episode.presenter_key,
    'presenter_display_name', public.totp_presenter_display_name(v_episode.presenter_key),
    'show_variant', v_episode.show_variant,
    'broadcast_profile', v_episode.broadcast_profile,
    'performances', v_performances
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_public_episode(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_public_episode(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_admin_lock_running_order(p_episode_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_episode FROM public.totp_episodes WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Top of the Pops episode not found'; END IF;
  IF v_episode.status IN ('completed', 'cancelled') THEN RAISE EXCEPTION 'This episode can no longer be changed'; END IF;
  DELETE FROM public.totp_performances WHERE episode_id = p_episode_id AND completed_at IS NULL;

  WITH eligible_base AS (
    SELECT i.id AS invitation_id, i.band_id, i.song_id, i.qualifying_rank, s.genre,
      md5(p_episode_id::text || ':' || i.band_id::text || ':' || i.song_id::text) AS editorial_key
    FROM public.totp_invitations i
    JOIN public.songs s ON s.id = i.song_id
    WHERE i.episode_id = p_episode_id AND i.status = 'checked_in'
  ),
  eligible AS (
    SELECT *, row_number() OVER (
      ORDER BY CASE WHEN qualifying_rank = 1 THEN 1 ELSE 0 END ASC, editorial_key ASC
    ) AS running_order
    FROM eligible_base
  )
  INSERT INTO public.totp_performances (episode_id, invitation_id, band_id, song_id, running_order, stage_key, camera_profile, presenter_intro)
  SELECT p_episode_id, e.invitation_id, e.band_id, e.song_id, e.running_order,
    CASE WHEN lower(coalesce(e.genre, '')) ~ '(rock|metal|punk|grunge|hardcore)' THEN 'rock_stage' WHEN e.qualifying_rank <= 5 THEN 'main_stage' WHEN mod(e.running_order, 3) = 0 THEN 'studio_floor' ELSE 'stage_b' END,
    'totp_classic', public.totp_presenter_intro(v_episode.presenter_key,v_episode.show_variant,e.qualifying_rank,b.name::text,s.title)
  FROM eligible e JOIN public.bands b ON b.id = e.band_id JOIN public.songs s ON s.id = e.song_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.totp_episodes SET status = 'locked', updated_at = now() WHERE id = p_episode_id;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_lock_running_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_lock_running_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_lock_presenter_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
BEGIN
  SELECT * INTO v_episode FROM public.totp_episodes WHERE id = NEW.episode_id;
  IF v_episode.id IS NULL THEN RETURN NEW; END IF;

  NEW.payload := NEW.payload || jsonb_build_object(
    'presenterKey',v_episode.presenter_key,
    'presenterDisplayName',public.totp_presenter_display_name(v_episode.presenter_key),
    'showVariant',v_episode.show_variant
  );
  NEW.presenter_key := v_episode.presenter_key;
  NEW.replay_version := greatest(3,NEW.replay_version);
  NEW.checksum := md5(NEW.payload::text);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_lock_presenter_snapshot() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS totp_lock_presenter_snapshot_trigger ON public.totp_broadcast_replays;
CREATE TRIGGER totp_lock_presenter_snapshot_trigger
BEFORE INSERT ON public.totp_broadcast_replays
FOR EACH ROW
EXECUTE FUNCTION public.totp_lock_presenter_snapshot();

COMMENT ON COLUMN public.totp_episodes.show_variant IS
  'Deterministic presentation variant: regular, guest-host edition or milestone edition.';
COMMENT ON FUNCTION public.totp_presenter_key_for_episode(bigint) IS
  'Episode-driven presenter rotation. Every fifth episode is guest-hosted except every 25th milestone show.';
