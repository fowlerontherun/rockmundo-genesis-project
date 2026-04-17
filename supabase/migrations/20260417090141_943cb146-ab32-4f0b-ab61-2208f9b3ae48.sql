CREATE TABLE IF NOT EXISTS public.party_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.political_parties(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.city_candidates(id) ON DELETE CASCADE,
  election_id uuid NOT NULL REFERENCES public.city_elections(id) ON DELETE CASCADE,
  endorsed_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  statement text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_endorsements_unique_per_election UNIQUE (party_id, election_id)
);

CREATE INDEX IF NOT EXISTS idx_party_endorsements_candidate ON public.party_endorsements(candidate_id);
CREATE INDEX IF NOT EXISTS idx_party_endorsements_election ON public.party_endorsements(election_id);

ALTER TABLE public.party_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view endorsements"
  ON public.party_endorsements FOR SELECT
  USING (true);

-- Inserts/updates/deletes go through SECURITY DEFINER RPCs only

CREATE OR REPLACE FUNCTION public.endorse_candidate(
  p_party_id uuid,
  p_candidate_id uuid,
  p_statement text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_role text;
  v_election_id uuid;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT pm.profile_id, pm.role
    INTO v_profile_id, v_role
    FROM public.party_memberships pm
    JOIN public.profiles p ON p.id = pm.profile_id
    WHERE pm.party_id = p_party_id AND p.user_id = v_user_id;

  IF v_profile_id IS NULL OR v_role NOT IN ('founder','officer') THEN
    RAISE EXCEPTION 'Only party founders or officers may endorse';
  END IF;

  SELECT election_id INTO v_election_id
    FROM public.city_candidates WHERE id = p_candidate_id;
  IF v_election_id IS NULL THEN RAISE EXCEPTION 'Candidate not found'; END IF;

  INSERT INTO public.party_endorsements (
    party_id, candidate_id, election_id, endorsed_by_profile_id, statement
  ) VALUES (
    p_party_id, p_candidate_id, v_election_id, v_profile_id, NULLIF(trim(p_statement), '')
  )
  ON CONFLICT (party_id, election_id) DO UPDATE
    SET candidate_id = EXCLUDED.candidate_id,
        endorsed_by_profile_id = EXCLUDED.endorsed_by_profile_id,
        statement = EXCLUDED.statement,
        created_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_endorsement(p_party_id uuid, p_election_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT pm.role INTO v_role
    FROM public.party_memberships pm
    JOIN public.profiles p ON p.id = pm.profile_id
    WHERE pm.party_id = p_party_id AND p.user_id = v_user_id;

  IF v_role IS NULL OR v_role NOT IN ('founder','officer') THEN
    RAISE EXCEPTION 'Only party founders or officers may revoke';
  END IF;

  DELETE FROM public.party_endorsements
    WHERE party_id = p_party_id AND election_id = p_election_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.endorse_candidate(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_endorsement(uuid, uuid) TO authenticated;