-- Canonical progression achievements, explicit criteria, idempotent completions and profile recognition.

DO $$ BEGIN
  CREATE TYPE public.achievement_category AS ENUM ('onboarding','skills','attributes','role','songwriting','recording','gigs','touring','mastery','teaching','social','band','professional','longevity','collection','challenge');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.achievement_tier AS ENUM ('bronze','silver','gold','platinum','legendary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.achievement_type AS ENUM ('achievement','milestone','career_milestone','challenge','hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.achievement_comparison AS ENUM ('gte','lte','eq','gt','lt','between','in');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.achievement_scope AS ENUM ('profile','role','band','song','recording','gig','student','professional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS tier public.achievement_tier,
  ADD COLUMN IF NOT EXISTS achievement_type public.achievement_type DEFAULT 'achievement',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_repeatable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_limit integer,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS icon_key text,
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS chain_key text,
  ADD COLUMN IF NOT EXISTS hidden_hint text,
  ADD COLUMN IF NOT EXISTS hidden_mode text NOT NULL DEFAULT 'concealed';

UPDATE public.achievements
SET slug = lower(regexp_replace(coalesce(slug, name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
UPDATE public.achievements SET tier = CASE lower(coalesce(rarity,'common'))
  WHEN 'common' THEN 'bronze'::public.achievement_tier
  WHEN 'rare' THEN 'silver'::public.achievement_tier
  WHEN 'epic' THEN 'gold'::public.achievement_tier
  WHEN 'legendary' THEN 'platinum'::public.achievement_tier
  WHEN 'mythic' THEN 'legendary'::public.achievement_tier
  ELSE 'bronze'::public.achievement_tier END
WHERE tier IS NULL;
UPDATE public.achievements SET icon_key = coalesce(icon_key, icon, 'award') WHERE icon_key IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS achievements_slug_unique ON public.achievements(slug);
ALTER TABLE public.achievements ADD CONSTRAINT achievements_category_canonical CHECK (category IN ('onboarding','skills','attributes','role','songwriting','recording','gigs','touring','mastery','teaching','social','band','professional','longevity','collection','challenge','performance','creative','chart','financial','regional','general','business','milestone')) NOT VALID;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_repeat_limit_safe CHECK (is_repeatable = false OR (repeat_limit IS NOT NULL AND repeat_limit BETWEEN 1 AND 25)) NOT VALID;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_points_bounded CHECK (points BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_hidden_mode_check CHECK (hidden_mode IN ('concealed','hinted','discovered')) NOT VALID;

CREATE TABLE IF NOT EXISTS public.achievement_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  criterion_type text NOT NULL,
  target_key text NOT NULL,
  comparison public.achievement_comparison NOT NULL DEFAULT 'gte',
  target_value jsonb NOT NULL DEFAULT '1'::jsonb,
  scope public.achievement_scope NOT NULL DEFAULT 'profile',
  sequence_group text,
  sequence_order integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (criterion_type IN ('skill_level','skill_count_at_level','attribute_threshold','role_readiness','completed_songs','songwriting_quality','recordings_completed','recording_quality','gigs_completed','audience_response','fan_growth','mastery_rank','teaching_sessions','student_outcomes','band_goal_completion','professional_credits','cumulative_count','venue_tier','genre_diversity','longevity_months')),
  CHECK (sequence_order IS NULL OR sequence_group IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.achievement_event_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  criterion_type text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_type, achievement_id, criterion_type)
);

CREATE TABLE IF NOT EXISTS public.achievement_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  reward_type text NOT NULL,
  reward_key text,
  amount integer NOT NULL DEFAULT 1,
  settlement_policy text NOT NULL DEFAULT 'automatic',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reward_type IN ('title','badge','cosmetic','cash','skill_xp','attribute_point','band_reputation','professional_reputation','convenience')),
  CHECK (settlement_policy IN ('automatic','claim','choice')),
  CHECK ((reward_type != 'cash' OR amount BETWEEN 0 AND 5000) AND (reward_type != 'skill_xp' OR amount BETWEEN 0 AND 250) AND (reward_type != 'attribute_point' OR amount BETWEEN 0 AND 1))
);

ALTER TABLE public.player_achievements
  ADD COLUMN IF NOT EXISTS completed_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reward_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_event_id uuid,
  ADD COLUMN IF NOT EXISTS balance_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completion_origin text NOT NULL DEFAULT 'live';
UPDATE public.player_achievements SET first_completed_at = coalesce(first_completed_at, unlocked_at), last_completed_at = coalesce(last_completed_at, unlocked_at);
CREATE UNIQUE INDEX IF NOT EXISTS player_achievements_profile_unique_nonrepeatable ON public.player_achievements(profile_id, achievement_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS player_achievements_source_event_unique ON public.player_achievements(profile_id, achievement_id, source_event_id) WHERE profile_id IS NOT NULL AND source_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.achievement_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_event_id uuid,
  UNIQUE(profile_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS public.profile_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id uuid REFERENCES public.achievements(id) ON DELETE SET NULL,
  title text NOT NULL,
  is_selected boolean NOT NULL DEFAULT false,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, title)
);
CREATE UNIQUE INDEX IF NOT EXISTS profile_titles_one_selected ON public.profile_titles(profile_id) WHERE is_selected;

CREATE TABLE IF NOT EXISTS public.profile_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id uuid REFERENCES public.achievements(id) ON DELETE SET NULL,
  badge_key text NOT NULL,
  tier public.achievement_tier NOT NULL DEFAULT 'bronze',
  is_featured boolean NOT NULL DEFAULT false,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, badge_key)
);

CREATE TABLE IF NOT EXISTS public.achievement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  band_id uuid,
  event_type text NOT NULL,
  source_table text,
  source_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_authoritative boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.achievement_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  achievement_id uuid REFERENCES public.achievements(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_name IN ('achievement_progress','achievement_completed','reward_granted','title_selected','badge_featured','milestone_suggestion_opened','achievement_shared','hidden_achievement_discovered','duplicate_completion_blocked','retroactive_award_created','suspicious_repeat_pattern_detected'))
);

