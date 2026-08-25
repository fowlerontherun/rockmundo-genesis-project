-- Festival C8: bounded attendee progression, memories and real-attendance owner signal.
-- Rewards derive only from authoritative attendance/activity/moment rows and settle once.
-- Relationship mutations remain outside this slice until the Social Programme lifecycle is complete.

CREATE TABLE public.festival_attendee_reward_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL UNIQUE REFERENCES public.festival_player_attendance(id) ON DELETE RESTRICT,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  attendance_status text NOT NULL CHECK (attendance_status IN ('completed','left_early')),
  completed_activities integer NOT NULL DEFAULT 0 CHECK (completed_activities BETWEEN 0 AND 100),
  watched_acts integer NOT NULL DEFAULT 0 CHECK (watched_acts BETWEEN 0 AND 50),
  resolved_moments integer NOT NULL DEFAULT 0 CHECK (resolved_moments BETWEEN 0 AND 50),
  distinct_activity_types integer NOT NULL DEFAULT 0 CHECK (distinct_activity_types BETWEEN 0 AND 12),
  skill_xp_awarded integer NOT NULL DEFAULT 0 CHECK (skill_xp_awarded BETWEEN 0 AND 600),
  attribute_points_awarded integer NOT NULL DEFAULT 0 CHECK (attribute_points_awarded BETWEEN 0 AND 3),
  inspiration_score integer NOT NULL DEFAULT 0 CHECK (inspiration_score BETWEEN 0 AND 100),
  reward_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(reward_breakdown) = 'object'),
  settled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.festival_attendee_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.festival_player_attendance(id) ON DELETE RESTRICT,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  memory_key text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attendance_id, memory_key)
);

CREATE TABLE public.festival_real_attendance_signals (
  festival_edition_id uuid PRIMARY KEY REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  verified_checked_in integer NOT NULL DEFAULT 0 CHECK (verified_checked_in >= 0),
  verified_completed integer NOT NULL DEFAULT 0 CHECK (verified_completed >= 0),
  completed_activities integer NOT NULL DEFAULT 0 CHECK (completed_activities >= 0),
  resolved_moments integer NOT NULL DEFAULT 0 CHECK (resolved_moments >= 0),
  engagement_points integer NOT NULL DEFAULT 0 CHECK (engagement_points BETWEEN 0 AND 1000),
  owner_boost_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (owner_boost_percent BETWEEN 0 AND 5),
  calculation_version text NOT NULL DEFAULT 'festival-c8-v1',
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(explanation) = 'object'),
  recalculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX festival_attendee_rewards_profile_idx ON public.festival_attendee_reward_settlements(profile_id, settled_at DESC);
CREATE INDEX festival_attendee_memories_profile_idx ON public.festival_attendee_memories(profile_id, created_at DESC);

ALTER TABLE public.festival_attendee_reward_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_attendee_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_real_attendance_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_attendee_reward_settlements, public.festival_attendee_memories, public.festival_real_attendance_signals FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.festival_attendee_reward_settlements, public.festival_attendee_memories, public.festival_real_attendance_signals TO service_role;

CREATE OR REPLACE FUNCTION public._festival_c8_recalculate_real_attendance_signal(p_festival_edition_id uuid)
RETURNS public.festival_real_attendance_signals
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_checked integer := 0;
  v_completed integer := 0;
  v_activities integer := 0;
  v_moments integer := 0;
  v_points integer := 0;
  v_boost numeric := 0;
  v_row public.festival_real_attendance_signals%ROWTYPE;
