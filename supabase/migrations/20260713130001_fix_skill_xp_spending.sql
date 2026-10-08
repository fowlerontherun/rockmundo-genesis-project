-- Atomic, idempotent Skill XP spending. Keeps canonical skill_xp_balance and legacy xp_balance in sync.
CREATE TABLE IF NOT EXISTS public.skill_xp_spend_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_slug text NOT NULL,
  xp_spent integer NOT NULL CHECK (xp_spent > 0),
  level_before integer NOT NULL,
  level_after integer NOT NULL,
  xp_progress_before integer NOT NULL,
  xp_progress_after integer NOT NULL,
  wallet_before integer NOT NULL,
  wallet_after integer NOT NULL,
  balance_version text NOT NULL DEFAULT 'progression_v2.0.0',
  idempotency_key text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (profile_id, idempotency_key)
);
ALTER TABLE public.skill_xp_spend_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players can view their own skill XP spends" ON public.skill_xp_spend_ledger;
CREATE POLICY "Players can view their own skill XP spends" ON public.skill_xp_spend_ledger FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.progression_skill_required_xp(p_level integer) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY[120,148,176,204,232,260,289,318,348,377,406,436,465,494,524,553,582,612,641,670])[LEAST(GREATEST(COALESCE(p_level,0),0),19)+1]
$$;

