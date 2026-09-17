-- Top of the Pops phase 5: deterministic live-TV incidents, performance styles and studio audience reactions.
-- All random-looking outcomes are seeded server-side from immutable invitation/performance ids so refreshes cannot reroll them.
-- Production incidents never affect charts, cash or TOTP eligibility.

CREATE TABLE IF NOT EXISTS public.totp_live_tv_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES public.totp_invitations(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  audience_reaction integer NOT NULL DEFAULT 0 CHECK (audience_reaction BETWEEN -5 AND 5),
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_key IN ('camera_rehearsal','fan_chant','broken_string','late_floor_manager','celebrity_green_room','mic_check'))
);

CREATE TABLE IF NOT EXISTS public.totp_performance_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES public.totp_invitations(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  selected_style text,
  fame_multiplier numeric(5,3) NOT NULL DEFAULT 1.000 CHECK (fame_multiplier BETWEEN 0.950 AND 1.100),
  audience_reaction integer NOT NULL DEFAULT 0 CHECK (audience_reaction BETWEEN -5 AND 5),
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  selected_at timestamptz,
  applied_at timestamptz,
  CHECK (selected_style IS NULL OR selected_style IN ('polished','crowd_first','raw_live'))
);

CREATE INDEX IF NOT EXISTS totp_live_tv_events_episode_idx ON public.totp_live_tv_events (episode_id, created_at);
CREATE INDEX IF NOT EXISTS totp_performance_styles_episode_idx ON public.totp_performance_styles (episode_id, created_at);

ALTER TABLE public.totp_live_tv_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.totp_performance_styles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.totp_live_tv_events FROM anon, authenticated;
REVOKE ALL ON public.totp_performance_styles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_seed_live_tv_extras()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket integer;
  v_event_key text;
  v_title text;
  v_description text;
  v_reaction integer := 0;
  v_rep numeric := 0;
  v_sentiment numeric := 0;
  v_media numeric := 0;
