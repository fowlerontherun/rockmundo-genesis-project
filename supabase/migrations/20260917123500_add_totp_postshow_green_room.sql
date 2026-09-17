-- Top of the Pops phase 5: one deterministic post-performance green-room interaction.
-- Outcomes affect reputation, fan sentiment and media intensity only. No fame, charts, cash or eligibility effects.

CREATE TABLE IF NOT EXISTS public.totp_postshow_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id uuid NOT NULL UNIQUE REFERENCES public.totp_performances(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  prompt_key text NOT NULL,
  selected_choice text,
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (prompt_key IN ('press_line','fan_barrier','green_room_wrap','producer_chat')),
  CHECK (selected_choice IS NULL OR selected_choice IN ('press','fans','band'))
);

CREATE INDEX IF NOT EXISTS totp_postshow_interactions_band_idx
  ON public.totp_postshow_interactions (band_id, created_at DESC);

ALTER TABLE public.totp_postshow_interactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.totp_postshow_interactions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_seed_postshow_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket integer;
  v_prompt text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;

  v_bucket := abs(hashtext(NEW.performance_id::text || ':postshow')) % 4;
  v_prompt := CASE v_bucket
    WHEN 0 THEN 'press_line'
    WHEN 1 THEN 'fan_barrier'
    WHEN 2 THEN 'green_room_wrap'
    ELSE 'producer_chat'
  END;

  INSERT INTO public.totp_postshow_interactions (
    performance_id, episode_id, band_id, prompt_key
  ) VALUES (
    NEW.performance_id, NEW.episode_id, NEW.band_id, v_prompt
  )
  ON CONFLICT (performance_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_seed_postshow_interaction() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS totp_seed_postshow_interaction_trigger ON public.totp_appearance_history;
CREATE TRIGGER totp_seed_postshow_interaction_trigger
AFTER INSERT ON public.totp_appearance_history
FOR EACH ROW
EXECUTE FUNCTION public.totp_seed_postshow_interaction();

CREATE OR REPLACE FUNCTION public.totp_my_postshow_interactions()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,
    'performance_id',i.performance_id,
    'episode_id',i.episode_id,
    'band_id',i.band_id,
    'band_name',b.name,
    'prompt_key',i.prompt_key,
    'selected_choice',i.selected_choice,
    'effects',i.effects,
    'created_at',i.created_at,
    'resolved_at',i.resolved_at
  ) ORDER BY i.created_at DESC),'[]'::jsonb)
  FROM public.totp_postshow_interactions i
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

REVOKE ALL ON FUNCTION public.totp_my_postshow_interactions() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totp_my_postshow_interactions() TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_choose_postshow_interaction(
  p_interaction_id uuid,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interaction public.totp_postshow_interactions%ROWTYPE;
  v_rep numeric := 0;
  v_sentiment numeric := 0;
  v_media numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_choice NOT IN ('press','fans','band') THEN
    RAISE EXCEPTION 'Choose a valid post-show response';
  END IF;

  SELECT * INTO v_interaction
  FROM public.totp_postshow_interactions
  WHERE id=p_interaction_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Top of the Pops post-show interaction not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bands b
    JOIN public.profiles p ON p.id=b.leader_id
    WHERE b.id=v_interaction.band_id AND p.user_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the band leader can choose the post-show response';
  END IF;

  IF v_interaction.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status','already_resolved',
      'choice',v_interaction.selected_choice,
      'effects',v_interaction.effects
    );
  END IF;

  CASE p_choice
    WHEN 'press' THEN
      v_rep := 0.5; v_media := 2.0;
    WHEN 'fans' THEN
      v_sentiment := 2.0; v_media := 0.5;
    WHEN 'band' THEN
      v_rep := 1.0; v_sentiment := 0.5;
  END CASE;

  UPDATE public.bands
  SET reputation_score = greatest(0,coalesce(reputation_score,0) + v_rep),
      fan_sentiment_score = greatest(-100,least(100,coalesce(fan_sentiment_score,0) + v_sentiment)),
      media_intensity = greatest(0,coalesce(media_intensity,0) + v_media)
  WHERE id=v_interaction.band_id;

  UPDATE public.totp_postshow_interactions
  SET selected_choice=p_choice,
      effects=jsonb_build_object(
        'reputation',v_rep,
        'fan_sentiment',v_sentiment,
        'media_intensity',v_media,
        'fame_effect',0,
        'chart_effect',0,
        'cash_effect',0,
        'eligibility_effect',0
      ),
      resolved_at=now()
  WHERE id=v_interaction.id
  RETURNING * INTO v_interaction;

  RETURN jsonb_build_object(
    'status','resolved',
    'choice',v_interaction.selected_choice,
    'effects',v_interaction.effects
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_choose_postshow_interaction(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totp_choose_postshow_interaction(uuid,text) TO authenticated;

COMMENT ON TABLE public.totp_postshow_interactions IS
  'One deterministic post-performance TOTP green-room interaction per appearance. Social/reputation flavour only; never changes fame, charts, cash or eligibility.';
