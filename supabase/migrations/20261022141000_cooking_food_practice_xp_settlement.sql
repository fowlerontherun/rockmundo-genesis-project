-- Fractional carry for cooking-food practice bonuses. Owner-readable,
-- privileged writes only. On every practice completion, sub-1 XP bonuses
-- accumulate rather than rounding permanently to zero.
CREATE TABLE IF NOT EXISTS public.cooking_practice_xp_carry (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_hundredths integer NOT NULL DEFAULT 0
    CHECK (xp_hundredths BETWEEN 0 AND 99),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cooking_practice_xp_carry ENABLE ROW LEVEL SECURITY;
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cooking_practice_xp_carry'
    AND policyname='View own cooking practice XP carry'
  ) THEN
    CREATE POLICY "View own cooking practice XP carry"
    ON public.cooking_practice_xp_carry FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_id AND p.user_id = (SELECT auth.uid())
    ));
  END IF;
END $policy$;
REVOKE ALL ON public.cooking_practice_xp_carry FROM public,anon,authenticated;
GRANT SELECT ON public.cooking_practice_xp_carry TO authenticated;
ALTER TABLE public.skill_practice_reward_ledger
  ADD COLUMN IF NOT EXISTS food_bonus_percent integer NOT NULL DEFAULT 0
    CHECK (food_bonus_percent BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS food_bonus_xp integer NOT NULL DEFAULT 0
    CHECK (food_bonus_xp BETWEEN 0 AND 1);

-- Keep the existing service-role restriction and skill-cap handling unchanged.
CREATE OR REPLACE FUNCTION public.complete_skill_practice(p_activity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_activity public.player_scheduled_activities%ROWTYPE;
  v_progress public.skill_progress%ROWTYPE;
  v_slug text;
  v_reward constant integer := 5;
  v_total_reward integer := 5;
  v_food_percent integer := 0;
  v_food_bonus_xp integer := 0;
  v_carry_before integer := 0;
  v_carry_after integer := 0;
  v_previous_reward public.skill_practice_reward_ledger%ROWTYPE;
  v_level integer;
  v_xp integer;
  v_required integer;
  v_max integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_activity
  FROM public.player_scheduled_activities
  WHERE id = p_activity_id
  FOR UPDATE;

  IF NOT FOUND OR v_activity.activity_type <> 'skill_practice' THEN
    RAISE EXCEPTION 'invalid practice activity' USING ERRCODE='P0001';
  END IF;
  IF v_activity.status IN ('cancelled', 'missed') THEN
    RAISE EXCEPTION 'practice was not completed' USING ERRCODE='P0001';
  END IF;
  IF v_activity.scheduled_end > timezone('utc', now()) THEN
    RAISE EXCEPTION 'practice has not ended' USING ERRCODE='P0001';
  END IF;

  v_slug := COALESCE(v_activity.metadata->>'skillSlug', v_activity.metadata->>'skill_slug');
  IF v_slug IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.skill_definitions WHERE slug::text = v_slug
  ) THEN
    RAISE EXCEPTION 'invalid practice skill metadata' USING ERRCODE='P0001';
  END IF;
  IF NOT public.skill_tier_unlocked(v_activity.profile_id, v_slug) THEN
    RAISE EXCEPTION 'practiced skill is locked' USING ERRCODE='P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.skill_practice_reward_ledger WHERE activity_id = p_activity_id
  ) THEN
    SELECT * INTO v_previous_reward
      FROM public.skill_practice_reward_ledger WHERE activity_id = p_activity_id;
    SELECT * INTO v_progress FROM public.skill_progress
    WHERE profile_id = v_activity.profile_id AND skill_slug = v_slug;
    RETURN jsonb_build_object(
      'already_rewarded', true,
      'xp_awarded', v_previous_reward.xp_awarded,
      'food_bonus_xp', v_previous_reward.food_bonus_xp,
      'food_bonus_percent', v_previous_reward.food_bonus_percent,
      'skill_progress', to_jsonb(v_progress));
  END IF;

  SELECT * INTO v_progress
  FROM public.skill_progress
  WHERE profile_id = v_activity.profile_id
    AND skill_slug = v_slug
    AND current_level >= 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'practiced skill is no longer unlocked' USING ERRCODE='P0001';
  END IF;

  -- Require a server-recorded meal effect to cover the WHOLE booked hour.
  -- The immutable receipt is used instead of currently-active boost state:
  -- delayed jobs must award the same XP after the temporary effect expires.
  SELECT COALESCE(MAX(c.effect_percent), 0) INTO v_food_percent
  FROM public.cooking_food_consumptions c
  WHERE c.profile_id = v_activity.profile_id
    AND c.effect_slug = 'practice_xp'
    AND c.effect_applied IS TRUE
    AND c.consumed_at <= v_activity.scheduled_start
    AND c.effect_expires_at >= v_activity.scheduled_end;
  v_food_percent := LEAST(5, GREATEST(0, v_food_percent));

  -- 5 XP * 5% = 0.25 XP. Carry hundredths across sessions; otherwise a
  -- small food effect would always round to zero and mislead the player.
  INSERT INTO public.cooking_practice_xp_carry(profile_id, xp_hundredths)
  VALUES (v_activity.profile_id, 0)
  ON CONFLICT (profile_id) DO NOTHING;
  SELECT xp_hundredths INTO v_carry_before
  FROM public.cooking_practice_xp_carry
  WHERE profile_id = v_activity.profile_id FOR UPDATE;
  v_food_bonus_xp := (v_carry_before + v_reward * v_food_percent) / 100;
  v_carry_after := MOD(v_carry_before + v_reward * v_food_percent, 100);
  v_total_reward := v_reward + v_food_bonus_xp;
  UPDATE public.cooking_practice_xp_carry
  SET xp_hundredths = v_carry_after, updated_at = clock_timestamp()
  WHERE profile_id = v_activity.profile_id;

  INSERT INTO public.skill_practice_reward_ledger(
    activity_id, profile_id, skill_slug, xp_awarded, idempotency_key,
    food_bonus_percent, food_bonus_xp)
  VALUES (p_activity_id, v_activity.profile_id, v_slug, v_total_reward,
    'skill-practice:' || p_activity_id, v_food_percent, v_food_bonus_xp);

  v_max := public.progression_skill_max_level(v_slug);
  v_level := least(greatest(coalesce(v_progress.current_level, 0), 0), v_max);
  v_xp := greatest(coalesce(v_progress.current_xp, 0), 0);

  IF v_level < v_max THEN
    v_xp := v_xp + v_total_reward;
    v_required := coalesce(nullif(v_progress.required_xp, 0), public.progression_skill_required_xp(v_level));
    WHILE v_level < v_max AND v_xp >= v_required LOOP
      v_xp := v_xp - v_required;
      v_level := v_level + 1;
      IF v_level < v_max THEN
        v_required := public.progression_skill_required_xp(v_level);
      END IF;
    END LOOP;
  END IF;

  IF v_level >= v_max THEN
    v_level := v_max;
    v_xp := 0;
    v_required := 0;
  END IF;

  UPDATE public.skill_progress
  SET current_level = v_level,
      current_xp = v_xp,
      required_xp = v_required,
      last_practiced_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  WHERE id = v_progress.id
  RETURNING * INTO v_progress;

  UPDATE public.player_scheduled_activities
  SET status = 'completed',
      completed_at = timezone('utc', now()),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('practiceRewarded', true)
  WHERE id = p_activity_id;

  RETURN jsonb_build_object('already_rewarded', false, 'xp_awarded', v_total_reward,
    'food_bonus_xp', v_food_bonus_xp, 'food_bonus_percent', v_food_percent,
    'skill_progress', to_jsonb(v_progress));
END;
$function$

-- Preserve the existing service-only execution gate.
REVOKE ALL ON FUNCTION public.complete_skill_practice(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_skill_practice(uuid) TO service_role;
