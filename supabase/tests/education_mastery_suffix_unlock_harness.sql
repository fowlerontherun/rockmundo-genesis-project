-- Regression evidence for issue #4286, executed against production
-- 18 Oct 2026 inside BEGIN / ROLLBACK: no character progress is persisted.
-- Requires an existing profile with none of these four test skill records.
BEGIN;
DO $tier$
DECLARE
 p uuid;
 guitar_cap int := public.progression_skill_max_level('guitar');
 professional_cap int := public.progression_skill_max_level('professional_live_looping');
BEGIN
 SELECT id INTO p FROM public.profiles profile
 WHERE NOT EXISTS (
   SELECT 1 FROM public.skill_progress sp
   WHERE sp.profile_id=profile.id
   AND sp.skill_slug IN ('guitar','guitar_mastery',
       'professional_live_looping','live_looping_mastery')
 ) LIMIT 1;
 IF p IS NULL THEN RAISE EXCEPTION 'Mastery test character unavailable'; END IF;

 IF public.skill_tier_unlocked(p,'guitar_mastery')
    OR public.skill_tier_unlocked(p,'live_looping_mastery')
    OR public.skill_tier_unlocked(p,'ai_music_mastery') THEN
    RAISE EXCEPTION 'Newbie can bypass mastery prerequisites';
 END IF;
 INSERT INTO public.skill_progress(profile_id,skill_slug,current_level,current_xp)
 VALUES(p,'guitar',guitar_cap-1,0);
 IF public.skill_tier_unlocked(p,'guitar_mastery') THEN
    RAISE EXCEPTION 'Mastery unlocked below base skill cap';
 END IF;
 UPDATE public.skill_progress SET current_level=guitar_cap
 WHERE profile_id=p AND skill_slug='guitar';
 IF NOT public.skill_tier_unlocked(p,'guitar_mastery') THEN
    RAISE EXCEPTION 'Mastery did not unlock at base skill cap';
 END IF;

 INSERT INTO public.skill_progress(profile_id,skill_slug,current_level,current_xp)
 VALUES(p,'professional_live_looping',professional_cap-1,0);
 IF public.skill_tier_unlocked(p,'live_looping_mastery') THEN
    RAISE EXCEPTION 'Mastery unlocked below Professional tier cap';
 END IF;
 UPDATE public.skill_progress SET current_level=professional_cap
 WHERE profile_id=p AND skill_slug='professional_live_looping';
 IF NOT public.skill_tier_unlocked(p,'live_looping_mastery') THEN
    RAISE EXCEPTION 'Mastery did not unlock at Professional tier cap';
 END IF;

 UPDATE public.skill_progress SET current_level=0
 WHERE profile_id=p AND skill_slug='guitar';
 INSERT INTO public.skill_progress(profile_id,skill_slug,current_level,current_xp)
 VALUES(p,'guitar_mastery',1,0);
 IF NOT public.skill_tier_unlocked(p,'guitar_mastery') THEN
    RAISE EXCEPTION 'Previously learned mastery was not grandfathered';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.skill_tier_access_bulk(p,ARRAY['guitar_mastery'])
   WHERE skill_slug='guitar_mastery' AND is_unlocked IS TRUE
 ) THEN
   RAISE EXCEPTION 'Bulk eligibility disagrees with authoritative gate';
 END IF;
END;
$tier$;
ROLLBACK;

-- Static identity test: no real profile should be required to reject a
-- suffix Mastery with no prerequisite/progress or missing parent skill.
DO $none$
BEGIN
 IF public.skill_tier_unlocked('00000000-0000-0000-0000-000000000000'::uuid,
        'guitar_mastery')
 OR public.skill_tier_unlocked('00000000-0000-0000-0000-000000000000'::uuid,
        'ai_music_mastery')
 THEN RAISE EXCEPTION 'Missing-profile mastery erroneously unlocked'; END IF;
END;
$none$;
