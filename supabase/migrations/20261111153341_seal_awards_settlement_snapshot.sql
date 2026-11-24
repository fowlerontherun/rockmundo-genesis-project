-- Each new result gets an audit snapshot in the settlement transaction.
-- Historical shows and receipts are left as recorded.
CREATE TABLE public.award_settlement_snapshots (
  award_show_id uuid PRIMARY KEY REFERENCES public.award_shows(id) ON DELETE RESTRICT,
  rules_version text NOT NULL,
  category_config jsonb NOT NULL,
  nominations jsonb NOT NULL,
  ballots jsonb NOT NULL,
  winners jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.award_settlement_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.award_settlement_snapshots FROM PUBLIC, anon, authenticated, service_role;

-- Browser administrators already use award_admin_review_nomination, which
-- validates the phase and locks show before nominee.
DROP POLICY IF EXISTS "Awards admins manage nominations" ON public.award_nominations;
REVOKE UPDATE ON public.award_nominations FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.guard_award_nomination_phase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.award_shows
    WHERE id = NEW.award_show_id FOR SHARE;
  IF v_status IS DISTINCT FROM 'nominations_open' THEN
    RAISE EXCEPTION 'This award show is not accepting nominations' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_award_nomination_phase
BEFORE INSERT ON public.award_nominations
FOR EACH ROW EXECUTE FUNCTION public.guard_award_nomination_phase();

CREATE FUNCTION public.guard_award_ballot_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_nomination_id uuid;
  v_nomination_status text;
  v_show_status text;
  v_ceremony_date timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.nomination_id IS DISTINCT FROM OLD.nomination_id THEN
    RAISE EXCEPTION 'Award ballots cannot move between nominations' USING ERRCODE = '23514';
  END IF;

  v_nomination_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.nomination_id ELSE NEW.nomination_id END;
  -- Same show lock as cast_award_vote and award_admin_finalize_show.
  -- Re-read nomination status after waiting for a concurrent phase change.
  SELECT s.status, s.ceremony_date INTO v_show_status, v_ceremony_date
  FROM public.award_shows s
  JOIN public.award_nominations n ON n.award_show_id = s.id
  WHERE n.id = v_nomination_id
  FOR UPDATE OF s;
  IF NOT FOUND AND TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  SELECT n.status INTO v_nomination_status
  FROM public.award_nominations n WHERE n.id = v_nomination_id;
  IF v_show_status IS DISTINCT FROM 'voting_open'
    OR v_nomination_status IS DISTINCT FROM 'shortlisted'
    OR v_ceremony_date <= now() THEN
    RAISE EXCEPTION 'Award ballots can only change during open voting' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.weight IS NULL OR NEW.weight <= 0
    OR (NEW.voter_type IN ('player', 'band') AND NEW.weight <> 1) THEN
    RAISE EXCEPTION 'Invalid weight for award ballot type' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_award_ballot_write
BEFORE INSERT OR UPDATE OR DELETE ON public.award_votes
FOR EACH ROW EXECUTE FUNCTION public.guard_award_ballot_write();

CREATE FUNCTION public.seal_award_settlement_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed award shows cannot be reopened' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IS DISTINCT FROM 'completed' THEN RETURN NEW; END IF;

  IF OLD.status IS DISTINCT FROM 'live' OR NOT EXISTS (
    SELECT 1 FROM public.award_wins w WHERE w.award_show_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Award completion requires a live show and settled winners' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.award_settlement_snapshots (
    award_show_id, rules_version, category_config, nominations, ballots, winners
  )
  VALUES (
    NEW.id, 'weighted-ballots-v1', NEW.categories,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'category', n.category_name, 'nominee_type', n.nominee_type,
      'nominee_id', n.nominee_id, 'nominee_name', n.nominee_name,
      'status', n.status, 'created_at', n.created_at
    ) ORDER BY n.id), '[]'::jsonb)
    FROM public.award_nominations n WHERE n.award_show_id = NEW.id),
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id, 'nomination_id', v.nomination_id, 'voter_type', v.voter_type, 'weight', v.weight
    ) ORDER BY v.id), '[]'::jsonb)
    FROM public.award_votes v
    JOIN public.award_nominations n ON n.id = v.nomination_id WHERE n.award_show_id = NEW.id),
    (SELECT jsonb_agg(jsonb_build_object(
      'id', w.id, 'category', w.category_name, 'winner', w.winner_name,
      'band_id', w.band_id, 'fame', w.fame_boost, 'money', w.prize_money
    ) ORDER BY w.category_name, w.id)
    FROM public.award_wins w WHERE w.award_show_id = NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER seal_award_settlement_snapshot
BEFORE UPDATE OF status ON public.award_shows
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.seal_award_settlement_snapshot();

REVOKE ALL ON FUNCTION public.guard_award_nomination_phase(), public.guard_award_ballot_write(),
  public.seal_award_settlement_snapshot() FROM PUBLIC, anon, authenticated, service_role;
