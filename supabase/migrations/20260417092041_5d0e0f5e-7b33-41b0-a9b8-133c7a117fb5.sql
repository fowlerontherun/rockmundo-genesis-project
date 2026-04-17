
-- 1. Add endorsement bonus column
ALTER TABLE public.city_candidates
  ADD COLUMN IF NOT EXISTS endorsement_bonus_votes INTEGER NOT NULL DEFAULT 0;

-- 2. Helper function to compute & write the bonus for a single candidate
CREATE OR REPLACE FUNCTION public.recompute_candidate_endorsement_bonus(p_candidate_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  IF p_candidate_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(LEAST(250, GREATEST(1, CEIL(pp.member_count::numeric / 2))::INTEGER)), 0)
    INTO v_total
  FROM public.party_endorsements pe
  JOIN public.political_parties pp ON pp.id = pe.party_id
  WHERE pe.candidate_id = p_candidate_id;

  UPDATE public.city_candidates
    SET endorsement_bonus_votes = v_total
    WHERE id = p_candidate_id;
END;
$$;

-- 3. Trigger function: recompute on every endorsement change
CREATE OR REPLACE FUNCTION public.trg_party_endorsements_recompute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.recompute_candidate_endorsement_bonus(NEW.candidate_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.candidate_id IS DISTINCT FROM OLD.candidate_id THEN
      PERFORM public.recompute_candidate_endorsement_bonus(OLD.candidate_id);
    END IF;
    PERFORM public.recompute_candidate_endorsement_bonus(NEW.candidate_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.recompute_candidate_endorsement_bonus(OLD.candidate_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS party_endorsements_recompute_bonus ON public.party_endorsements;
CREATE TRIGGER party_endorsements_recompute_bonus
AFTER INSERT OR UPDATE OR DELETE ON public.party_endorsements
FOR EACH ROW
EXECUTE FUNCTION public.trg_party_endorsements_recompute();

-- 4. Backfill existing candidates
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT DISTINCT candidate_id FROM public.party_endorsements LOOP
    PERFORM public.recompute_candidate_endorsement_bonus(c.candidate_id);
  END LOOP;
END $$;
