-- Server-only rolling watch quota. Browser localStorage is never a reward authority.
CREATE TABLE IF NOT EXISTS public.education_video_reward_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 video_id text NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT now(),
 skill_slug text,
 xp_awarded integer NOT NULL DEFAULT 15
);
CREATE INDEX IF NOT EXISTS education_video_reward_claims_cooldown
 ON public.education_video_reward_claims(profile_id,claimed_at DESC);
ALTER TABLE public.education_video_reward_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_video_reward_claims_select ON public.education_video_reward_claims;
CREATE POLICY education_video_reward_claims_select ON public.education_video_reward_claims
 FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.profiles
 WHERE id=profile_id AND user_id=auth.uid()));
REVOKE ALL ON public.education_video_reward_claims FROM PUBLIC,anon;
GRANT SELECT ON public.education_video_reward_claims TO authenticated;

CREATE OR REPLACE FUNCTION public.reward_education_video_atomic(
 p_profile_id uuid,p_video_id text,p_video_name text,p_skill_slug text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_slug text:=nullif(lower(btrim(p_skill_slug)),'');v_skill public.skill_progress%rowtype;
 v_cap integer;v_level integer;v_xp integer;v_required integer;v_skill_awarded boolean:=false;
 v_skill_locked boolean:=false;v_claim uuid;v_event jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'education_video_profile_not_owned'; END IF;
 IF length(btrim(coalesce(p_video_id,''))) NOT BETWEEN 1 AND 200
 OR length(btrim(coalesce(p_video_name,''))) NOT BETWEEN 1 AND 240
 THEN RAISE EXCEPTION 'education_video_invalid'; END IF;
 IF (SELECT count(*) FROM public.education_video_reward_claims
 WHERE profile_id=p_profile_id AND claimed_at>now()-interval '2 hours')>=2
 THEN RAISE EXCEPTION 'education_video_cooldown'; END IF;
 IF v_slug IS NOT NULL AND EXISTS(SELECT 1 FROM public.skill_definitions WHERE slug=v_slug) THEN
  IF NOT public.skill_tier_unlocked(p_profile_id,v_slug) THEN v_skill_locked:=true;
  ELSE
   SELECT * INTO v_skill FROM public.skill_progress WHERE profile_id=p_profile_id AND skill_slug=v_slug FOR UPDATE;
   IF NOT FOUND AND NOT(v_slug=ANY(ARRAY['guitar','bass','drums','vocals','performance','songwriting'])
     OR v_slug LIKE 'basic_%' OR v_slug LIKE 'instruments_basic_%' OR v_slug LIKE 'genres_basic_%')
   THEN v_skill_locked:=true;
   ELSE
    v_cap:=public.progression_skill_max_level(v_slug);
    v_level:=coalesce(v_skill.current_level,0);
    v_xp:=coalesce(v_skill.current_xp,0)+15;
    v_required:=coalesce(nullif(v_skill.required_xp,0),public.progression_skill_required_xp(v_level));
    WHILE v_level<v_cap AND v_required>0 AND v_xp>=v_required LOOP
      v_xp:=v_xp-v_required;v_level:=v_level+1;
      v_required:=CASE WHEN v_level<v_cap THEN public.progression_skill_required_xp(v_level) ELSE 0 END;
    END LOOP;
    IF v_level>=v_cap THEN v_xp:=0;v_required:=0; END IF;
    INSERT INTO public.skill_progress(profile_id,skill_slug,current_level,current_xp,required_xp,last_practiced_at)
    VALUES(p_profile_id,v_slug,v_level,v_xp,v_required,now())
    ON CONFLICT(profile_id,skill_slug) DO UPDATE SET
      current_level=excluded.current_level,current_xp=excluded.current_xp,
      required_xp=excluded.required_xp,last_practiced_at=excluded.last_practiced_at;
    v_skill_awarded:=coalesce(v_skill.current_level,0)<v_cap;
   END IF;
  END IF;
 END IF;
 INSERT INTO public.education_video_reward_claims(profile_id,video_id,skill_slug)
 VALUES(p_profile_id,p_video_id,v_slug) RETURNING id INTO v_claim;
 v_event:=public.progression_award_action_xp(p_profile_id,15,'education','youtube_video',
 jsonb_build_object('video_id',p_video_id,'video_name',p_video_name,
 'skill_slug',v_slug,'unique_event_id','education-video:'||v_claim::text));
 RETURN jsonb_build_object('xpEarned',15,'skillSlug',v_slug,'skillXpAwarded',v_skill_awarded,
 'skillLocked',v_skill_locked,'claimedAt',now(),'claimId',v_claim);
END $$;
REVOKE ALL ON FUNCTION public.reward_education_video_atomic(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reward_education_video_atomic(uuid,text,text,text) TO authenticated;