BEGIN
  SELECT count(DISTINCT a.profile_id) FILTER (WHERE a.checked_in_at IS NOT NULL),
         count(DISTINCT a.profile_id) FILTER (WHERE a.status = 'completed')
  INTO v_checked, v_completed
  FROM public.festival_player_attendance a
  WHERE a.festival_edition_id = p_festival_edition_id
    AND a.status IN ('attending','completed','left_early');

  SELECT count(*) INTO v_activities
  FROM public.festival_attendee_plan_items i
  JOIN public.festival_player_attendance a ON a.id = i.attendance_id
  WHERE a.festival_edition_id = p_festival_edition_id AND i.status = 'completed';

  SELECT count(*) INTO v_moments
  FROM public.festival_attendee_moments m
  JOIN public.festival_player_attendance a ON a.id = m.attendance_id
  WHERE a.festival_edition_id = p_festival_edition_id AND m.status = 'resolved';

  -- Unique real participation dominates; repeated activity adds only a small capped signal.
  v_points := least(1000, (v_checked * 12) + (v_completed * 18) + least(v_activities, 100) + least(v_moments * 2, 100));
  v_boost := least(5.00, round((v_points::numeric / 100.0), 2));

  INSERT INTO public.festival_real_attendance_signals(
    festival_edition_id, verified_checked_in, verified_completed, completed_activities,
    resolved_moments, engagement_points, owner_boost_percent, explanation, recalculated_at
  ) VALUES (
    p_festival_edition_id, v_checked, v_completed, v_activities, v_moments, v_points, v_boost,
    jsonb_build_object(
      'verifiedCheckedInWeight', 12,
      'verifiedCompletedWeight', 18,
      'activityContributionCap', 100,
      'momentContributionCap', 100,
      'ownerBoostCapPercent', 5,
      'ticketCountUsed', false,
      'calculationVersion', 'festival-c8-v1'
    ), now()
  )
  ON CONFLICT (festival_edition_id) DO UPDATE SET
    verified_checked_in = EXCLUDED.verified_checked_in,
    verified_completed = EXCLUDED.verified_completed,
    completed_activities = EXCLUDED.completed_activities,
    resolved_moments = EXCLUDED.resolved_moments,
    engagement_points = EXCLUDED.engagement_points,
    owner_boost_percent = EXCLUDED.owner_boost_percent,
    explanation = EXCLUDED.explanation,
    recalculated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_c8_recalculate_real_attendance_signal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_c8_recalculate_real_attendance_signal(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._festival_c8_settle_attendee_reward(p_attendance_id uuid)
RETURNS public.festival_attendee_reward_settlements
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_existing public.festival_attendee_reward_settlements%ROWTYPE;
  v_wallet public.player_xp_wallet%ROWTYPE;
  v_completed integer := 0;
  v_watched integer := 0;
  v_moments integer := 0;
  v_types integer := 0;
  v_inspiration integer := 0;
  v_xp integer := 0;
  v_ap integer := 0;
  v_reward public.festival_attendee_reward_settlements%ROWTYPE;
  v_achievement_event uuid;
BEGIN
  SELECT * INTO v_attendance FROM public.festival_player_attendance WHERE id = p_attendance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_attendance_not_found' USING ERRCODE='P0001'; END IF;
  IF v_attendance.status NOT IN ('completed','left_early') THEN RAISE EXCEPTION 'festival_reward_not_ready' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_existing FROM public.festival_attendee_reward_settlements WHERE attendance_id = p_attendance_id;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT count(*), count(*) FILTER (WHERE activity_type='watch_act'), count(DISTINCT activity_type)
  INTO v_completed, v_watched, v_types
  FROM public.festival_attendee_plan_items
  WHERE attendance_id = p_attendance_id AND status = 'completed';

  SELECT count(*) INTO v_moments FROM public.festival_attendee_moments
  WHERE attendance_id = p_attendance_id AND status = 'resolved';

  SELECT coalesce(inspiration, 0) INTO v_inspiration FROM public.festival_attendee_conditions
  WHERE attendance_id = p_attendance_id;

  -- Small participation reward, capped regardless of click volume. Completing the full
  -- Festival is materially better than leaving early, but neither path can be replayed.
  v_xp := least(600,
    CASE WHEN v_attendance.status='completed' THEN 120 ELSE 40 END
    + least(v_completed, 8) * 20
    + least(v_watched, 4) * 25
    + least(v_moments, 4) * 15
    + least(v_types, 6) * 10
  );
  v_ap := CASE
    WHEN v_attendance.status='completed' AND v_completed >= 3 THEN 2
    WHEN v_attendance.status='completed' THEN 1
    ELSE 0
  END;

  INSERT INTO public.festival_attendee_reward_settlements(
    attendance_id, festival_edition_id, profile_id, attendance_status,
    completed_activities, watched_acts, resolved_moments, distinct_activity_types,
    skill_xp_awarded, attribute_points_awarded, inspiration_score, reward_breakdown
  ) VALUES (
    v_attendance.id, v_attendance.festival_edition_id, v_attendance.profile_id, v_attendance.status,
    v_completed, v_watched, v_moments, v_types, v_xp, v_ap, least(100, greatest(0, v_inspiration)),
    jsonb_build_object(
      'completionBaseXp', CASE WHEN v_attendance.status='completed' THEN 120 ELSE 40 END,
      'activityXp', least(v_completed,8) * 20,
      'watchXp', least(v_watched,4) * 25,
      'momentXp', least(v_moments,4) * 15,
      'varietyXp', least(v_types,6) * 10,
      'xpCap', 600,
      'apCap', 2,
      'antiFarm', jsonb_build_object('oneSettlementPerAttendance', true, 'activityCountCap', 8, 'watchCountCap', 4, 'momentCountCap', 4)
    )
  ) RETURNING * INTO v_reward;

  INSERT INTO public.player_xp_wallet(profile_id) VALUES (v_attendance.profile_id)
  ON CONFLICT (profile_id) DO NOTHING;
  SELECT * INTO v_wallet FROM public.player_xp_wallet WHERE profile_id=v_attendance.profile_id FOR UPDATE;
  UPDATE public.player_xp_wallet SET
    skill_xp_balance = coalesce(skill_xp_balance, xp_balance, 0) + v_xp,
    skill_xp_lifetime = coalesce(skill_xp_lifetime, lifetime_xp, 0) + v_xp,
    xp_balance = coalesce(skill_xp_balance, xp_balance, 0) + v_xp,
    lifetime_xp = coalesce(skill_xp_lifetime, lifetime_xp, 0) + v_xp,
    attribute_points_balance = coalesce(attribute_points_balance,0) + v_ap,
    attribute_points_lifetime = coalesce(attribute_points_lifetime,0) + v_ap,
    last_recalculated = now()
  WHERE profile_id=v_attendance.profile_id;

  INSERT INTO public.xp_ledger(profile_id,event_type,xp_delta,balance_after,attribute_points_delta,skill_points_delta,metadata)
  SELECT v_attendance.profile_id, 'festival_attendance_reward', v_xp,
         coalesce(w.skill_xp_balance,w.xp_balance,0), v_ap, 0,
         jsonb_build_object('attendance_id',v_attendance.id,'festival_edition_id',v_attendance.festival_edition_id,'reward_settlement_id',v_reward.id)
  FROM public.player_xp_wallet w WHERE w.profile_id=v_attendance.profile_id;

  INSERT INTO public.festival_attendee_memories(attendance_id,festival_edition_id,profile_id,memory_key,title,summary,metadata)
  VALUES (
    v_attendance.id,v_attendance.festival_edition_id,v_attendance.profile_id,'festival-recap',
    CASE WHEN v_attendance.status='completed' THEN 'Festival completed' ELSE 'Festival visit' END,
    format('You completed %s activities, watched %s acts and resolved %s festival moments.',v_completed,v_watched,v_moments),
    jsonb_build_object('completedActivities',v_completed,'watchedActs',v_watched,'resolvedMoments',v_moments,'skillXp',v_xp,'attributePoints',v_ap,'inspiration',v_inspiration)
  ) ON CONFLICT (attendance_id,memory_key) DO NOTHING;

  IF v_attendance.status='completed' THEN
    INSERT INTO public.achievement_events(profile_id,event_type,source_table,source_id,payload,is_authoritative)
    VALUES (v_attendance.profile_id,'festival_attendance_completed','festival_player_attendance',v_attendance.id,
      jsonb_build_object('festival_edition_id',v_attendance.festival_edition_id,'activities',v_completed,'watched_acts',v_watched),true)
    ON CONFLICT (event_type,source_id) DO UPDATE SET payload=EXCLUDED.payload
    RETURNING id INTO v_achievement_event;
    IF v_achievement_event IS NOT NULL THEN PERFORM public.evaluate_achievements_for_event(v_achievement_event); END IF;
  END IF;

  PERFORM public._festival_c8_recalculate_real_attendance_signal(v_attendance.festival_edition_id);
  RETURN v_reward;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_c8_settle_attendee_reward(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_c8_settle_attendee_reward(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._festival_c8_settle_on_attendance_exit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF OLD.status = 'attending' AND NEW.status IN ('completed','left_early') THEN
    PERFORM public._festival_c8_settle_attendee_reward(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._festival_c8_settle_on_attendance_exit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_c8_settle_on_attendance_exit() TO service_role;
DROP TRIGGER IF EXISTS festival_c8_settle_on_attendance_exit ON public.festival_player_attendance;
CREATE TRIGGER festival_c8_settle_on_attendance_exit
AFTER UPDATE OF status ON public.festival_player_attendance
FOR EACH ROW WHEN (OLD.status='attending' AND NEW.status IN ('completed','left_early'))
EXECUTE FUNCTION public._festival_c8_settle_on_attendance_exit();

-- Recognition is cosmetic only; the Festival reward settlement already owns progression.
INSERT INTO public.achievements(slug,name,description,category,rarity,tier,achievement_type,is_active,is_hidden,is_repeatable,display_order,icon_key,points,balance_version,requirements,rewards)
VALUES ('festival-first-completion','Festival Survivor','Complete a full RockMundo festival as an attendee.','collection','common','bronze','milestone',true,false,false,720,'ticket',5,1,'{"festival_attendance_completed":1}'::jsonb,'{}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,is_active=true;
INSERT INTO public.achievement_event_mappings(event_type,achievement_id,criterion_type,is_active)
SELECT 'festival_attendance_completed',id,'cumulative_count',true FROM public.achievements WHERE slug='festival-first-completion'
ON CONFLICT (event_type,achievement_id,criterion_type) DO UPDATE SET is_active=true;
INSERT INTO public.achievement_rewards(achievement_id,reward_type,reward_key,amount,settlement_policy,metadata)
SELECT id,'badge','festival-survivor',1,'automatic','{"source":"festival-c8"}'::jsonb FROM public.achievements WHERE slug='festival-first-completion'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_my_festival_reward_summary(p_attendance_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_reward public.festival_attendee_reward_settlements%ROWTYPE;
  v_completed integer := 0; v_watched integer := 0; v_moments integer := 0; v_types integer := 0; v_inspiration integer := 0;
BEGIN
  SELECT * INTO v_attendance FROM public.festival_player_attendance
  WHERE id=p_attendance_id AND profile_id=v_profile;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_attendance_not_found' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_reward FROM public.festival_attendee_reward_settlements WHERE attendance_id=p_attendance_id;
  IF FOUND THEN
    RETURN jsonb_build_object('attendanceId',v_attendance.id,'festivalEditionId',v_attendance.festival_edition_id,'attendanceStatus',v_attendance.status,
      'settled',true,'skillXp',v_reward.skill_xp_awarded,'attributePoints',v_reward.attribute_points_awarded,'completedActivities',v_reward.completed_activities,
      'watchedActs',v_reward.watched_acts,'resolvedMoments',v_reward.resolved_moments,'distinctActivityTypes',v_reward.distinct_activity_types,
      'inspiration',v_reward.inspiration_score,'settledAt',v_reward.settled_at,'breakdown',v_reward.reward_breakdown,'serverNow',now());
  END IF;

  SELECT count(*),count(*) FILTER(WHERE activity_type='watch_act'),count(DISTINCT activity_type)
  INTO v_completed,v_watched,v_types FROM public.festival_attendee_plan_items WHERE attendance_id=p_attendance_id AND status='completed';
  SELECT count(*) INTO v_moments FROM public.festival_attendee_moments WHERE attendance_id=p_attendance_id AND status='resolved';
  SELECT coalesce(inspiration,0) INTO v_inspiration FROM public.festival_attendee_conditions WHERE attendance_id=p_attendance_id;
  RETURN jsonb_build_object('attendanceId',v_attendance.id,'festivalEditionId',v_attendance.festival_edition_id,'attendanceStatus',v_attendance.status,
    'settled',false,'skillXp',least(600,120+least(v_completed,8)*20+least(v_watched,4)*25+least(v_moments,4)*15+least(v_types,6)*10),
    'attributePoints',CASE WHEN v_completed>=3 THEN 2 ELSE 1 END,'completedActivities',v_completed,'watchedActs',v_watched,'resolvedMoments',v_moments,
    'distinctActivityTypes',v_types,'inspiration',least(100,greatest(0,v_inspiration)),'settledAt',NULL,'breakdown',jsonb_build_object('preview',true,'xpCap',600,'apCap',2),'serverNow',now());
END;
$function$;
REVOKE ALL ON FUNCTION public.get_my_festival_reward_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_reward_summary(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_festival_real_attendance_signal(p_festival_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_row public.festival_real_attendance_signals%ROWTYPE;
BEGIN
  v_row := public._festival_c8_recalculate_real_attendance_signal(p_festival_edition_id);
  RETURN jsonb_build_object('festivalEditionId',v_row.festival_edition_id,'verifiedCheckedIn',v_row.verified_checked_in,
    'verifiedCompleted',v_row.verified_completed,'completedActivities',v_row.completed_activities,'resolvedMoments',v_row.resolved_moments,
    'engagementPoints',v_row.engagement_points,'ownerBoostPercent',v_row.owner_boost_percent,'calculationVersion',v_row.calculation_version,
    'explanation',v_row.explanation,'recalculatedAt',v_row.recalculated_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_festival_real_attendance_signal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_real_attendance_signal(uuid) TO service_role;
