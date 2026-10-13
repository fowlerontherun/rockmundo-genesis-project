-- Requires 20260713120001_progression_achievements_canonical.sql.
-- Four coordinated fixes: criteria gating, repeatable event idempotency,
-- automatic economic reward settlement and profile isolation.
CREATE TABLE IF NOT EXISTS public.achievement_processed_events (
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
 source_event_id uuid NOT NULL REFERENCES public.achievement_events(id) ON DELETE CASCADE,
 processed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (profile_id, achievement_id, source_event_id)
);
ALTER TABLE public.achievement_processed_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.achievement_processed_events FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.achievement_reward_settlements (
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
 reward_id uuid NOT NULL REFERENCES public.achievement_rewards(id) ON DELETE CASCADE,
 completion_number integer NOT NULL CHECK (completion_number > 0),
 settled_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (profile_id, achievement_id, reward_id, completion_number)
);
ALTER TABLE public.achievement_reward_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.achievement_reward_settlements FROM PUBLIC, anon, authenticated;

-- A comparison only succeeds for explicit numeric metrics emitted by the
-- authoritative event or previously recorded achievement progress.
-- Missing, malformed and unsupported criteria always fail closed.
CREATE OR REPLACE FUNCTION public.achievement_event_criteria_met(
 p_profile_id uuid, p_achievement_id uuid, p_event_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_event public.achievement_events%ROWTYPE;
 v_progress jsonb;v_criterion public.achievement_criteria%ROWTYPE;
 v_source jsonb;v_actual numeric;v_target numeric;v_seen integer:=0;
BEGIN
 SELECT * INTO v_event FROM public.achievement_events
 WHERE id=p_event_id AND profile_id=p_profile_id AND is_authoritative;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT progress INTO v_progress FROM public.achievement_progress
 WHERE profile_id=p_profile_id AND achievement_id=p_achievement_id;
 FOR v_criterion IN SELECT * FROM public.achievement_criteria
 WHERE achievement_id=p_achievement_id ORDER BY id LOOP
   v_seen:=v_seen+1;
   v_source:=coalesce(v_progress->v_criterion.target_key,
                       v_event.payload->v_criterion.target_key);
   IF jsonb_typeof(v_source) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
   v_actual:=(v_source #>> '{}')::numeric;
   IF v_criterion.comparison IN ('gte','gt','eq','lte','lt') THEN
     IF jsonb_typeof(v_criterion.target_value) IS DISTINCT FROM 'number' THEN RETURN false; END IF;
     v_target:=(v_criterion.target_value #>> '{}')::numeric;
     IF NOT CASE v_criterion.comparison
       WHEN 'gte' THEN v_actual>=v_target
       WHEN 'gt' THEN v_actual>v_target
       WHEN 'eq' THEN v_actual=v_target
       WHEN 'lte' THEN v_actual<=v_target
       WHEN 'lt' THEN v_actual<v_target
       ELSE false END THEN RETURN false; END IF;
   ELSIF v_criterion.comparison='between' THEN
     IF jsonb_typeof(v_criterion.target_value) IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_criterion.target_value)<>2
       OR jsonb_typeof(v_criterion.target_value->0)<>'number'
       OR jsonb_typeof(v_criterion.target_value->1)<>'number' THEN RETURN false; END IF;
     IF v_actual NOT BETWEEN (v_criterion.target_value->>0)::numeric
                         AND (v_criterion.target_value->>1)::numeric THEN RETURN false; END IF;
   ELSIF v_criterion.comparison='in' THEN
     IF jsonb_typeof(v_criterion.target_value) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
     IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_criterion.target_value) x(value)
       WHERE jsonb_typeof(x.value)='number' AND (x.value #>> '{}')::numeric=v_actual)
       THEN RETURN false; END IF;
   ELSE
     RETURN false;
   END IF;
 END LOOP;
 RETURN v_seen>0;
END $$;

CREATE OR REPLACE FUNCTION public.complete_achievement_for_event(
 p_profile_id uuid, p_achievement_slug text, p_source_event_id uuid DEFAULT NULL,
 p_origin text DEFAULT 'live')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_achievement public.achievements%ROWTYPE;
 v_existing public.player_achievements%ROWTYPE;
 v_id uuid;v_user uuid;v_new integer;v_number integer;
 v_reward public.achievement_rewards%ROWTYPE;
BEGIN
 SELECT * INTO v_achievement FROM public.achievements
 WHERE slug=p_achievement_slug AND is_active;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT user_id INTO v_user FROM public.profiles WHERE id=p_profile_id;
 IF v_user IS NULL THEN RETURN NULL; END IF;
 IF p_source_event_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.achievement_events
    WHERE id=p_source_event_id AND profile_id=p_profile_id AND is_authoritative
 ) THEN RAISE EXCEPTION 'ACHIEVEMENT_EVENT_NOT_AUTHORITATIVE'; END IF;
 IF v_achievement.is_repeatable AND p_source_event_id IS NULL THEN
    RAISE EXCEPTION 'REPEATABLE_ACHIEVEMENT_REQUIRES_EVENT'; END IF;
 -- Serialize different events completing the same award at the same time.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_profile_id::text||':'||v_achievement.id::text,0));
 SELECT * INTO v_existing FROM public.player_achievements
 WHERE profile_id=p_profile_id AND achievement_id=v_achievement.id FOR UPDATE;
 IF FOUND AND (NOT v_achievement.is_repeatable
    OR v_existing.completed_count>=coalesce(v_achievement.repeat_limit,1)) THEN RETURN NULL; END IF;
 IF p_source_event_id IS NOT NULL THEN
   INSERT INTO public.achievement_processed_events(profile_id,achievement_id,source_event_id)
   VALUES(p_profile_id,v_achievement.id,p_source_event_id)
   ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS v_new=ROW_COUNT;
   IF v_new=0 THEN RETURN NULL; END IF;
 END IF;
 IF FOUND THEN
   UPDATE public.player_achievements SET
     completed_count=completed_count+1,
     last_completed_at=now(),
     source_event_id=coalesce(p_source_event_id,source_event_id)
   WHERE id=v_existing.id RETURNING id,completed_count INTO v_id,v_number;
 ELSE
   INSERT INTO public.player_achievements(user_id,profile_id,achievement_id,
      progress,completed_count,unlocked_at,first_completed_at,last_completed_at,
      source_event_id,balance_version,completion_origin)
   VALUES(v_user,p_profile_id,v_achievement.id,'{}'::jsonb,1,now(),now(),now(),
      p_source_event_id,v_achievement.balance_version,p_origin)
   RETURNING id,completed_count INTO v_id,v_number;
 END IF;

 INSERT INTO public.profile_titles(profile_id,achievement_id,title)
 SELECT p_profile_id,v_achievement.id,reward_key
 FROM public.achievement_rewards WHERE achievement_id=v_achievement.id
 AND reward_type='title' AND settlement_policy='automatic' AND reward_key IS NOT NULL
 ON CONFLICT DO NOTHING;
 INSERT INTO public.profile_badges(profile_id,achievement_id,badge_key,tier)
 SELECT p_profile_id,v_achievement.id,coalesce(reward_key,v_achievement.icon_key),v_achievement.tier
 FROM public.achievement_rewards WHERE achievement_id=v_achievement.id
 AND reward_type='badge' AND settlement_policy='automatic'
 AND coalesce(reward_key,v_achievement.icon_key) IS NOT NULL
 ON CONFLICT DO NOTHING;

 FOR v_reward IN SELECT * FROM public.achievement_rewards
 WHERE achievement_id=v_achievement.id AND settlement_policy='automatic'
 AND reward_type IN ('cash','skill_xp','attribute_point') ORDER BY id LOOP
   INSERT INTO public.achievement_reward_settlements
      (profile_id,achievement_id,reward_id,completion_number)
   VALUES(p_profile_id,v_achievement.id,v_reward.id,v_number)
   ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS v_new=ROW_COUNT;
   IF v_new=0 THEN CONTINUE; END IF;
   IF v_reward.reward_type='cash' THEN
     UPDATE public.profiles SET cash=coalesce(cash,0)+v_reward.amount WHERE id=p_profile_id;
   ELSE
     INSERT INTO public.player_xp_wallet(profile_id) VALUES(p_profile_id)
     ON CONFLICT(profile_id) DO NOTHING;
     IF v_reward.reward_type='skill_xp' THEN
       UPDATE public.player_xp_wallet SET
         skill_xp_balance=coalesce(skill_xp_balance,0)+v_reward.amount,
         skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+v_reward.amount
       WHERE profile_id=p_profile_id;
     ELSIF v_reward.reward_type='attribute_point' THEN
       UPDATE public.player_xp_wallet SET
         attribute_points_balance=coalesce(attribute_points_balance,0)+v_reward.amount,
         attribute_points_lifetime=coalesce(attribute_points_lifetime,0)+v_reward.amount,
         attribute_points_earned=coalesce(attribute_points_earned,0)+v_reward.amount
       WHERE profile_id=p_profile_id;
     END IF;
   END IF;
   INSERT INTO public.achievement_telemetry(profile_id,achievement_id,event_name,metadata)
   VALUES(p_profile_id,v_achievement.id,'reward_granted',
     jsonb_build_object('reward_id',v_reward.id,'type',v_reward.reward_type,
       'amount',v_reward.amount,'completion_number',v_number));
 END LOOP;
 INSERT INTO public.achievement_telemetry(profile_id,achievement_id,event_name,metadata)
 VALUES(p_profile_id,v_achievement.id,
   CASE WHEN p_origin='backfill' THEN 'retroactive_award_created' ELSE 'achievement_completed' END,
   jsonb_build_object('source_event_id',p_source_event_id,'completion_number',v_number));
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.evaluate_achievements_for_event(p_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_event public.achievement_events%ROWTYPE;v_mapping RECORD;v_count integer:=0;
BEGIN
 SELECT * INTO v_event FROM public.achievement_events WHERE id=p_event_id AND is_authoritative;
 IF NOT FOUND OR v_event.profile_id IS NULL THEN RETURN 0; END IF;
 FOR v_mapping IN SELECT DISTINCT a.id,a.slug FROM public.achievement_event_mappings m
 JOIN public.achievements a ON a.id=m.achievement_id
 WHERE m.event_type=v_event.event_type AND m.is_active AND a.is_active LOOP
   IF public.achievement_event_criteria_met(v_event.profile_id,v_mapping.id,p_event_id) THEN
     IF public.complete_achievement_for_event(v_event.profile_id,v_mapping.slug,p_event_id) IS NOT NULL
     THEN v_count:=v_count+1; END IF;
   END IF;
 END LOOP;
 RETURN v_count;
END $$;

-- All economic awards and processed event records are server-owned.
REVOKE ALL ON FUNCTION public.complete_achievement_for_event(uuid,text,uuid,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.evaluate_achievements_for_event(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.achievement_event_criteria_met(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_achievement_for_event(uuid,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_achievements_for_event(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.achievement_event_criteria_met(uuid,uuid,uuid) TO service_role;