BEGIN
  IF NEW.status <> 'checked_in' OR OLD.status = 'checked_in' THEN
    RETURN NEW;
  END IF;

  v_bucket := abs(hashtext(NEW.id::text || ':' || NEW.episode_id::text || ':live-tv')) % 6;
  CASE v_bucket
    WHEN 0 THEN
      v_event_key := 'camera_rehearsal';
      v_title := 'Extra camera rehearsal';
      v_description := 'The director gives the band an extra camera-blocking rehearsal before transmission.';
      v_reaction := 1; v_rep := 0.5;
    WHEN 1 THEN
      v_event_key := 'fan_chant';
      v_title := 'Fans start a chant';
      v_description := 'The studio audience starts chanting the band name before the floor manager has even cued applause.';
      v_reaction := 3; v_sentiment := 1.0; v_media := 0.5;
    WHEN 2 THEN
      v_event_key := 'broken_string';
      v_title := 'Broken string in rehearsal';
      v_description := 'A string snaps during the final rehearsal. The crew gets the instrument swapped before broadcast.';
      v_reaction := -1; v_rep := 0.5;
    WHEN 3 THEN
      v_event_key := 'late_floor_manager';
      v_title := 'Floor-manager scramble';
      v_description := 'A last-second studio timing change has the floor team moving everyone thirty seconds before the cue.';
      v_reaction := -1; v_media := 0.5;
    WHEN 4 THEN
      v_event_key := 'celebrity_green_room';
      v_title := 'Green-room encounter';
      v_description := 'Another chart act drops by the green room, creating a small burst of backstage buzz.';
      v_reaction := 1; v_media := 1.0;
    ELSE
      v_event_key := 'mic_check';
      v_title := 'Perfect mic check';
      v_description := 'The broadcast engineer locks the vocal mix immediately and the studio audience hears the warm-up clearly.';
      v_reaction := 2; v_sentiment := 0.5; v_rep := 0.5;
  END CASE;

  INSERT INTO public.totp_live_tv_events (
    invitation_id,episode_id,band_id,event_key,title,description,audience_reaction,effects
  ) VALUES (
    NEW.id,NEW.episode_id,NEW.band_id,v_event_key,v_title,v_description,v_reaction,
    jsonb_build_object(
      'reputation',v_rep,
      'fan_sentiment',v_sentiment,
      'media_intensity',v_media,
      'chart_effect',0,
      'cash_effect',0,
      'eligibility_effect',0
    )
  ) ON CONFLICT (invitation_id) DO NOTHING;

  UPDATE public.bands
  SET reputation_score = greatest(0,coalesce(reputation_score,0) + v_rep),
      fan_sentiment_score = greatest(-100,least(100,coalesce(fan_sentiment_score,0) + v_sentiment)),
      media_intensity = greatest(0,coalesce(media_intensity,0) + v_media)
  WHERE id=NEW.band_id;

  INSERT INTO public.totp_performance_styles (invitation_id,episode_id,band_id)
  VALUES (NEW.id,NEW.episode_id,NEW.band_id)
  ON CONFLICT (invitation_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS totp_seed_live_tv_extras_trigger ON public.totp_invitations;
CREATE TRIGGER totp_seed_live_tv_extras_trigger
AFTER UPDATE OF status ON public.totp_invitations
FOR EACH ROW
EXECUTE FUNCTION public.totp_seed_live_tv_extras();

CREATE OR REPLACE FUNCTION public.totp_my_live_tv_extras()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'events',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,
        'invitation_id',e.invitation_id,
        'episode_id',e.episode_id,
        'band_id',e.band_id,
        'event_key',e.event_key,
        'title',e.title,
        'description',e.description,
        'audience_reaction',e.audience_reaction,
        'effects',e.effects,
        'created_at',e.created_at
      ) ORDER BY e.created_at DESC)
      FROM public.totp_live_tv_events e
      WHERE EXISTS (
        SELECT 1 FROM public.band_members bm
        JOIN public.profiles p ON p.id=bm.profile_id
        WHERE bm.band_id=e.band_id AND p.user_id=auth.uid()
          AND coalesce(bm.member_status,'active')='active'
      )
    ),'[]'::jsonb),
    'styles',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',s.id,
        'invitation_id',s.invitation_id,
        'episode_id',s.episode_id,
        'band_id',s.band_id,
        'selected_style',s.selected_style,
        'fame_multiplier',s.fame_multiplier,
        'audience_reaction',s.audience_reaction,
        'effects',s.effects,
        'created_at',s.created_at,
        'selected_at',s.selected_at,
        'applied_at',s.applied_at
      ) ORDER BY s.created_at DESC)
      FROM public.totp_performance_styles s
      WHERE EXISTS (
        SELECT 1 FROM public.band_members bm
        JOIN public.profiles p ON p.id=bm.profile_id
        WHERE bm.band_id=s.band_id AND p.user_id=auth.uid()
          AND coalesce(bm.member_status,'active')='active'
      )
    ),'[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.totp_my_live_tv_extras() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totp_my_live_tv_extras() TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_choose_performance_style(
  p_style_id uuid,
  p_style text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_style public.totp_performance_styles%ROWTYPE;
  v_multiplier numeric := 1.000;
  v_reaction integer := 0;
  v_rep numeric := 0;
  v_sentiment numeric := 0;
  v_media numeric := 0;
  v_risk_bucket integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_style NOT IN ('polished','crowd_first','raw_live') THEN
    RAISE EXCEPTION 'Choose a valid performance style';
  END IF;

  SELECT * INTO v_style FROM public.totp_performance_styles WHERE id=p_style_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Top of the Pops performance style not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bands b
    JOIN public.profiles p ON p.id=b.leader_id
    WHERE b.id=v_style.band_id AND p.user_id=auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the band leader can choose the performance style';
  END IF;

  IF v_style.selected_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status','already_selected',
      'style',v_style.selected_style,
      'fame_multiplier',v_style.fame_multiplier,
      'audience_reaction',v_style.audience_reaction,
      'effects',v_style.effects
    );
  END IF;

  CASE p_style
    WHEN 'polished' THEN
      v_multiplier := 1.030; v_reaction := 1; v_rep := 1.0; v_media := 0.5;
    WHEN 'crowd_first' THEN
      v_multiplier := 1.050; v_reaction := 3; v_sentiment := 1.5; v_media := 0.5;
    WHEN 'raw_live' THEN
      v_risk_bucket := abs(hashtext(v_style.invitation_id::text || ':raw-live')) % 4;
      IF v_risk_bucket = 0 THEN
        v_multiplier := 0.970; v_reaction := -1; v_media := 1.0;
      ELSE
        v_multiplier := 1.080; v_reaction := 4; v_media := 2.0;
      END IF;
  END CASE;

  UPDATE public.bands
  SET reputation_score = greatest(0,coalesce(reputation_score,0) + v_rep),
      fan_sentiment_score = greatest(-100,least(100,coalesce(fan_sentiment_score,0) + v_sentiment)),
      media_intensity = greatest(0,coalesce(media_intensity,0) + v_media)
  WHERE id=v_style.band_id;

  UPDATE public.totp_performance_styles
  SET selected_style=p_style,
      fame_multiplier=v_multiplier,
      audience_reaction=v_reaction,
      effects=jsonb_build_object(
        'reputation',v_rep,
        'fan_sentiment',v_sentiment,
        'media_intensity',v_media,
        'chart_effect',0,
        'cash_effect',0
      ),
      selected_at=now()
  WHERE id=v_style.id;

  RETURN jsonb_build_object(
    'status','selected',
    'style',p_style,
    'fame_multiplier',v_multiplier,
    'audience_reaction',v_reaction,
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

REVOKE ALL ON FUNCTION public.totp_choose_performance_style(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totp_choose_performance_style(uuid,text) TO authenticated;

-- Apply only the incremental fame delta from the chosen performance style after the
-- authoritative base TOTP settlement has created appearance history. The trigger runs
-- once because totp_appearance_history.performance_id is unique and applied_at is locked.
CREATE OR REPLACE FUNCTION public.totp_apply_performance_style_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_style public.totp_performance_styles%ROWTYPE;
  v_perf public.totp_performances%ROWTYPE;
  v_bonus integer := 0;
  v_member record;
  v_member_share integer := 0;
BEGIN
  SELECT * INTO v_perf FROM public.totp_performances WHERE id=NEW.performance_id;
  IF v_perf.id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_style
  FROM public.totp_performance_styles
  WHERE invitation_id=v_perf.invitation_id
  FOR UPDATE;

  IF v_style.id IS NULL OR v_style.selected_style IS NULL OR v_style.applied_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_bonus := round(NEW.fame_awarded * (v_style.fame_multiplier - 1.0));

  IF v_bonus <> 0 THEN
    UPDATE public.bands
    SET collective_fame_earned = greatest(0,coalesce(collective_fame_earned,0) + v_bonus),
        fame = greatest(0,coalesce(fame,0) + v_bonus),
        last_fame_calculation = now()
    WHERE id=NEW.band_id;

    FOR v_member IN
      SELECT bm.profile_id
      FROM public.band_members bm
      WHERE bm.band_id=NEW.band_id
        AND bm.profile_id IS NOT NULL
        AND coalesce(bm.member_status,'active')='active'
        AND coalesce(bm.is_touring_member,false)=false
    LOOP
      v_member_share := round(v_bonus * 0.30);
      IF v_member_share <> 0 THEN
        UPDATE public.profiles
        SET fame=greatest(0,coalesce(fame,0)+v_member_share)
        WHERE id=v_member.profile_id;
      END IF;
    END LOOP;

    INSERT INTO public.band_fame_events (band_id,event_type,fame_gained,event_data)
    VALUES (
      NEW.band_id,'top_of_the_pops_style',v_bonus,
      jsonb_build_object(
        'performance_id',NEW.performance_id,
        'style',v_style.selected_style,
        'fame_multiplier',v_style.fame_multiplier,
        'base_fame',NEW.fame_awarded
      )
    );

    UPDATE public.totp_performances
    SET fame_awarded=greatest(0,coalesce(fame_awarded,0)+v_bonus)
    WHERE id=NEW.performance_id;

    NEW.fame_awarded := greatest(0,NEW.fame_awarded + v_bonus);
  END IF;

  UPDATE public.totp_performance_styles SET applied_at=now() WHERE id=v_style.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS totp_apply_performance_style_bonus_trigger ON public.totp_appearance_history;
CREATE TRIGGER totp_apply_performance_style_bonus_trigger
BEFORE INSERT ON public.totp_appearance_history
FOR EACH ROW
EXECUTE FUNCTION public.totp_apply_performance_style_bonus();

COMMENT ON TABLE public.totp_live_tv_events IS
  'Deterministic harmless live-TV production incidents generated once at TOTP check-in.';
COMMENT ON TABLE public.totp_performance_styles IS
  'Leader-selected TOTP performance style with a bounded one-time fame modifier and studio-audience reaction.';
