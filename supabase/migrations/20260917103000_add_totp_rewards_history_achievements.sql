-- Top of the Pops phase 4: one-time fame rewards, permanent appearance history and achievements.
-- Rewards are authoritative and idempotent. Archive playback never calls these functions.
-- This migration deliberately supports both the current legacy achievement schema and
-- the newer canonical schema present in repository migrations but not yet live everywhere.

CREATE TABLE IF NOT EXISTS public.totp_appearance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id uuid NOT NULL UNIQUE REFERENCES public.totp_performances(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  episode_number bigint NOT NULL,
  episode_date date NOT NULL,
  running_order integer NOT NULL,
  stage_key text NOT NULL,
  qualifying_rank integer NOT NULL CHECK (qualifying_rank BETWEEN 1 AND 40),
  appearance_number integer NOT NULL CHECK (appearance_number >= 1),
  raw_fame_reward integer NOT NULL DEFAULT 0 CHECK (raw_fame_reward >= 0),
  fame_awarded integer NOT NULL DEFAULT 0 CHECK (fame_awarded >= 0),
  presenter_intro text,
  completed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (band_id, appearance_number)
);

CREATE INDEX IF NOT EXISTS totp_appearance_history_band_date_idx
  ON public.totp_appearance_history (band_id, episode_date DESC);
CREATE INDEX IF NOT EXISTS totp_appearance_history_episode_idx
  ON public.totp_appearance_history (episode_id, running_order);

ALTER TABLE public.totp_appearance_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.totp_appearance_history FROM anon, authenticated;

ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS achievements_slug_unique ON public.achievements(slug) WHERE slug IS NOT NULL;

WITH rows(slug,name,description,rarity,icon) AS (VALUES
  ('totp-tv-debut','TV Debut','Perform on Top of the Pops for the first time.','common','tv'),
  ('totp-top-20-performer','Top 20 Performer','Perform on Top of the Pops with a song in the UK Top 20.','rare','radio'),
  ('totp-top-10-performer','Top 10 Performer','Perform on Top of the Pops with a song in the UK Top 10.','epic','trophy'),
  ('totp-number-one','Top of the Pops','Perform on Top of the Pops while your song is UK number one.','legendary','crown'),
  ('totp-household-name','Household Name','Make 5 Top of the Pops appearances.','rare','star'),
  ('totp-television-regular','Television Regular','Make 10 Top of the Pops appearances.','epic','tv'),
  ('totp-pop-institution','Pop Institution','Make 25 Top of the Pops appearances.','legendary','award'),
  ('totp-legend-of-the-pops','Legend of the Pops','Make 50 Top of the Pops appearances.','legendary','crown')
)
INSERT INTO public.achievements (slug,name,description,category,rarity,icon,requirements,rewards)
SELECT r.slug,r.name,r.description,'performance',r.rarity,r.icon,
       jsonb_build_object('source','top_of_the_pops'),'{}'::jsonb
FROM rows r
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  icon = EXCLUDED.icon,
  requirements = EXCLUDED.requirements;

