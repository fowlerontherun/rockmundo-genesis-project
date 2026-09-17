-- Top of the Pops Phase 4 media reactions.
-- One official RockMundo Television post is created for each completed appearance.
-- Appearance history is already idempotent, and this table adds a second duplicate guard.

INSERT INTO public.twaater_accounts (
  owner_type,
  owner_id,
  handle,
  display_name,
  verified,
  fame_score,
  follower_count,
  following_count,
  bio,
  location
)
VALUES (
  'bot'::public.twaater_owner_type,
  '74f96691-e5e5-4d7a-b5a6-2a0c7ba3db6f'::uuid,
  'rockmundo_tv',
  'RockMundo Television',
  true,
  100000,
  0,
  0,
  'Official RockMundo Television account. Top of the Pops, chart broadcasts and studio news.',
  'London'
)
ON CONFLICT (handle) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  verified = true,
  bio = EXCLUDED.bio,
  location = EXCLUDED.location;

CREATE TABLE IF NOT EXISTS public.totp_media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id uuid NOT NULL UNIQUE REFERENCES public.totp_performances(id) ON DELETE CASCADE,
  appearance_history_id uuid NOT NULL UNIQUE REFERENCES public.totp_appearance_history(id) ON DELETE CASCADE,
  twaat_id uuid NOT NULL UNIQUE REFERENCES public.twaats(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.twaater_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.totp_media_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.totp_media_posts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_publish_media_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_twaat_id uuid;
  v_band_name text;
  v_song_title text;
  v_body text;
  v_milestone text := NULL;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.totp_media_posts WHERE performance_id = NEW.performance_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_account_id
  FROM public.twaater_accounts
  WHERE handle = 'rockmundo_tv'
  LIMIT 1;

  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT b.name::text, s.title
  INTO v_band_name, v_song_title
  FROM public.bands b
  JOIN public.songs s ON s.id = NEW.song_id
  WHERE b.id = NEW.band_id;

  v_milestone := CASE NEW.appearance_number
    WHEN 50 THEN ' A landmark 50th Top of the Pops appearance.'
    WHEN 25 THEN ' Their 25th Top of the Pops appearance — a true television institution.'
    WHEN 10 THEN ' Their 10th appearance on the show.'
    WHEN 5 THEN ' Their 5th Top of the Pops appearance.'
    ELSE NULL
  END;

  v_body := CASE
    WHEN NEW.qualifying_rank = 1 THEN
      format('Tonight on Top of the Pops: %s performed “%s” as the UK number one.%s',
        v_band_name, v_song_title, coalesce(v_milestone, ''))
    WHEN NEW.appearance_number = 1 THEN
      format('TV debut! %s brought “%s” (#%s) to the Top of the Pops studio tonight.',
        v_band_name, v_song_title, NEW.qualifying_rank)
    WHEN NEW.qualifying_rank <= 10 THEN
      format('Top 10 on television: %s performed “%s” at #%s on Top of the Pops.%s',
        v_band_name, v_song_title, NEW.qualifying_rank, coalesce(v_milestone, ''))
    ELSE
      format('%s brought “%s” (#%s) to the Top of the Pops studio tonight.%s',
        v_band_name, v_song_title, NEW.qualifying_rank, coalesce(v_milestone, ''))
  END;

  INSERT INTO public.twaats (
    account_id,
    body,
    lang,
    sentiment,
    visibility,
    is_system_review,
    xp_awarded
  )
  VALUES (
    v_account_id,
    left(v_body, 500),
    'en',
    CASE WHEN NEW.qualifying_rank <= 10 THEN 2 ELSE 1 END,
    'public'::public.twaater_visibility,
    true,
    0
  )
  RETURNING id INTO v_twaat_id;

  INSERT INTO public.totp_media_posts (
    performance_id,
    appearance_history_id,
    twaat_id,
    account_id
  )
  VALUES (
    NEW.performance_id,
    NEW.id,
    v_twaat_id,
    v_account_id
  )
  ON CONFLICT (performance_id) DO NOTHING;

  UPDATE public.twaater_accounts
  SET last_post_at = now(),
      posts_today = coalesce(posts_today, 0) + 1,
      updated_at = now()
  WHERE id = v_account_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_publish_media_reaction() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS totp_publish_media_reaction ON public.totp_appearance_history;
CREATE TRIGGER totp_publish_media_reaction
AFTER INSERT ON public.totp_appearance_history
FOR EACH ROW
EXECUTE FUNCTION public.totp_publish_media_reaction();

COMMENT ON TABLE public.totp_media_posts IS 'Audit link between completed Top of the Pops appearances and official RockMundo Television Twaater posts.';
COMMENT ON FUNCTION public.totp_publish_media_reaction() IS 'Publishes exactly one official Twaater reaction per completed Top of the Pops performance.';
