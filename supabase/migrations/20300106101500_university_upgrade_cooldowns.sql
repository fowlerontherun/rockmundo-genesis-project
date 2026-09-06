-- Enforce independent 7-day cooldowns for mayor university quality and prestige upgrades.

ALTER TABLE public.universities
ADD COLUMN IF NOT EXISTS last_prestige_upgrade_at timestamptz;

CREATE OR REPLACE FUNCTION public.upgrade_university_quality(
  p_university_id uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_university public.universities%ROWTYPE;
  v_mayor public.city_mayors%ROWTYPE;
  v_treasury public.city_treasury%ROWTYPE;
  v_cost bigint;
  v_available bigint;
  v_old_quality integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'university_management_auth_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_profile_id AND pr.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'university_management_profile_forbidden';
  END IF;

  SELECT * INTO v_university FROM public.universities WHERE id = p_university_id FOR UPDATE;
  IF v_university.id IS NULL THEN RAISE EXCEPTION 'university_management_not_found'; END IF;

  SELECT * INTO v_mayor FROM public.city_mayors
  WHERE city_id = v_university.city_id AND profile_id = p_profile_id AND is_current = true;
  IF v_mayor.id IS NULL THEN RAISE EXCEPTION 'university_management_mayor_required'; END IF;

  IF v_university.last_quality_upgrade_at IS NOT NULL
     AND now() < v_university.last_quality_upgrade_at + interval '7 days' THEN
    RAISE EXCEPTION 'university_management_quality_cooldown';
  END IF;

  v_old_quality := COALESCE(v_university.quality_of_learning, 50);
  IF v_old_quality >= 100 THEN RAISE EXCEPTION 'university_management_quality_max'; END IF;
  v_cost := ROUND(5000 + (POWER(v_old_quality::numeric, 2) * 3))::bigint;

  INSERT INTO public.city_treasury (city_id) VALUES (v_university.city_id) ON CONFLICT (city_id) DO NOTHING;
  SELECT * INTO v_treasury FROM public.city_treasury WHERE city_id = v_university.city_id FOR UPDATE;
  v_available := COALESCE(v_treasury.balance, 0) - COALESCE(v_treasury.pending_commitments, 0);
  IF v_available < v_cost THEN RAISE EXCEPTION 'university_management_insufficient_treasury'; END IF;

  UPDATE public.city_treasury
  SET balance = COALESCE(balance, 0) - v_cost,
      total_spent = COALESCE(total_spent, 0) + v_cost,
      updated_at = now()
  WHERE city_id = v_university.city_id;

  UPDATE public.universities
  SET quality_of_learning = v_old_quality + 1,
      quality_investment_total = COALESCE(quality_investment_total, 0) + v_cost,
      last_quality_upgrade_at = now()
  WHERE id = v_university.id
  RETURNING * INTO v_university;

  INSERT INTO public.city_treasury_ledger (city_id, amount, type, description, reference_id)
  VALUES (v_university.city_id, (-v_cost)::integer, 'university_quality_upgrade',
    format('Quality upgrade for %s (%s to %s)', v_university.name, v_old_quality, v_university.quality_of_learning), v_university.id);

  INSERT INTO public.mayor_actions_log (city_id, mayor_id, action_type, amount, target_id, notes, metadata)
  VALUES (v_university.city_id, v_mayor.id, 'university_quality_upgraded', v_cost, v_university.id,
    format('Upgraded %s quality from %s to %s', v_university.name, v_old_quality, v_university.quality_of_learning),
    jsonb_build_object('university_id', v_university.id, 'old_quality', v_old_quality,
      'new_quality', v_university.quality_of_learning, 'prestige_unchanged', v_university.prestige,
      'cost', v_cost, 'cooldown_days', 7,
      'next_quality_upgrade_at', v_university.last_quality_upgrade_at + interval '7 days'));

  RETURN jsonb_build_object('university_id', v_university.id, 'old_quality', v_old_quality,
    'new_quality', v_university.quality_of_learning, 'prestige', v_university.prestige,
    'cost', v_cost, 'next_upgrade_at', v_university.last_quality_upgrade_at + interval '7 days');
END;
$$;

CREATE OR REPLACE FUNCTION public.upgrade_university_prestige(
  p_university_id uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_university public.universities%ROWTYPE;
  v_mayor public.city_mayors%ROWTYPE;
  v_treasury public.city_treasury%ROWTYPE;
  v_cost bigint;
  v_available bigint;
  v_old_prestige integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'university_management_auth_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = p_profile_id AND pr.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'university_management_profile_forbidden';
  END IF;

  SELECT * INTO v_university FROM public.universities WHERE id = p_university_id FOR UPDATE;
  IF v_university.id IS NULL THEN RAISE EXCEPTION 'university_management_not_found'; END IF;

  SELECT * INTO v_mayor FROM public.city_mayors
  WHERE city_id = v_university.city_id AND profile_id = p_profile_id AND is_current = true;
  IF v_mayor.id IS NULL THEN RAISE EXCEPTION 'university_management_mayor_required'; END IF;

  IF v_university.last_prestige_upgrade_at IS NOT NULL
     AND now() < v_university.last_prestige_upgrade_at + interval '7 days' THEN
    RAISE EXCEPTION 'university_management_prestige_cooldown';
  END IF;

  v_old_prestige := COALESCE(v_university.prestige, 50);
  IF v_old_prestige >= 100 THEN RAISE EXCEPTION 'university_management_prestige_max'; END IF;
  v_cost := ROUND(8000 + (POWER(v_old_prestige::numeric, 2) * 4))::bigint;

  INSERT INTO public.city_treasury (city_id) VALUES (v_university.city_id) ON CONFLICT (city_id) DO NOTHING;
  SELECT * INTO v_treasury FROM public.city_treasury WHERE city_id = v_university.city_id FOR UPDATE;
  v_available := COALESCE(v_treasury.balance, 0) - COALESCE(v_treasury.pending_commitments, 0);
  IF v_available < v_cost THEN RAISE EXCEPTION 'university_management_insufficient_treasury'; END IF;

  UPDATE public.city_treasury
  SET balance = COALESCE(balance, 0) - v_cost,
      total_spent = COALESCE(total_spent, 0) + v_cost,
      updated_at = now()
  WHERE city_id = v_university.city_id;

  UPDATE public.universities
  SET prestige = v_old_prestige + 1,
      last_prestige_upgrade_at = now(),
      updated_at = now()
  WHERE id = v_university.id
  RETURNING * INTO v_university;

  INSERT INTO public.city_treasury_ledger (city_id, amount, type, description, reference_id)
  VALUES (v_university.city_id, (-v_cost)::integer, 'university_prestige_upgrade',
    format('Prestige investment for %s (%s to %s)', v_university.name, v_old_prestige, v_university.prestige), v_university.id);

  INSERT INTO public.mayor_actions_log (city_id, mayor_id, action_type, amount, target_id, notes, metadata)
  VALUES (v_university.city_id, v_mayor.id, 'university_prestige_upgraded', v_cost, v_university.id,
    format('Upgraded %s prestige from %s to %s', v_university.name, v_old_prestige, v_university.prestige),
    jsonb_build_object('university_id', v_university.id, 'old_prestige', v_old_prestige,
      'new_prestige', v_university.prestige, 'quality_unchanged', v_university.quality_of_learning,
      'cost', v_cost, 'cooldown_days', 7,
      'next_prestige_upgrade_at', v_university.last_prestige_upgrade_at + interval '7 days'));

  RETURN jsonb_build_object('university_id', v_university.id, 'old_prestige', v_old_prestige,
    'new_prestige', v_university.prestige, 'quality', v_university.quality_of_learning,
    'cost', v_cost, 'next_upgrade_at', v_university.last_prestige_upgrade_at + interval '7 days');
END;
$$;

REVOKE ALL ON FUNCTION public.upgrade_university_quality(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upgrade_university_prestige(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upgrade_university_quality(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upgrade_university_prestige(uuid, uuid) TO authenticated, service_role;