CREATE OR REPLACE FUNCTION public.progression_spend_skill_xp(
  p_profile_id uuid,
  p_skill_slug text,
  p_xp integer,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile public.profiles%ROWTYPE; v_wallet public.player_xp_wallet%ROWTYPE; v_skill public.skill_progress%ROWTYPE;
  v_catalog record; v_now timestamptz := timezone('utc', now()); v_max integer := 20; v_level integer; v_xp integer; v_req integer;
  v_wallet_before integer; v_spend integer; v_to_max integer := 0; v_levels integer; v_level_before integer; v_xp_before integer; v_key text := NULLIF(btrim(COALESCE(p_idempotency_key, p_metadata->>'idempotency_key')), ''); v_existing jsonb; v_result jsonb;
BEGIN
  IF v_key IS NULL THEN RAISE EXCEPTION 'skill_xp_missing_idempotency_key' USING ERRCODE='P0001'; END IF;
  SELECT result INTO v_existing FROM public.skill_xp_spend_ledger WHERE profile_id=p_profile_id AND idempotency_key=v_key;
  IF FOUND THEN RETURN v_existing || jsonb_build_object('duplicate', true); END IF;
  IF p_xp IS NULL OR p_xp <= 0 THEN RAISE EXCEPTION 'skill_xp_invalid_amount' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() AND is_active IS TRUE AND died_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'skill_xp_profile_not_authorised' USING ERRCODE='P0001'; END IF;
  SELECT slug, max_level, COALESCE(is_active, true) AS is_active INTO v_catalog FROM public.skill_catalogue WHERE slug=p_skill_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'skill_xp_skill_not_found' USING ERRCODE='P0001'; END IF;
  IF v_catalog.is_active IS FALSE THEN RAISE EXCEPTION 'skill_xp_inactive_skill' USING ERRCODE='P0001'; END IF;
  v_max := COALESCE(v_catalog.max_level, 20);
  IF to_regprocedure('public.skill_tier_unlocked(uuid,text)') IS NOT NULL AND public.skill_tier_unlocked(p_profile_id, p_skill_slug) IS FALSE THEN RAISE EXCEPTION 'skill_xp_skill_locked' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_wallet FROM public.player_xp_wallet WHERE profile_id=p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'skill_xp_wallet_missing' USING ERRCODE='P0001'; END IF;
  v_wallet_before := GREATEST(0, COALESCE(v_wallet.skill_xp_balance, v_wallet.xp_balance, 0));
  SELECT * INTO v_skill FROM public.skill_progress WHERE profile_id=p_profile_id AND skill_slug=p_skill_slug FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'skill_xp_skill_locked' USING ERRCODE='P0001'; END IF;
  v_level := LEAST(GREATEST(COALESCE(v_skill.current_level,0),0), v_max); v_xp := GREATEST(COALESCE(v_skill.current_xp,0),0); v_level_before := v_level; v_xp_before := v_xp;
  IF v_level >= v_max THEN RAISE EXCEPTION 'skill_xp_max_level_reached' USING ERRCODE='P0001'; END IF;
  v_req := COALESCE(NULLIF(v_skill.required_xp,0), public.progression_skill_required_xp(v_level));
  v_to_max := GREATEST(v_req - LEAST(v_xp, v_req), 0); IF v_level + 1 <= v_max - 1 THEN FOR i IN (v_level + 1)..(v_max - 1) LOOP v_to_max := v_to_max + public.progression_skill_required_xp(i); END LOOP; END IF;
  v_spend := LEAST(p_xp, v_wallet_before, v_to_max);
  IF v_spend <= 0 THEN RAISE EXCEPTION 'skill_xp_invalid_amount' USING ERRCODE='P0001'; END IF;
  IF v_wallet_before < p_xp THEN RAISE EXCEPTION 'skill_xp_insufficient_funds' USING ERRCODE='P0001'; END IF;
  v_levels := 0; v_xp := LEAST(v_xp, v_req) + v_spend;
  WHILE v_level < v_max AND v_xp >= v_req LOOP v_xp := v_xp - v_req; v_level := v_level + 1; v_levels := v_levels + 1; v_req := public.progression_skill_required_xp(v_level); END LOOP;
  IF v_level >= v_max THEN v_level := v_max; v_xp := 0; v_req := NULL; END IF;
  UPDATE public.player_xp_wallet SET skill_xp_balance=v_wallet_before-v_spend, xp_balance=v_wallet_before-v_spend, skill_xp_spent=COALESCE(skill_xp_spent, xp_spent,0)+v_spend, xp_spent=COALESCE(xp_spent, skill_xp_spent,0)+v_spend, last_recalculated=v_now WHERE profile_id=p_profile_id RETURNING * INTO v_wallet;
  UPDATE public.skill_progress SET current_level=v_level, current_xp=v_xp, required_xp=COALESCE(v_req,0), updated_at=v_now, metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('balance_version','progression_v2.0.0') WHERE id=v_skill.id RETURNING * INTO v_skill;
  v_result := jsonb_build_object('skill_slug',p_skill_slug,'xp_spent',v_spend,'levels_gained',v_levels,'wallet_after',v_wallet_before-v_spend,'current_level',v_skill.current_level,'current_xp',v_skill.current_xp,'required_xp',v_skill.required_xp,'skill_progress',to_jsonb(v_skill));
  INSERT INTO public.skill_xp_spend_ledger(profile_id,skill_slug,xp_spent,level_before,level_after,xp_progress_before,xp_progress_after,wallet_before,wallet_after,balance_version,idempotency_key,result) VALUES (p_profile_id,p_skill_slug,v_spend,v_level_before,v_level,v_xp_before,v_xp,v_wallet_before,v_wallet_before-v_spend,'progression_v2.0.0',v_key,v_result);
  INSERT INTO public.xp_ledger(profile_id,event_type,xp_delta,balance_after,attribute_points_delta,skill_points_delta,metadata) VALUES (p_profile_id,'skill_xp_spend',-v_spend,v_wallet_before-v_spend,0,0,COALESCE(p_metadata,'{}'::jsonb)||jsonb_build_object('skill_slug',p_skill_slug,'idempotency_key',v_key,'levels_gained',v_levels));
  RETURN v_result;
END; $$;
GRANT EXECUTE ON FUNCTION public.progression_spend_skill_xp(uuid,text,integer,jsonb,text) TO authenticated, service_role;