CREATE TABLE IF NOT EXISTS public.totp_achievement_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id uuid NOT NULL REFERENCES public.totp_performances(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_slug text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (performance_id, profile_id, achievement_slug)
);
ALTER TABLE public.totp_achievement_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.totp_achievement_settlements FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_award_achievement(
  p_profile_id uuid,
  p_achievement_slug text,
  p_performance_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_achievement_id uuid;
  v_user_id uuid;
  v_inserted uuid;
BEGIN
  SELECT id INTO v_achievement_id
  FROM public.achievements
  WHERE slug = p_achievement_slug
  LIMIT 1;
  IF v_achievement_id IS NULL THEN RETURN false; END IF;

  INSERT INTO public.totp_achievement_settlements(performance_id,profile_id,achievement_slug)
  VALUES (p_performance_id,p_profile_id,p_achievement_slug)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN false; END IF;

  SELECT user_id INTO v_user_id FROM public.profiles WHERE id = p_profile_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.player_achievements
    WHERE profile_id = p_profile_id AND achievement_id = v_achievement_id
  ) THEN
    INSERT INTO public.player_achievements(user_id,profile_id,achievement_id,progress,unlocked_at)
    VALUES (v_user_id,p_profile_id,v_achievement_id,'{}'::jsonb,now());
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_award_achievement(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totp_award_achievement(uuid,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.totp_raw_fame_for_rank(p_rank integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_rank = 1 THEN 1000
    WHEN p_rank <= 3 THEN 800
    WHEN p_rank <= 10 THEN 600
    WHEN p_rank <= 20 THEN 400
    WHEN p_rank <= 30 THEN 250
    ELSE 150
  END;
$$;

CREATE OR REPLACE FUNCTION public.totp_complete_performance(
  p_performance_id uuid,
  p_performance_score integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perf public.totp_performances%ROWTYPE;
  v_episode public.totp_episodes%ROWTYPE;
  v_inv public.totp_invitations%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_prior_appearances integer := 0;
  v_appearance_number integer := 1;
  v_raw_fame integer := 0;
  v_lifetime_factor numeric := 1;
  v_progression_factor numeric := 1;
  v_effective_fame integer := 0;
  v_member record;
  v_member_share integer;
  v_history_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_perf
  FROM public.totp_performances
  WHERE id = p_performance_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Top of the Pops performance not found'; END IF;

  SELECT h.id INTO v_history_id
  FROM public.totp_appearance_history h
  WHERE h.performance_id = p_performance_id;
  IF v_history_id IS NOT NULL THEN
    RETURN (
      SELECT jsonb_build_object(
        'status','already_completed','performance_id',h.performance_id,
        'appearance_number',h.appearance_number,'fame_awarded',h.fame_awarded,
        'qualifying_rank',h.qualifying_rank
      )
      FROM public.totp_appearance_history h WHERE h.id = v_history_id
    );
  END IF;

  SELECT * INTO v_episode FROM public.totp_episodes WHERE id = v_perf.episode_id;
  SELECT * INTO v_inv FROM public.totp_invitations WHERE id = v_perf.invitation_id;
  SELECT * INTO v_band FROM public.bands WHERE id = v_perf.band_id FOR UPDATE;
  IF v_episode.id IS NULL OR v_inv.id IS NULL OR v_band.id IS NULL THEN
    RAISE EXCEPTION 'Top of the Pops completion data is incomplete';
  END IF;
  IF v_inv.status NOT IN ('checked_in','performed') THEN
    RAISE EXCEPTION 'Only a checked-in Top of the Pops act can complete a performance';
  END IF;

  SELECT count(*) INTO v_prior_appearances
  FROM public.totp_appearance_history WHERE band_id = v_perf.band_id;
  v_appearance_number := v_prior_appearances + 1;
  v_raw_fame := public.totp_raw_fame_for_rank(v_inv.qualifying_rank);
  IF v_appearance_number = 1 THEN v_raw_fame := round(v_raw_fame * 1.20); END IF;

  v_lifetime_factor := greatest(0.60, 1.0 / (1.0 + (v_prior_appearances * 0.04)));
  v_progression_factor := 1.0 / (1.0 + (ln(1.0 + greatest(0,coalesce(v_band.collective_fame_earned,0))) / ln(10.0)) / 5.0);
  v_effective_fame := greatest(1, round(v_raw_fame * v_lifetime_factor * v_progression_factor));

  UPDATE public.bands
  SET collective_fame_earned = coalesce(collective_fame_earned,0) + v_effective_fame,
      fame = coalesce(fame,0) + v_effective_fame,
      last_fame_calculation = now()
  WHERE id = v_perf.band_id;

  INSERT INTO public.band_fame_events(band_id,event_type,fame_gained,event_data)
  VALUES (v_perf.band_id,'top_of_the_pops',v_effective_fame,jsonb_build_object(
    'performance_id',v_perf.id,'episode_id',v_perf.episode_id,'episode_number',v_episode.episode_number,
    'qualifying_rank',v_inv.qualifying_rank,'appearance_number',v_appearance_number,
    'raw_fame_gain',v_raw_fame,'lifetime_factor',v_lifetime_factor,'progression_factor',v_progression_factor
  ));

  FOR v_member IN
    SELECT bm.profile_id,bm.vocal_role
    FROM public.band_members bm
    WHERE bm.band_id = v_perf.band_id
      AND bm.profile_id IS NOT NULL
      AND coalesce(bm.member_status,'active') = 'active'
      AND coalesce(bm.is_touring_member,false) = false
  LOOP
    v_member_share := round(v_effective_fame * 0.30);
    IF lower(coalesce(v_member.vocal_role,'')) LIKE '%lead%' THEN v_member_share := round(v_member_share * 1.20); END IF;
    IF v_member.profile_id = v_band.leader_id THEN v_member_share := round(v_member_share * 1.15); END IF;
    UPDATE public.profiles SET fame = coalesce(fame,0) + greatest(1,v_member_share) WHERE id = v_member.profile_id;
  END LOOP;

  UPDATE public.totp_performances
  SET performance_score = CASE WHEN p_performance_score IS NULL THEN performance_score ELSE greatest(0,least(100,p_performance_score)) END,
      fame_awarded = v_effective_fame,
      completed_at = coalesce(completed_at,now())
  WHERE id = v_perf.id;
  UPDATE public.totp_invitations SET status='performed',updated_at=now() WHERE id=v_inv.id;

  INSERT INTO public.totp_appearance_history(
    performance_id,episode_id,band_id,song_id,episode_number,episode_date,running_order,
    stage_key,qualifying_rank,appearance_number,raw_fame_reward,fame_awarded,presenter_intro,completed_at
  ) VALUES (
    v_perf.id,v_perf.episode_id,v_perf.band_id,v_perf.song_id,v_episode.episode_number,v_episode.episode_date,
    v_perf.running_order,v_perf.stage_key,v_inv.qualifying_rank,v_appearance_number,v_raw_fame,v_effective_fame,
    v_perf.presenter_intro,now()
  ) RETURNING id INTO v_history_id;

  FOR v_member IN
    SELECT bm.profile_id
    FROM public.band_members bm
    WHERE bm.band_id=v_perf.band_id AND bm.profile_id IS NOT NULL
      AND coalesce(bm.member_status,'active')='active'
      AND coalesce(bm.is_touring_member,false)=false
  LOOP
    PERFORM public.totp_award_achievement(v_member.profile_id,'totp-tv-debut',v_perf.id);
    IF v_inv.qualifying_rank <= 20 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-top-20-performer',v_perf.id); END IF;
    IF v_inv.qualifying_rank <= 10 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-top-10-performer',v_perf.id); END IF;
    IF v_inv.qualifying_rank = 1 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-number-one',v_perf.id); END IF;
    IF v_appearance_number >= 5 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-household-name',v_perf.id); END IF;
    IF v_appearance_number >= 10 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-television-regular',v_perf.id); END IF;
    IF v_appearance_number >= 25 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-pop-institution',v_perf.id); END IF;
    IF v_appearance_number >= 50 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-legend-of-the-pops',v_perf.id); END IF;
  END LOOP;

  INSERT INTO public.notifications(user_id,type,title,message,action_path,metadata)
  SELECT DISTINCT bm.user_id,'system','Top of the Pops',
    format('Top of the Pops complete: %s earned %s fame from its #%s appearance.',v_band.name,v_effective_fame,v_inv.qualifying_rank),
    '/top-of-the-pops',jsonb_build_object('performance_id',v_perf.id,'episode_id',v_perf.episode_id)
  FROM public.band_members bm
  WHERE bm.band_id=v_perf.band_id AND bm.user_id IS NOT NULL
    AND coalesce(bm.member_status,'active')='active'
    AND coalesce(bm.is_touring_member,false)=false;

  RETURN jsonb_build_object(
    'status','completed','performance_id',v_perf.id,'history_id',v_history_id,
    'appearance_number',v_appearance_number,'qualifying_rank',v_inv.qualifying_rank,
    'raw_fame_reward',v_raw_fame,'fame_awarded',v_effective_fame,
    'lifetime_factor',v_lifetime_factor,'progression_factor',v_progression_factor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_complete_performance(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totp_complete_performance(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_public_history(p_band_id uuid DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT coalesce(jsonb_agg(row_data ORDER BY episode_date DESC,running_order ASC),'[]'::jsonb)
  FROM (
    SELECT h.episode_date,h.running_order,jsonb_build_object(
      'episode_date',h.episode_date,'episode_number',h.episode_number,'performance_id',h.performance_id,
      'band_id',h.band_id,'band_name',b.name::text,'song_id',h.song_id,'song_title',s.title,
      'qualifying_rank',h.qualifying_rank,'running_order',h.running_order,'stage_key',h.stage_key,
      'appearance_number',h.appearance_number,'fame_awarded',h.fame_awarded,
      'presenter_intro',h.presenter_intro,'completed_at',h.completed_at
    ) AS row_data
    FROM public.totp_appearance_history h
    JOIN public.bands b ON b.id=h.band_id
    JOIN public.songs s ON s.id=h.song_id
    WHERE p_band_id IS NULL OR h.band_id=p_band_id
    ORDER BY h.episode_date DESC,h.running_order ASC
    LIMIT greatest(1,least(coalesce(p_limit,50),200))
  ) history_rows;
$$;
REVOKE ALL ON FUNCTION public.totp_public_history(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_public_history(uuid,integer) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.totp_band_stats(p_band_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT jsonb_build_object(
    'band_id',p_band_id,'appearances',count(*),'best_chart_rank',min(qualifying_rank),
    'number_one_appearances',count(*) FILTER (WHERE qualifying_rank=1),
    'top_10_appearances',count(*) FILTER (WHERE qualifying_rank<=10),
    'total_fame_awarded',coalesce(sum(fame_awarded),0),
    'first_appearance',min(episode_date),'latest_appearance',max(episode_date)
  )
  FROM public.totp_appearance_history WHERE band_id=p_band_id;
$$;
REVOKE ALL ON FUNCTION public.totp_band_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_band_stats(uuid) TO anon,authenticated;

COMMENT ON TABLE public.totp_appearance_history IS 'Permanent history of completed Top of the Pops appearances and one-time fame settlement.';
COMMENT ON FUNCTION public.totp_complete_performance(uuid,integer) IS 'Admin-only idempotent TOTP completion. Settles fame and achievements exactly once; archive playback never calls it.';
