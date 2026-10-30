-- Awards admin phase 1: manual shortlist review and safe show transitions.
-- This migration is non-destructive; it never changes an existing show or
-- nomination automatically, publishes winners, or settles fame/money.
-- Completion must be implemented in a separate atomic winner processor.

CREATE OR REPLACE FUNCTION public.award_admin_review_nomination(
  p_nomination_id uuid, p_decision text
)
RETURNS public.award_nominations
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_nomination public.award_nominations%ROWTYPE;
  v_show_status text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
    RAISE EXCEPTION 'Only award administrators can review nominations'
      USING ERRCODE='42501';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('shortlisted','rejected') THEN
    RAISE EXCEPTION 'Nomination decision must be shortlisted or rejected'
      USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_nomination FROM public.award_nominations
    WHERE id=p_nomination_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nomination not found' USING ERRCODE='P0002';
  END IF;

  SELECT status INTO v_show_status FROM public.award_shows
    WHERE id=v_nomination.award_show_id FOR SHARE;
  IF NOT FOUND OR v_show_status <> 'nominations_open' THEN
    RAISE EXCEPTION 'Nomination review is closed for this show'
      USING ERRCODE='23514';
  END IF;
  IF v_nomination.vote_count <> 0
    OR v_nomination.status IN ('winner','runner_up') THEN
    RAISE EXCEPTION 'Voted or settled nominations cannot be reviewed'
      USING ERRCODE='23514';
  END IF;

  IF v_nomination.status IS DISTINCT FROM p_decision THEN
    UPDATE public.award_nominations
      SET status=p_decision WHERE id=p_nomination_id
      RETURNING * INTO v_nomination;
  END IF;
  RETURN v_nomination;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_admin_advance_show(
  p_show_id uuid, p_next_status text
)
RETURNS public.award_shows
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_show public.award_shows%ROWTYPE;
  v_expected text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
    RAISE EXCEPTION 'Only award administrators can advance shows'
      USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_show FROM public.award_shows
    WHERE id=p_show_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Award show not found' USING ERRCODE='P0002';
  END IF;

  v_expected := CASE v_show.status
    WHEN 'upcoming' THEN 'nominations_open'
    WHEN 'nominations_open' THEN 'voting_open'
    WHEN 'voting_open' THEN 'live'
    ELSE NULL END;

  -- No client/admin transition to completed without verified settlement.
  IF v_expected IS NULL OR p_next_status IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'Invalid awards phase transition from % to %',
      v_show.status,coalesce(p_next_status,'null') USING ERRCODE='23514';
  END IF;

  IF p_next_status='voting_open' THEN
    IF EXISTS (
      SELECT 1 FROM public.award_nominations n
      WHERE n.award_show_id=p_show_id AND n.status='pending'
    ) THEN
      RAISE EXCEPTION 'Review all pending nominations before voting'
        USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.award_nominations n
      WHERE n.award_show_id=p_show_id AND n.status='shortlisted'
    ) THEN
      RAISE EXCEPTION 'At least one shortlist is required before voting'
        USING ERRCODE='23514';
    END IF;
  END IF;

  UPDATE public.award_shows SET status=p_next_status WHERE id=p_show_id
    RETURNING * INTO v_show;
  RETURN v_show;
END;
$$;

REVOKE ALL ON FUNCTION public.award_admin_review_nomination(uuid,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.award_admin_advance_show(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_admin_review_nomination(uuid,text)
  TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.award_admin_advance_show(uuid,text)
  TO authenticated,service_role;
