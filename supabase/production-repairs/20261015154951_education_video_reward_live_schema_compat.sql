-- Production compatibility repair: 20261012235600_atomic_video_reward_cooldown.
-- The historical SQL refers to absent progression_award_action_xp().
-- This version awards XP through the existing wallet and experience_ledger.
-- Never replay historical awards. All reward side effects are transactional.
BEGIN;
CREATE TABLE IF NOT EXISTS public.education_video_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.education_youtube_resources(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  skill_slug text,
  xp_awarded integer NOT NULL DEFAULT 15 CHECK (xp_awarded=15)
);
CREATE INDEX IF NOT EXISTS education_video_reward_claims_cooldown
  ON public.education_video_reward_claims(profile_id,claimed_at DESC);
ALTER TABLE public.education_video_reward_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.education_video_reward_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.education_video_reward_claims TO authenticated;
DROP POLICY IF EXISTS education_video_reward_claims_select ON public.education_video_reward_claims;
CREATE POLICY education_video_reward_claims_select
ON public.education_video_reward_claims
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id=profile_id AND p.user_id=(select auth.uid())
    AND p.deleted_at IS NULL
));

CREATE OR REPLACE FUNCTION public.reward_education_video_atomic(
 p_profile_id uuid,p_video_id text,p_video_name text,p_skill_slug text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $rm_video$
DECLARE
  v_resource public.education_youtube_resources%ROWTYPE;
  v_slug text;
  v_skill public.skill_progress%ROWTYPE;
  v_cap integer;
  v_level integer;
  v_xp integer;
  v_required integer;
  v_awarded boolean:=false;
  v_locked boolean:=false;
  v_claim uuid;
BEGIN
  IF auth.uid() IS NULL OR p_profile_id IS NULL THEN
    RAISE EXCEPTION 'education_video_profile_not_owned' USING ERRCODE='42501';
  END IF;
  -- Serialise concurrent claims for one profile across different devices.
  PERFORM 1 FROM public.profiles p
  WHERE p.id=p_profile_id AND p.user_id=auth.uid()
    AND p.is_active IS TRUE AND p.deleted_at IS NULL AND p.died_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'education_video_profile_not_owned' USING ERRCODE='42501';
  END IF;
  IF p_video_id IS NULL OR
     p_video_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR length(btrim(coalesce(p_video_name,''))) NOT BETWEEN 1 AND 240
  THEN RAISE EXCEPTION 'education_video_invalid' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_resource FROM public.education_youtube_resources
  WHERE id=p_video_id::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'education_video_not_in_catalog' USING ERRCODE='22023';
  END IF;
  v_slug:=nullif(lower(btrim(coalesce(v_resource.skill_slug,v_resource.category))),'');
  IF nullif(lower(btrim(p_skill_slug)),'') IS DISTINCT FROM v_slug THEN
    RAISE EXCEPTION 'education_video_skill_mismatch' USING ERRCODE='22023';
  END IF;

  IF (SELECT count(*) FROM public.education_video_reward_claims c
      WHERE c.profile_id=p_profile_id
        AND c.claimed_at>now()-interval '2 hours')>=2
  THEN RAISE EXCEPTION 'education_video_cooldown'; END IF;

  -- Only grant skill XP to an EXISTING unlocked skill. Never let an
  -- arbitrary video initialize an unavailable or higher-tier skill.
  IF v_slug IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.skill_definitions d WHERE d.slug=v_slug
  ) THEN
    IF NOT coalesce(public.skill_tier_unlocked(p_profile_id,v_slug),false)
    THEN v_locked:=true;
    ELSE
      SELECT * INTO v_skill FROM public.skill_progress sp
       WHERE sp.profile_id=p_profile_id AND sp.skill_slug=v_slug
       FOR UPDATE;
      IF NOT FOUND OR coalesce(v_skill.current_level,0)<1 THEN
        v_locked:=true;
      ELSE
        v_cap:=public.progression_skill_max_level(v_slug);
        v_level:=coalesce(v_skill.current_level,1);
        IF v_level<v_cap THEN
          v_xp:=coalesce(v_skill.current_xp,0)+15;
          v_required:=coalesce(nullif(v_skill.required_xp,0),
                              public.progression_skill_required_xp(v_level));
          WHILE v_level<v_cap AND v_required>0 AND v_xp>=v_required LOOP
            v_xp:=v_xp-v_required;
            v_level:=v_level+1;
            v_required:=CASE WHEN v_level<v_cap
                         THEN public.progression_skill_required_xp(v_level) ELSE 0 END;
          END LOOP;
          IF v_level>=v_cap THEN v_xp:=0;v_required:=0;END IF;
          UPDATE public.skill_progress
          SET current_level=v_level,current_xp=v_xp,required_xp=v_required,
              last_practiced_at=now(),updated_at=now()
          WHERE id=v_skill.id;
          v_awarded:=true;
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.education_video_reward_claims(profile_id,video_id,skill_slug)
  VALUES(p_profile_id,v_resource.id,v_slug) RETURNING id INTO v_claim;
  UPDATE public.player_xp_wallet w SET
    xp_balance=coalesce(w.xp_balance,0)+15,
    lifetime_xp=coalesce(w.lifetime_xp,0)+15,
    skill_xp_balance=coalesce(w.skill_xp_balance,0)+15,
    skill_xp_lifetime=coalesce(w.skill_xp_lifetime,0)+15,
    last_recalculated=now()
  WHERE w.profile_id=p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'education_video_wallet_missing';
  END IF;
  INSERT INTO public.experience_ledger(
    profile_id,user_id,activity_type,xp_amount,skill_slug,metadata
  ) VALUES(
    p_profile_id,auth.uid(),'youtube_video',15,v_slug,
    jsonb_build_object(
      'video_id',v_resource.id,'video_name',v_resource.title,
      'skill_slug',v_slug,'claim_id',v_claim,
      'unique_event_id','education-video:'||v_claim::text)
  );

  RETURN jsonb_build_object(
    'xpEarned',15,'skillSlug',v_slug,
    'skillXpAwarded',v_awarded,'skillLocked',v_locked,
    'claimedAt',now(),'claimId',v_claim
  );
END;
$rm_video$;
REVOKE ALL ON FUNCTION public.reward_education_video_atomic(uuid,text,text,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reward_education_video_atomic(uuid,text,text,text)
TO authenticated;
COMMIT;