CREATE OR REPLACE FUNCTION public.complete_achievement_for_event(p_profile_id uuid, p_achievement_slug text, p_source_event_id uuid DEFAULT NULL, p_origin text DEFAULT 'live')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_achievement public.achievements%ROWTYPE; v_existing public.player_achievements%ROWTYPE; v_id uuid;
BEGIN
  SELECT * INTO v_achievement FROM public.achievements WHERE slug = p_achievement_slug AND is_active;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_source_event_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.player_achievements WHERE profile_id = p_profile_id AND achievement_id = v_achievement.id AND source_event_id = p_source_event_id) THEN
    INSERT INTO public.achievement_telemetry(profile_id, achievement_id, event_name, metadata) VALUES (p_profile_id, v_achievement.id, 'duplicate_completion_blocked', jsonb_build_object('source_event_id', p_source_event_id)) ON CONFLICT DO NOTHING;
    RETURN NULL;
  END IF;
  SELECT * INTO v_existing FROM public.player_achievements WHERE profile_id = p_profile_id AND achievement_id = v_achievement.id LIMIT 1;
  IF FOUND AND NOT v_achievement.is_repeatable THEN RETURN v_existing.id; END IF;
  IF FOUND AND v_achievement.is_repeatable AND v_existing.completed_count >= coalesce(v_achievement.repeat_limit, 1) THEN RETURN v_existing.id; END IF;
  IF FOUND THEN
    UPDATE public.player_achievements SET completed_count = completed_count + 1, last_completed_at = now(), source_event_id = coalesce(p_source_event_id, source_event_id) WHERE id = v_existing.id RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.player_achievements(user_id, profile_id, achievement_id, progress, completed_count, unlocked_at, first_completed_at, last_completed_at, source_event_id, balance_version, completion_origin)
    SELECT p.user_id, p_profile_id, v_achievement.id, '{}'::jsonb, 1, now(), now(), now(), p_source_event_id, v_achievement.balance_version, p_origin FROM public.profiles p WHERE p.id = p_profile_id RETURNING id INTO v_id;
  END IF;
  INSERT INTO public.profile_titles(profile_id, achievement_id, title) SELECT p_profile_id, v_achievement.id, ar.reward_key FROM public.achievement_rewards ar WHERE ar.achievement_id = v_achievement.id AND ar.reward_type = 'title' ON CONFLICT DO NOTHING;
  INSERT INTO public.profile_badges(profile_id, achievement_id, badge_key, tier) SELECT p_profile_id, v_achievement.id, coalesce(ar.reward_key, v_achievement.icon_key), v_achievement.tier FROM public.achievement_rewards ar WHERE ar.achievement_id = v_achievement.id AND ar.reward_type = 'badge' ON CONFLICT DO NOTHING;
  INSERT INTO public.achievement_telemetry(profile_id, achievement_id, event_name, metadata) VALUES (p_profile_id, v_achievement.id, CASE WHEN p_origin='backfill' THEN 'retroactive_award_created' ELSE 'achievement_completed' END, jsonb_build_object('source_event_id', p_source_event_id));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.evaluate_achievements_for_event(p_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.achievement_events%ROWTYPE; v_count integer := 0; v_mapping record;
BEGIN
  SELECT * INTO v_event FROM public.achievement_events WHERE id = p_event_id AND is_authoritative;
  IF NOT FOUND OR v_event.profile_id IS NULL THEN RETURN 0; END IF;
  FOR v_mapping IN SELECT a.slug FROM public.achievement_event_mappings m JOIN public.achievements a ON a.id=m.achievement_id WHERE m.event_type=v_event.event_type AND m.is_active LOOP
    IF public.complete_achievement_for_event(v_event.profile_id, v_mapping.slug, p_event_id) IS NOT NULL THEN v_count := v_count + 1; END IF;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.evaluate_achievement_progress(p_profile_id uuid, p_achievement_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT progress FROM public.achievement_progress WHERE profile_id = p_profile_id AND achievement_id = p_achievement_id), '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.evaluate_achievements_for_profile(p_profile_id uuid, p_context jsonb DEFAULT '{}'::jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0;
BEGIN
  -- Conservative backfill shell: only safe onboarding/first historical facts should be added by later targeted migrations.
  INSERT INTO public.achievement_telemetry(profile_id, event_name, metadata) VALUES (p_profile_id, 'retroactive_award_created', jsonb_build_object('mode','diagnostic_only','context',p_context));
  RETURN v_count;
END $$;

DROP POLICY IF EXISTS "Users can manage their own achievements" ON public.player_achievements;
DROP POLICY IF EXISTS "Players can read own achievement progress" ON public.achievement_progress;
CREATE POLICY "Players can read own achievement progress" ON public.achievement_progress FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Achievement catalogue is readable" ON public.achievement_criteria;
CREATE POLICY "Achievement catalogue is readable" ON public.achievement_criteria FOR SELECT USING (true);
DROP POLICY IF EXISTS "Rewards catalogue is readable" ON public.achievement_rewards;
CREATE POLICY "Rewards catalogue is readable" ON public.achievement_rewards FOR SELECT USING (true);
ALTER TABLE public.achievement_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_telemetry ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.admin_achievement_diagnostics AS
SELECT a.id, a.slug, a.name, a.category, a.tier, a.achievement_type, a.is_active, a.is_hidden, a.is_repeatable, a.repeat_limit, a.points, a.balance_version, a.display_order,
  count(DISTINCT c.id) AS criteria_count, count(DISTINCT r.id) AS reward_count, count(DISTINCT m.id) AS event_mapping_count, count(DISTINCT pa.id) AS completion_rows
FROM public.achievements a
LEFT JOIN public.achievement_criteria c ON c.achievement_id=a.id
LEFT JOIN public.achievement_rewards r ON r.achievement_id=a.id
LEFT JOIN public.achievement_event_mappings m ON m.achievement_id=a.id
LEFT JOIN public.player_achievements pa ON pa.achievement_id=a.id
GROUP BY a.id;

WITH rows(slug,name,description,category,tier,achievement_type,is_hidden,is_repeatable,repeat_limit,display_order,icon_key,points,chain_key,hidden_hint) AS (VALUES
('first-skill-unlocked','First Chord','Unlock your first skill.','onboarding','bronze','milestone',false,false,null,10,'sparkles',5,null,null),
('first-attribute-improved','Sharper Edge','Improve any useful attribute for the first time.','attributes','bronze','milestone',false,false,null,20,'activity',5,null,null),
('working-musician-i','Working Musician I','Complete your first gig.','gigs','bronze','career_milestone',false,false,null,30,'mic',10,'working-musician',null),
('working-musician-ii','Working Musician II','Complete ten gigs and earn strong audience response in five of them.','gigs','silver','career_milestone',false,false,null,40,'stage',25,'working-musician',null),
('first-song-completed','Finished Draft','Complete your first song project.','songwriting','bronze','milestone',false,false,null,50,'music',10,null,null),
('studio-first-master','First Master','Complete your first recording master.','recording','bronze','career_milestone',false,false,null,60,'disc',10,null,null),
('strong-master','Studio Professional','Create a completed master with strong final quality.','recording','gold','achievement',false,false,null,70,'sliders',40,null,null),
('rising-guitarist','Rising Guitarist','Reach advanced guitar readiness with one advanced guitar skill and two competent supporting skills.','role','silver','milestone',false,false,null,80,'guitar',30,null,null),
('first-mastery-rank','First Mastery Rank','Earn your first true mastery rank.','mastery','gold','career_milestone',false,false,null,90,'award',50,null,null),
('trusted-mentor','Trusted Mentor','Help three distinct students reach a milestone.','teaching','silver','achievement',false,false,null,100,'graduation-cap',30,null,null),
('band-architect','Band Architect','Complete a coordinated band training plan with at least three contributors.','band','gold','achievement',false,false,null,110,'users',45,null,null),
('career-season','Career Season','Be active in six distinct career months without a daily streak requirement.','longevity','silver','milestone',false,false,null,120,'calendar',20,null,null),
('against-the-room','Against the Room','Deliver a strong gig despite a difficult venue fit.','challenge','platinum','challenge',true,false,null,130,'flame',75,null,'Win over the wrong room.'),
('repeatable-gig-consistency','Consistent Night','Repeatably recognise a strong completed gig, up to five times.','gigs','bronze','achievement',false,true,5,140,'repeat',2,null,null)
)
INSERT INTO public.achievements(slug,name,description,category,tier,achievement_type,is_hidden,is_repeatable,repeat_limit,display_order,icon_key,points,chain_key,hidden_hint,rewards,requirements)
SELECT slug,name,description,category,tier::public.achievement_tier,achievement_type::public.achievement_type,is_hidden,is_repeatable,repeat_limit,display_order,icon_key,points,chain_key,hidden_hint,'{}'::jsonb,'{}'::jsonb FROM rows
ON CONFLICT (slug) DO UPDATE SET description=excluded.description, tier=excluded.tier, achievement_type=excluded.achievement_type, is_hidden=excluded.is_hidden, is_repeatable=excluded.is_repeatable, repeat_limit=excluded.repeat_limit, display_order=excluded.display_order, icon_key=excluded.icon_key, points=excluded.points, chain_key=excluded.chain_key, hidden_hint=excluded.hidden_hint, updated_at=now();

WITH criteria(slug,criterion_type,target_key,comparison,target_value,scope,sequence_group,sequence_order,metadata) AS (VALUES
('first-skill-unlocked','skill_level','any_active_skill','gte','1'::jsonb,'profile',null,null,'{}'::jsonb),
('first-attribute-improved','attribute_threshold','any_role_relevant_attribute','gte','2'::jsonb,'profile',null,null,'{}'::jsonb),
('working-musician-i','gigs_completed','completed_gigs','gte','1'::jsonb,'profile',null,null,'{}'::jsonb),
('working-musician-ii','gigs_completed','completed_gigs','gte','10'::jsonb,'profile',null,null,'{}'::jsonb),
('working-musician-ii','audience_response','strong_or_better_gigs','gte','5'::jsonb,'profile',null,null,'{}'::jsonb),
('first-song-completed','completed_songs','completed_song_projects','gte','1'::jsonb,'profile',null,null,'{}'::jsonb),
('studio-first-master','recordings_completed','completed_masters','gte','1'::jsonb,'profile',null,null,'{}'::jsonb),
('strong-master','recording_quality','final_master_quality','gte','780'::jsonb,'recording',null,null,'{}'::jsonb),
('rising-guitarist','role_readiness','guitarist_readiness','gte','70'::jsonb,'role',null,null,'{"role":"guitarist"}'::jsonb),
('rising-guitarist','skill_level','guitar','gte','50'::jsonb,'role',null,null,'{}'::jsonb),
('rising-guitarist','skill_count_at_level','guitarist_supporting_skills','gte','2'::jsonb,'role',null,null,'{"minimumLevel":25}'::jsonb),
('first-mastery-rank','mastery_rank','any_mastery_rank','gte','1'::jsonb,'profile',null,null,'{}'::jsonb),
('trusted-mentor','student_outcomes','distinct_students_helped','gte','3'::jsonb,'student',null,null,'{"distinctEntity":"student_profile_id"}'::jsonb),
('band-architect','band_goal_completion','coordinated_training_plan','gte','1'::jsonb,'band',null,null,'{"minDistinctContributors":3}'::jsonb),
('career-season','longevity_months','distinct_active_months','gte','6'::jsonb,'profile',null,null,'{}'::jsonb),
('against-the-room','audience_response','strong_gig_difficult_venue_fit','gte','1'::jsonb,'gig',null,null,'{"hiddenHint":"Win over the wrong room."}'::jsonb),
('repeatable-gig-consistency','audience_response','strong_completed_gig','gte','1'::jsonb,'gig',null,null,'{}'::jsonb)
)
INSERT INTO public.achievement_criteria(achievement_id,criterion_type,target_key,comparison,target_value,scope,sequence_group,sequence_order,metadata)
SELECT a.id,c.criterion_type,c.target_key,c.comparison::public.achievement_comparison,c.target_value,c.scope::public.achievement_scope,c.sequence_group,c.sequence_order,c.metadata
FROM criteria c JOIN public.achievements a ON a.slug=c.slug
ON CONFLICT DO NOTHING;

WITH rewards(slug,reward_type,reward_key,amount,settlement_policy) AS (VALUES
('first-skill-unlocked','badge','first-chord',1,'automatic'),('working-musician-i','title','Working Musician',1,'automatic'),('working-musician-ii','badge','working-musician-silver',1,'automatic'),('strong-master','title','Studio Professional',1,'automatic'),('rising-guitarist','title','Rising Guitarist',1,'automatic'),('first-mastery-rank','badge','mastery-rank',1,'automatic'),('trusted-mentor','title','Trusted Mentor',1,'automatic'),('band-architect','title','Band Architect',1,'automatic'),('career-season','badge','career-season',1,'automatic'),('against-the-room','badge','against-the-room',1,'automatic')
)
INSERT INTO public.achievement_rewards(achievement_id,reward_type,reward_key,amount,settlement_policy)
SELECT a.id,r.reward_type,r.reward_key,r.amount,r.settlement_policy FROM rewards r JOIN public.achievements a ON a.slug=r.slug
ON CONFLICT DO NOTHING;

WITH mappings(event_type,slug,criterion_type) AS (VALUES
('skill_level_gained','first-skill-unlocked','skill_level'),('attribute_upgraded','first-attribute-improved','attribute_threshold'),('gig_completed','working-musician-i','gigs_completed'),('gig_completed','working-musician-ii','gigs_completed'),('gig_completed','repeatable-gig-consistency','audience_response'),('song_completed','first-song-completed','completed_songs'),('recording_master_completed','studio-first-master','recordings_completed'),('recording_master_completed','strong-master','recording_quality'),('role_readiness_changed','rising-guitarist','role_readiness'),('mastery_rank_earned','first-mastery-rank','mastery_rank'),('mentoring_goal_achieved','trusted-mentor','student_outcomes'),('band_goal_completed','band-architect','band_goal_completion'),('career_month_active','career-season','longevity_months'),('gig_completed','against-the-room','audience_response')
)
INSERT INTO public.achievement_event_mappings(event_type,achievement_id,criterion_type)
SELECT m.event_type,a.id,m.criterion_type FROM mappings m JOIN public.achievements a ON a.slug=m.slug
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.select_profile_title(p_profile_id uuid, p_title_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profile_titles WHERE id=p_title_id AND profile_id=p_profile_id) THEN RAISE EXCEPTION 'title not earned'; END IF;
  UPDATE public.profile_titles SET is_selected=false WHERE profile_id=p_profile_id;
  UPDATE public.profile_titles SET is_selected=true WHERE id=p_title_id AND profile_id=p_profile_id;
  INSERT INTO public.achievement_telemetry(profile_id,event_name,metadata) VALUES (p_profile_id,'title_selected',jsonb_build_object('title_id',p_title_id));
END $$;

CREATE OR REPLACE FUNCTION public.set_featured_profile_badge(p_profile_id uuid, p_badge_id uuid, p_featured boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profile_badges WHERE id=p_badge_id AND profile_id=p_profile_id) THEN RAISE EXCEPTION 'badge not earned'; END IF;
  UPDATE public.profile_badges SET is_featured=p_featured WHERE id=p_badge_id AND profile_id=p_profile_id;
  INSERT INTO public.achievement_telemetry(profile_id,event_name,metadata) VALUES (p_profile_id,'badge_featured',jsonb_build_object('badge_id',p_badge_id,'featured',p_featured));
END $$;

DROP POLICY IF EXISTS "Players can read own titles" ON public.profile_titles;
CREATE POLICY "Players can read own titles" ON public.profile_titles FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Players can read own badges" ON public.profile_badges;
CREATE POLICY "Players can read own badges" ON public.profile_badges FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Players can read own achievement telemetry" ON public.achievement_telemetry;
CREATE POLICY "Players can read own achievement telemetry" ON public.achievement_telemetry FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
