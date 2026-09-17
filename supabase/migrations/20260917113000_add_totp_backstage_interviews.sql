-- Top of the Pops phase 5: deterministic backstage presenter interviews.
-- Choices can affect reputation, fan sentiment and media intensity only. They never touch charts, cash or eligibility.

CREATE TABLE IF NOT EXISTS public.totp_backstage_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES public.totp_invitations(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  prompt_key text NOT NULL,
  selected_choice text,
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (selected_choice IS NULL OR selected_choice IN ('confident','humble','cheeky'))
);

CREATE INDEX IF NOT EXISTS totp_backstage_interactions_episode_idx
  ON public.totp_backstage_interactions (episode_id, created_at);

ALTER TABLE public.totp_backstage_interactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.totp_backstage_interactions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_seed_backstage_interview()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prompt text;
  v_bucket integer;
BEGIN
  IF NEW.status <> 'checked_in' OR OLD.status = 'checked_in' THEN
    RETURN NEW;
  END IF;

  v_bucket := abs(hashtext(NEW.id::text || ':' || NEW.episode_id::text)) % 4;
  v_prompt := CASE v_bucket
    WHEN 0 THEN 'first_impressions'
    WHEN 1 THEN 'chart_pressure'
    WHEN 2 THEN 'fans_waiting'
    ELSE 'live_television'
  END;

  INSERT INTO public.totp_backstage_interactions (invitation_id,episode_id,band_id,prompt_key)
  VALUES (NEW.id,NEW.episode_id,NEW.band_id,v_prompt)
  ON CONFLICT (invitation_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS totp_seed_backstage_interview_trigger ON public.totp_invitations;
CREATE TRIGGER totp_seed_backstage_interview_trigger
AFTER UPDATE OF status ON public.totp_invitations
FOR EACH ROW
EXECUTE FUNCTION public.totp_seed_backstage_interview();

CREATE OR REPLACE FUNCTION public.totp_my_backstage_interactions()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,
    'invitation_id',i.invitation_id,
    'episode_id',i.episode_id,
    'band_id',i.band_id,
    'band_name',b.name,
    'prompt_key',i.prompt_key,
    'selected_choice',i.selected_choice,
    'effects',i.effects,
    'created_at',i.created_at,
    'resolved_at',i.resolved_at
  ) ORDER BY i.created_at DESC),'[]'::jsonb)
  FROM public.totp_backstage_interactions i
  JOIN public.bands b ON b.id=i.band_id
  WHERE EXISTS (
    SELECT 1
    FROM public.band_members bm
    JOIN public.profiles p ON p.id=bm.profile_id
    WHERE bm.band_id=i.band_id
      AND p.user_id=auth.uid()
      AND coalesce(bm.member_status,'active')='active'
  );
$$;

REVOKE ALL ON FUNCTION public.totp_my_backstage_interactions() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totp_my_backstage_interactions() TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_choose_backstage_interview(
  p_interaction_id uuid,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interaction public.totp_backstage_interactions%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_rep numeric := 0;
  v_sentiment numeric := 0;
  v_media numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_choice NOT IN ('confident','humble','cheeky') THEN
    RAISE EXCEPTION 'Choose a valid interview response';
  END IF;

  SELECT * INTO v_interaction
  FROM public.totp_backstage_interactions
  WHERE id=p_interaction_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Backstage interview not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.bands b
    JOIN public.profiles p ON p.id=b.leader_id
    WHERE b.id=v_interaction.band_id AND p.user_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the band leader can answer the interview';
  END IF;

  IF v_interaction.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status','already_resolved',
      'choice',v_interaction.selected_choice,
      'effects',v_interaction.effects
    );
  END IF;

  SELECT * INTO v_band FROM public.bands WHERE id=v_interaction.band_id FOR UPDATE;

  CASE p_choice
    WHEN 'confident' THEN
      v_rep := 1.0; v_sentiment := 0.5; v_media := 2.0;
    WHEN 'humble' THEN
      v_rep := 0.5; v_sentiment := 2.0; v_media := 0.5;
    WHEN 'cheeky' THEN
      v_rep := 0.0; v_sentiment := -0.5; v_media := 3.0;
  END CASE;

  UPDATE public.bands
  SET reputation_score = greatest(0,coalesce(reputation_score,0) + v_rep),
      fan_sentiment_score = greatest(-100,least(100,coalesce(fan_sentiment_score,0) + v_sentiment)),
      media_intensity = greatest(0,coalesce(media_intensity,0) + v_media)
  WHERE id=v_interaction.band_id;

  UPDATE public.totp_backstage_interactions
  SET selected_choice=p_choice,
      effects=jsonb_build_object(
        'reputation',v_rep,
        'fan_sentiment',v_sentiment,
        'media_intensity',v_media,
        'chart_effect',0,
        'cash_effect',0
      ),
      resolved_at=now()
  WHERE id=v_interaction.id;

  RETURN jsonb_build_object(
    'status','resolved',
    'choice',p_choice,
    'effects',jsonb_build_object(
      'reputation',v_rep,
      'fan_sentiment',v_sentiment,
      'media_intensity',v_media,
      'chart_effect',0,
      'cash_effect',0
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_choose_backstage_interview(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totp_choose_backstage_interview(uuid,text) TO authenticated;

COMMENT ON TABLE public.totp_backstage_interactions IS
  'One deterministic Alex Rayne backstage interview per checked-in TOTP invitation. Player choices affect social/reputation metrics only.';
