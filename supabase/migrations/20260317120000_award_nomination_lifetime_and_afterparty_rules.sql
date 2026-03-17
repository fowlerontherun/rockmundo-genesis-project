-- Enforce one band nomination per award show/category and lifetime achievement cadence.

CREATE UNIQUE INDEX IF NOT EXISTS award_nominations_unique_band_per_award_idx
ON public.award_nominations (award_show_id, category_name, band_id)
WHERE band_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_award_nomination_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_show_year INT;
BEGIN
  SELECT year INTO v_show_year
  FROM public.award_shows
  WHERE id = NEW.award_show_id;

  IF NEW.category_name ~* 'lifetime achievement'
     AND (v_show_year IS NULL OR MOD(v_show_year, 4) <> 0) THEN
    RAISE EXCEPTION 'Lifetime Achievement nominations are only allowed every 4 in-game years';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_award_nomination_rules ON public.award_nominations;

CREATE TRIGGER trg_enforce_award_nomination_rules
BEFORE INSERT OR UPDATE ON public.award_nominations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_award_nomination_rules();
