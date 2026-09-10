-- Apply equipped clothing performance bonuses to persisted gig outcomes.
-- The band modifier is the average of active members' capped outfit bonuses,
-- so larger bands do not gain a stacking advantage simply from headcount.

CREATE OR REPLACE FUNCTION public.band_clothing_performance_bonus_pct(p_band_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(20, COALESCE(AVG(b.performance_pct), 0))
  FROM public.band_members bm
  CROSS JOIN LATERAL public.get_equipped_clothing_bonuses(bm.profile_id) b
  WHERE bm.band_id = p_band_id
    AND bm.profile_id IS NOT NULL
    AND COALESCE(bm.member_status, 'active') = 'active';
$$;

CREATE OR REPLACE FUNCTION public.apply_clothing_bonus_to_gig_outcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pct numeric := 0;
  v_base numeric;
  v_adjusted numeric;
BEGIN
  IF NEW.band_id IS NULL OR NEW.overall_rating IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.xp_breakdown, '{}'::jsonb) ? 'clothing_performance_bonus_applied' THEN
    RETURN NEW;
  END IF;

  v_pct := public.band_clothing_performance_bonus_pct(NEW.band_id);
  IF v_pct <= 0 THEN RETURN NEW; END IF;

  v_base := NEW.overall_rating;
  v_adjusted := LEAST(25, round((v_base * (1 + v_pct / 100.0))::numeric, 2));
  NEW.overall_rating := v_adjusted;

  -- Clothing can only increase the score, so only promote the grade when a
  -- known upper threshold is crossed. Lower-grade thresholds remain untouched.
  IF v_adjusted >= 23 THEN
    NEW.performance_grade := 'S';
  ELSIF v_adjusted >= 20 THEN
    NEW.performance_grade := 'A';
  ELSIF v_adjusted >= 16 THEN
    NEW.performance_grade := 'B';
  END IF;

  NEW.xp_breakdown := COALESCE(NEW.xp_breakdown, '{}'::jsonb) || jsonb_build_object(
    'clothing_performance_bonus_applied', true,
    'clothing_performance_bonus_pct', v_pct,
    'pre_clothing_overall_rating', v_base,
    'post_clothing_overall_rating', v_adjusted
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_clothing_bonus_to_gig_outcome ON public.gig_outcomes;
CREATE TRIGGER trg_apply_clothing_bonus_to_gig_outcome
BEFORE INSERT OR UPDATE OF overall_rating ON public.gig_outcomes
FOR EACH ROW
EXECUTE FUNCTION public.apply_clothing_bonus_to_gig_outcome();

COMMENT ON FUNCTION public.band_clothing_performance_bonus_pct(uuid) IS
  'Returns the average equipped clothing performance bonus for active band members, capped at 20 percent.';

NOTIFY pgrst, 'reload schema';
