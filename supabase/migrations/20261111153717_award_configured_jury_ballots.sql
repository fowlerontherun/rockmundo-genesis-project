-- Jury voting is opt-in per category. Legacy categories remain public-ballot only.
CREATE TABLE public.award_jury_ballot_receipts (
  award_show_id uuid NOT NULL REFERENCES public.award_shows(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  juror_user_id uuid NOT NULL,
  award_vote_id uuid NOT NULL UNIQUE REFERENCES public.award_votes(id) ON DELETE CASCADE,
  PRIMARY KEY (award_show_id, category_name, juror_user_id)
);
ALTER TABLE public.award_jury_ballot_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.award_jury_ballot_receipts FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.cast_award_jury_ballot(p_show_id uuid, p_nomination_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_show public.award_shows%ROWTYPE;
  v_nom public.award_nominations%ROWTYPE;
  v_vote public.award_votes%ROWTYPE;
  v_weight_text text;
BEGIN
  IF v_actor IS NULL OR NOT coalesce(public.has_role(v_actor, 'admin'), false) THEN
    RAISE EXCEPTION 'Only award administrators can cast jury ballots' USING ERRCODE = '42501';
  END IF;

  -- Use the same lock as the normal voting and settlement paths.
  SELECT * INTO v_show FROM public.award_shows WHERE id = p_show_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Award show not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_nom FROM public.award_nominations
    WHERE id = p_nomination_id AND award_show_id = p_show_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Award nomination not found' USING ERRCODE = 'P0002'; END IF;

  SELECT v.* INTO v_vote
  FROM public.award_jury_ballot_receipts r
  JOIN public.award_votes v ON v.id = r.award_vote_id
  WHERE r.award_show_id = p_show_id AND r.category_name = v_nom.category_name
    AND r.juror_user_id = v_actor;
  IF FOUND THEN
    IF v_vote.nomination_id = p_nomination_id THEN RETURN v_vote.id; END IF;
    RAISE EXCEPTION 'You have already cast your jury ballot for this category' USING ERRCODE = '23505';
  END IF;

  IF v_show.status IS DISTINCT FROM 'voting_open'
    OR v_show.ceremony_date <= now() OR v_nom.status IS DISTINCT FROM 'shortlisted' THEN
    RAISE EXCEPTION 'Jury voting requires open voting and a shortlisted nomination' USING ERRCODE = '23514';
  END IF;

  SELECT category->>'juryWeight' INTO v_weight_text
  FROM jsonb_array_elements(v_show.categories) category
  WHERE category->>'name' = v_nom.category_name;
  IF v_weight_text IS NULL OR v_weight_text !~ '^([1-9]|10)$' THEN
    RAISE EXCEPTION 'Jury voting is disabled for this category' USING ERRCODE = '23514';
  END IF;

  -- Ballot rows can be publicly read. The juror identity lives only in the
  -- private receipt, and jury participation doesn't use the player vote cap.
  INSERT INTO public.award_votes(nomination_id, voter_type, voter_id, weight)
  VALUES (p_nomination_id, 'jury', gen_random_uuid(), v_weight_text::integer)
  RETURNING * INTO v_vote;
  INSERT INTO public.award_jury_ballot_receipts
    (award_show_id, category_name, juror_user_id, award_vote_id)
  VALUES (p_show_id, v_nom.category_name, v_actor, v_vote.id);

  RETURN v_vote.id;
END;
$$;

REVOKE ALL ON FUNCTION public.cast_award_jury_ballot(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cast_award_jury_ballot(uuid, uuid) TO authenticated;
