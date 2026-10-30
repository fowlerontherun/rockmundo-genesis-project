-- Awards nomination integrity: forward-only hardening for player-submitted bands.
-- Intentionally does not rewrite existing nominations, votes, or award outcomes.
-- Apply only after comparing the deployed policy/function definitions on staging.

DROP POLICY IF EXISTS "Nominators can update their nominations" ON public.award_nominations;
DROP POLICY IF EXISTS "Awards admins manage nominations" ON public.award_nominations;
CREATE POLICY "Awards admins manage nominations"
  ON public.award_nominations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_award_nomination_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_show public.award_shows%ROWTYPE;
  v_band public.bands%ROWTYPE;
BEGIN
  -- Guard INSERT only. An UPDATE trigger would block the trusted vote-count
  -- sync triggers because auth.uid() remains the voting account identity.
  -- Ordinary client updates are already blocked by the admin-only RLS policy.

  -- The trusted administrator/worker path remains available for adjudication.
  IF auth.role() = 'service_role'
     OR COALESCE(public.has_role(auth.uid(), 'admin'), false) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Nomination must belong to the signed-in account'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_show FROM public.award_shows WHERE id = NEW.award_show_id;
  IF NOT FOUND OR v_show.status IS DISTINCT FROM 'nominations_open' THEN
    RAISE EXCEPTION 'This award show is not accepting nominations'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.nominee_type IS DISTINCT FROM 'band'
     OR NEW.band_id IS NULL
     OR NEW.nominee_id IS DISTINCT FROM NEW.band_id::text THEN
    RAISE EXCEPTION 'Player nominations require a real band'
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_band FROM public.bands WHERE id = NEW.band_id;
  IF NOT FOUND OR v_band.status IS DISTINCT FROM 'active'
     OR NEW.nominee_name IS DISTINCT FROM v_band.name THEN
    RAISE EXCEPTION 'Nomination must identify an active band by its real name'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_show.categories) IS DISTINCT FROM 'array'
     OR NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(
         CASE WHEN jsonb_typeof(v_show.categories) = 'array'
           THEN v_show.categories ELSE '[]'::jsonb END
       ) AS category
       WHERE category->>'name' = NEW.category_name
     ) THEN
    RAISE EXCEPTION 'Category is not offered at this award show'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending'
     OR NEW.vote_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Player nominations must begin pending, with no votes'
      USING ERRCODE = '23514';
  END IF;

  -- Ignore unverified browser scoring/shortlist metadata. Future automated
  -- selection must use the trusted worker/admin path, not submission fields.
  NEW.submission_data := jsonb_build_object('nomination_source', 'player_submission');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_award_nomination_submission() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_award_nomination_submission_trg ON public.award_nominations;
CREATE TRIGGER guard_award_nomination_submission_trg
  BEFORE INSERT ON public.award_nominations
  FOR EACH ROW EXECUTE FUNCTION public.guard_award_nomination_submission();
