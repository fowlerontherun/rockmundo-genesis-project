-- #4237: applied directly to production as migration 20261019165131.
-- No player can trust their browser-calculated vote type, weight, or cap.
ALTER TABLE public.award_votes ADD COLUMN IF NOT EXISTS voter_account_id uuid;
UPDATE public.award_votes v SET voter_account_id=p.user_id
FROM public.profiles p
WHERE v.voter_type='player' AND v.voter_id=p.id AND v.voter_account_id IS NULL;
UPDATE public.award_votes v SET voter_account_id=u.id
FROM auth.users u
WHERE v.voter_type='player' AND v.voter_id=u.id AND v.voter_account_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS award_votes_nomination_account_unique
  ON public.award_votes(nomination_id,voter_account_id)
  WHERE voter_account_id IS NOT NULL;

DROP POLICY IF EXISTS "Players can cast votes" ON public.award_votes;
DROP POLICY IF EXISTS "Users can cast votes" ON public.award_votes;
REVOKE INSERT,UPDATE,DELETE ON public.award_votes FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.cast_award_vote(p_nomination_id uuid, p_show_id uuid, p_voter_type text DEFAULT 'player'::text, p_profile_id uuid DEFAULT NULL::uuid, p_band_id uuid DEFAULT NULL::uuid)
 RETURNS award_votes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_show public.award_shows%rowtype;
  v_voter_id uuid;
  v_count integer;
  v_vote public.award_votes%rowtype;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to vote' USING ERRCODE='42501';
  END IF;
  IF p_nomination_id IS NULL OR p_show_id IS NULL THEN
    RAISE EXCEPTION 'A nomination and show are required' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_show FROM public.award_shows WHERE id=p_show_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Award show not found' USING ERRCODE='P0002';
  END IF;
  IF v_show.status <> 'voting_open'
     OR (v_show.ceremony_date IS NOT NULL AND now()>=v_show.ceremony_date) THEN
    RAISE EXCEPTION 'Voting is not open for this award show' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.award_nominations n
    WHERE n.id=p_nomination_id AND n.award_show_id=p_show_id AND n.status='shortlisted') THEN
    RAISE EXCEPTION 'Nomination is not eligible for voting' USING ERRCODE='23514';
  END IF;

  IF p_voter_type='player' THEN
    IF p_profile_id IS NULL OR p_band_id IS NOT NULL OR NOT EXISTS(
      SELECT 1 FROM public.profiles p
      WHERE p.id=p_profile_id AND p.user_id=v_user AND COALESCE(p.is_active,true)
        AND p.died_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Not authorised to vote as this character' USING ERRCODE='42501';
    END IF;
    v_voter_id:=p_profile_id;
  ELSIF p_voter_type='band' THEN
    IF p_band_id IS NULL OR p_profile_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.profiles p
      WHERE p.id=p_profile_id AND p.user_id=v_user AND COALESCE(p.is_active,true)
        AND p.died_at IS NULL
    ) OR NOT EXISTS(
      SELECT 1 FROM public.bands b
      WHERE b.id=p_band_id AND
      (b.leader_id=p_profile_id OR EXISTS(
        SELECT 1 FROM public.band_members bm
        WHERE bm.band_id=b.id AND bm.profile_id=p_profile_id
          AND bm.member_status='active' AND COALESCE(bm.is_touring_member,false)=false))
    ) THEN
      RAISE EXCEPTION 'Not authorised to vote for this band' USING ERRCODE='42501';
    END IF;
    v_voter_id:=p_band_id;
  ELSE
    RAISE EXCEPTION 'Only player or member-band votes are permitted' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.award_votes v
  JOIN public.award_nominations n ON n.id=v.nomination_id
  WHERE n.award_show_id=p_show_id AND v.voter_account_id=v_user;
  IF v_count>=3 THEN
    RAISE EXCEPTION 'Maximum three votes per award show' USING ERRCODE='23514';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.award_votes
    WHERE nomination_id=p_nomination_id AND voter_account_id=v_user
  ) THEN
    RAISE EXCEPTION 'You have already voted for this nomination' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.award_votes(nomination_id,voter_type,voter_id,voter_account_id,weight)
  VALUES(p_nomination_id,p_voter_type,v_voter_id,v_user,1)
  RETURNING * INTO v_vote;
  RETURN v_vote;
END $function$
;
REVOKE ALL ON FUNCTION public.cast_award_vote(uuid,uuid,text,uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cast_award_vote(uuid,uuid,text,uuid,uuid)
  TO authenticated;
