-- City governance correctness pass.
-- Centralises mayor project pricing/settlement, automatically advances elections,
-- installs election winners, and keeps the legacy treasury tax-rate mirror in sync
-- with city_laws (the authoritative policy source).

-- Resolve politics skill progress across the legacy and normalised skill stores.
CREATE OR REPLACE FUNCTION public.city_governance_skill_value(
  p_profile_id uuid,
  p_skill_slug text
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_value numeric := 0;
BEGIN
  IF p_profile_id IS NULL OR p_skill_slug IS NULL THEN
    RETURN 0;
  END IF;

  IF to_regclass('public.skill_progress') IS NOT NULL THEN
    BEGIN
      EXECUTE $sql$
        SELECT COALESCE(current_xp, current_level, 0)::numeric
        FROM public.skill_progress
        WHERE profile_id = $1 AND skill_slug = $2
        LIMIT 1
      $sql$
      INTO v_value
      USING p_profile_id, p_skill_slug;
    EXCEPTION WHEN undefined_column THEN
      v_value := 0;
    END;
  END IF;

  IF COALESCE(v_value, 0) = 0
     AND to_regclass('public.profile_skill_progress') IS NOT NULL
     AND to_regclass('public.skill_definitions') IS NOT NULL THEN
    BEGIN
      EXECUTE $sql$
        SELECT COALESCE(psp.current_xp, psp.current_level, 0)::numeric
        FROM public.profile_skill_progress psp
        JOIN public.skill_definitions sd ON sd.id = psp.skill_id
        WHERE psp.profile_id = $1 AND sd.slug = $2
        LIMIT 1
      $sql$
      INTO v_value
      USING p_profile_id, p_skill_slug;
    EXCEPTION WHEN undefined_column THEN
      v_value := COALESCE(v_value, 0);
    END;
  END IF;

  RETURN COALESCE(v_value, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.city_governance_skill_value(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.city_governance_skill_value(uuid, text) TO authenticated, service_role;

-- Project creation is now a single server-authoritative transaction. The browser
-- cannot provide a price override and required politics skills are re-checked here.
CREATE OR REPLACE FUNCTION public.propose_city_project(
  p_city_id uuid,
  p_project_type_id uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mayor public.city_mayors%ROWTYPE;
  v_type public.city_project_types%ROWTYPE;
  v_treasury public.city_treasury%ROWTYPE;
  v_project public.city_projects%ROWTYPE;
  v_required_value numeric := 0;
  v_negotiation numeric := 0;
  v_discount integer := 0;
  v_cost bigint := 0;
  v_available bigint := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'city_governance_auth_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'city_governance_profile_forbidden';
  END IF;

  SELECT * INTO v_mayor
  FROM public.city_mayors
  WHERE city_id = p_city_id
    AND profile_id = p_profile_id
    AND is_current = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'city_project_mayor_required';
  END IF;

  SELECT * INTO v_type
  FROM public.city_project_types
  WHERE id = p_project_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'city_project_type_not_found';
  END IF;

  IF v_type.required_skill_slug IS NOT NULL
     AND COALESCE(v_type.required_skill_level, 0) > 0 THEN
    v_required_value := public.city_governance_skill_value(
      p_profile_id,
      v_type.required_skill_slug
    );

    IF v_required_value < v_type.required_skill_level THEN
      RAISE EXCEPTION 'city_project_skill_required';
    END IF;
  END IF;

  v_negotiation := public.city_governance_skill_value(
    p_profile_id,
    'basic_negotiation'
  );
  -- Preserve the existing gameplay formula while making the server authoritative.
  v_discount := LEAST(15, FLOOR(COALESCE(v_negotiation, 0) / 50)::integer + 5);
  v_cost := GREATEST(
    0,
    ROUND(v_type.base_cost::numeric * (1 - v_discount::numeric / 100))::bigint
  );

  INSERT INTO public.city_treasury (city_id, balance, total_tax_collected, total_spent)
  VALUES (p_city_id, 0, 0, 0)
  ON CONFLICT (city_id) DO NOTHING;

  SELECT * INTO v_treasury
  FROM public.city_treasury
  WHERE city_id = p_city_id
  FOR UPDATE;

  v_available := COALESCE(v_treasury.balance, 0) - COALESCE(v_treasury.pending_commitments, 0);
  IF v_available < v_cost THEN
    RAISE EXCEPTION 'city_project_insufficient_treasury';
  END IF;

  INSERT INTO public.city_projects (
    city_id,
    mayor_id,
    project_type_id,
    name,
    description,
    cost,
    duration_days,
    status,
    started_at,
    completes_at,
    effects,
    approval_change
  ) VALUES (
    p_city_id,
    v_mayor.id,
    v_type.id,
    v_type.name,
    v_type.description,
    v_cost,
    v_type.duration_days,
    'in_progress',
    now(),
    now() + make_interval(days => v_type.duration_days),
    v_type.effects,
    v_type.approval_change
  )
  RETURNING * INTO v_project;

  UPDATE public.city_treasury
  SET pending_commitments = COALESCE(pending_commitments, 0) + v_cost,
      updated_at = now()
  WHERE city_id = p_city_id;

  INSERT INTO public.mayor_actions_log (
    city_id, mayor_id, action_type, amount, target_id, notes, metadata
  ) VALUES (
    p_city_id,
    v_mayor.id,
    'project_proposed',
    v_cost,
    v_project.id,
    'Proposed: ' || v_type.name,
    jsonb_build_object(
      'projectTypeId', v_type.id,
      'baseCost', v_type.base_cost,
      'discountPct', v_discount,
      'finalCost', v_cost
    )
  );

  RETURN jsonb_build_object(
    'project', to_jsonb(v_project),
    'baseCost', v_type.base_cost,
    'discountPct', v_discount,
    'finalCost', v_cost,
    'availableBefore', v_available
  );
END;
$$;

REVOKE ALL ON FUNCTION public.propose_city_project(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_city_project(uuid, uuid, uuid) TO authenticated, service_role;

-- Atomic project completion. Row locking makes retries idempotent and every
-- project now deducts its construction cost, including weekly-budget upgrades.
CREATE OR REPLACE FUNCTION public.complete_city_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project public.city_projects%ROWTYPE;
  v_music_scene integer := 0;
  v_local_bonus integer := 0;
  v_venues integer := 0;
  v_population integer := 0;
  v_capacity integer := 0;
  v_weekly_budget bigint := 0;
BEGIN
  SELECT * INTO v_project
  FROM public.city_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND OR v_project.status <> 'in_progress' THEN
    RETURN false;
  END IF;

  IF v_project.completes_at > now() THEN
    RETURN false;
  END IF;

  v_music_scene := COALESCE(NULLIF(v_project.effects ->> 'music_scene', '')::integer, 0);
  v_local_bonus := COALESCE(NULLIF(v_project.effects ->> 'local_bonus', '')::integer, 0);
  v_venues := COALESCE(NULLIF(v_project.effects ->> 'venues', '')::integer, 0);
  v_population := COALESCE(NULLIF(v_project.effects ->> 'population', '')::integer, 0);
  v_capacity := COALESCE(NULLIF(v_project.effects ->> 'max_concert_capacity', '')::integer, 0);
  v_weekly_budget := COALESCE(NULLIF(v_project.effects ->> 'weekly_budget_bonus', '')::bigint, 0);

  UPDATE public.cities
  SET music_scene = COALESCE(music_scene, 0) + v_music_scene,
      local_bonus = COALESCE(local_bonus, 0) + v_local_bonus,
      venues = COALESCE(venues, 0) + v_venues,
      population = COALESCE(population, 0) + v_population
  WHERE id = v_project.city_id;

  IF v_capacity > 0 THEN
    UPDATE public.city_laws
    SET max_concert_capacity = GREATEST(COALESCE(max_concert_capacity, 0), v_capacity),
        updated_at = now()
    WHERE city_id = v_project.city_id
      AND effective_until IS NULL;
  END IF;

  UPDATE public.city_treasury
  SET balance = GREATEST(0, COALESCE(balance, 0) - v_project.cost),
      pending_commitments = GREATEST(0, COALESCE(pending_commitments, 0) - v_project.cost),
      total_spent = COALESCE(total_spent, 0) + v_project.cost,
      weekly_budget = COALESCE(weekly_budget, 0) + v_weekly_budget,
      updated_at = now()
  WHERE city_id = v_project.city_id;

  IF v_project.mayor_id IS NOT NULL THEN
    UPDATE public.city_mayors
    SET approval_rating = LEAST(100, COALESCE(approval_rating, 50) + v_project.approval_change),
        projects_completed = COALESCE(projects_completed, 0) + 1,
        policies_enacted = COALESCE(policies_enacted, 0) + 1
    WHERE id = v_project.mayor_id;
  END IF;

  UPDATE public.city_projects
  SET status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = v_project.id;

  INSERT INTO public.mayor_actions_log (
    city_id, mayor_id, action_type, amount, target_id, notes, metadata
  ) VALUES (
    v_project.city_id,
    v_project.mayor_id,
    'project_completed',
    v_project.cost,
    v_project.id,
    'Completed: ' || v_project.name,
    jsonb_build_object('effects', v_project.effects)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_city_project(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_city_project(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.process_due_city_projects(p_city_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_project_id IN
    SELECT id
    FROM public.city_projects
    WHERE status = 'in_progress'
      AND completes_at <= now()
      AND (p_city_id IS NULL OR city_id = p_city_id)
    ORDER BY completes_at, id
  LOOP
    IF public.complete_city_project(v_project_id) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.process_due_city_projects(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_city_projects(uuid) TO service_role;

-- Cancellation is also transactional. Reserved funds are released and exactly
-- 50% of the project cost is recorded as sunk expenditure.
CREATE OR REPLACE FUNCTION public.cancel_city_project(
  p_project_id uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project public.city_projects%ROWTYPE;
  v_mayor public.city_mayors%ROWTYPE;
  v_penalty bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'city_governance_auth_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'city_governance_profile_forbidden';
  END IF;

  SELECT * INTO v_project
  FROM public.city_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'city_project_not_found';
  END IF;
  IF v_project.status <> 'in_progress' THEN
    RAISE EXCEPTION 'city_project_not_in_progress';
  END IF;

  SELECT * INTO v_mayor
  FROM public.city_mayors
  WHERE city_id = v_project.city_id
    AND profile_id = p_profile_id
    AND is_current = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'city_project_mayor_required';
  END IF;

  v_penalty := v_project.cost - FLOOR(v_project.cost::numeric * 0.5)::bigint;

  PERFORM 1
  FROM public.city_treasury
  WHERE city_id = v_project.city_id
  FOR UPDATE;

  UPDATE public.city_treasury
  SET pending_commitments = GREATEST(0, COALESCE(pending_commitments, 0) - v_project.cost),
      balance = GREATEST(0, COALESCE(balance, 0) - v_penalty),
      total_spent = COALESCE(total_spent, 0) + v_penalty,
      updated_at = now()
  WHERE city_id = v_project.city_id;

  UPDATE public.city_projects
  SET status = 'cancelled',
      completed_at = now(),
      updated_at = now()
  WHERE id = v_project.id;

  UPDATE public.city_mayors
  SET corruption_score = LEAST(100, COALESCE(corruption_score, 0) + 3),
      approval_rating = GREATEST(0, COALESCE(approval_rating, 50) - 2)
  WHERE id = v_mayor.id;

  INSERT INTO public.mayor_actions_log (
    city_id, mayor_id, action_type, amount, target_id, notes, metadata
  ) VALUES (
    v_project.city_id,
    v_mayor.id,
    'project_cancelled',
    v_penalty,
    v_project.id,
    'Cancelled: ' || v_project.name || ' (50% sunk cost)',
    jsonb_build_object('originalCost', v_project.cost, 'sunkCost', v_penalty)
  );

  RETURN jsonb_build_object(
    'projectId', v_project.id,
    'cancelled', true,
    'originalCost', v_project.cost,
    'sunkCost', v_penalty
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_city_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_city_project(uuid, uuid) TO authenticated, service_role;

-- Direct project writes can otherwise bypass the server-calculated price and
-- settlement rules. Reads remain public through the existing policies/grants.
REVOKE INSERT, UPDATE ON public.city_projects FROM anon, authenticated;

-- Candidate registration and voting now validate phase/timing/ownership on the
-- server rather than trusting UI-only checks.
CREATE OR REPLACE FUNCTION public.register_city_candidate(
  p_election_id uuid,
  p_profile_id uuid,
  p_slogan text,
  p_proposed_policies jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_election public.city_elections%ROWTYPE;
  v_candidate public.city_candidates%ROWTYPE;
  v_fame numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'city_election_auth_required';
  END IF;

  SELECT COALESCE(fame, 0)
  INTO v_fame
  FROM public.profiles
  WHERE id = p_profile_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'city_election_profile_forbidden';
  END IF;
  IF v_fame < 100 THEN
    RAISE EXCEPTION 'city_election_fame_required';
  END IF;

  SELECT * INTO v_election
  FROM public.city_elections
  WHERE id = p_election_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'city_election_not_found';
  END IF;
  IF v_election.status <> 'nomination'
     OR now() < v_election.nomination_start
     OR now() >= v_election.nomination_end THEN
    RAISE EXCEPTION 'city_election_nominations_closed';
  END IF;

  INSERT INTO public.city_candidates (
    election_id,
    profile_id,
    campaign_slogan,
    proposed_policies,
    status
  ) VALUES (
    p_election_id,
    p_profile_id,
    NULLIF(BTRIM(p_slogan), ''),
    COALESCE(p_proposed_policies, '{}'::jsonb),
    'approved'
  )
  RETURNING * INTO v_candidate;

  RETURN to_jsonb(v_candidate);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'city_election_already_candidate';
END;
$$;

REVOKE ALL ON FUNCTION public.register_city_candidate(uuid, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_city_candidate(uuid, uuid, text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cast_city_election_vote(
  p_election_id uuid,
  p_candidate_id uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_election public.city_elections%ROWTYPE;
  v_vote public.city_election_votes%ROWTYPE;
  v_profile_city uuid;
  v_has_location boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'city_election_auth_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'city_election_profile_forbidden';
  END IF;

  SELECT * INTO v_election
  FROM public.city_elections
  WHERE id = p_election_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'city_election_not_found';
  END IF;
  IF v_election.status <> 'voting'
     OR now() < v_election.voting_start
     OR now() >= v_election.voting_end THEN
    RAISE EXCEPTION 'city_election_voting_closed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.city_candidates c
    WHERE c.id = p_candidate_id
      AND c.election_id = p_election_id
      AND c.status IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'city_election_candidate_invalid';
  END IF;

  -- Where profile location is available, prevent voting in another city's election.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'current_city_id'
  ) THEN
    EXECUTE 'SELECT current_city_id FROM public.profiles WHERE id = $1'
      INTO v_profile_city USING p_profile_id;
    v_has_location := v_profile_city IS NOT NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'city_id'
  ) THEN
    EXECUTE 'SELECT city_id FROM public.profiles WHERE id = $1'
      INTO v_profile_city USING p_profile_id;
    v_has_location := v_profile_city IS NOT NULL;
  END IF;

  IF v_has_location AND v_profile_city <> v_election.city_id THEN
    RAISE EXCEPTION 'city_election_residency_required';
  END IF;

  INSERT INTO public.city_election_votes (
    election_id, voter_profile_id, candidate_id
  ) VALUES (
    p_election_id, p_profile_id, p_candidate_id
  )
  RETURNING * INTO v_vote;

  RETURN to_jsonb(v_vote);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'city_election_already_voted';
END;
$$;

REVOKE ALL ON FUNCTION public.cast_city_election_vote(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_city_election_vote(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE INSERT ON public.city_candidates FROM anon, authenticated;
REVOKE INSERT ON public.city_election_votes FROM anon, authenticated;

-- Any transition to completed (manual admin action or scheduled lifecycle) now
-- computes the actual winner and installs that profile as the city's new mayor.
CREATE OR REPLACE FUNCTION public.finalize_city_election_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_winner_candidate uuid;
  v_winner_profile uuid;
  v_new_mayor uuid;
  v_total_votes integer := 0;
  v_eligible bigint := 0;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE public.city_candidates c
    SET vote_count = (
      SELECT COUNT(*)::integer
      FROM public.city_election_votes v
      WHERE v.election_id = NEW.id AND v.candidate_id = c.id
    )
    WHERE c.election_id = NEW.id;

    SELECT COUNT(*)::integer
    INTO v_total_votes
    FROM public.city_election_votes
    WHERE election_id = NEW.id;
    NEW.total_votes := v_total_votes;

    SELECT c.id, c.profile_id
    INTO v_winner_candidate, v_winner_profile
    FROM public.city_candidates c
    WHERE c.election_id = NEW.id
      AND c.status IN ('pending', 'approved')
    ORDER BY c.vote_count DESC,
             COALESCE(c.campaign_budget, 0) DESC,
             c.registered_at ASC,
             c.id ASC
    LIMIT 1;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'current_city_id'
    ) THEN
      EXECUTE 'SELECT COUNT(*) FROM public.profiles WHERE current_city_id = $1'
        INTO v_eligible USING NEW.city_id;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'city_id'
    ) THEN
      EXECUTE 'SELECT COUNT(*) FROM public.profiles WHERE city_id = $1'
        INTO v_eligible USING NEW.city_id;
    ELSE
      SELECT COUNT(*) INTO v_eligible FROM public.profiles WHERE user_id IS NOT NULL;
    END IF;

    NEW.voter_turnout_pct := CASE
      WHEN COALESCE(v_eligible, 0) > 0
        THEN LEAST(100, ROUND(v_total_votes::numeric * 100 / v_eligible::numeric, 2))
      ELSE 0
    END;
    NEW.winner_id := v_winner_candidate;

    IF v_winner_profile IS NOT NULL THEN
      UPDATE public.city_mayors
      SET is_current = false,
          term_end = now()
      WHERE city_id = NEW.city_id
        AND is_current = true;

      INSERT INTO public.city_mayors (
        city_id,
        profile_id,
        term_start,
        term_end,
        is_current,
        election_id,
        approval_rating,
        policies_enacted
      ) VALUES (
        NEW.city_id,
        v_winner_profile,
        now(),
        now() + interval '1 year',
        true,
        NEW.id,
        50,
        0
      )
      RETURNING id INTO v_new_mayor;

      IF to_regclass('public.mayor_actions_log') IS NOT NULL THEN
        INSERT INTO public.mayor_actions_log (
          city_id, mayor_id, action_type, target_id, notes, metadata
        ) VALUES (
          NEW.city_id,
          v_new_mayor,
          'election_won',
          NEW.id,
          'Installed mayor from completed city election',
          jsonb_build_object(
            'electionYear', NEW.election_year,
            'candidateId', v_winner_candidate,
            'votes', v_total_votes,
            'turnoutPct', NEW.voter_turnout_pct
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finalize_city_election_on_completion ON public.city_elections;
CREATE TRIGGER finalize_city_election_on_completion
BEFORE UPDATE OF status ON public.city_elections
FOR EACH ROW
EXECUTE FUNCTION public.finalize_city_election_transition();

-- Annual lifecycle: nominations begin 1 Oct, voting begins 1 Dec, and the
-- result is finalised at 00:00 UTC on 1 Jan. The completion trigger above makes
-- manual admin phase advancement use the same winner-installation path.
CREATE OR REPLACE FUNCTION public.process_city_election_lifecycle(
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM p_now AT TIME ZONE 'UTC')::integer;
  v_nomination_start timestamptz;
  v_voting_start timestamptz;
  v_voting_end timestamptz;
  v_created integer := 0;
  v_opened integer := 0;
  v_completed integer := 0;
BEGIN
  v_nomination_start := make_timestamptz(v_year, 10, 1, 0, 0, 0, 'UTC');
  v_voting_start := make_timestamptz(v_year, 12, 1, 0, 0, 0, 'UTC');
  v_voting_end := make_timestamptz(v_year + 1, 1, 1, 0, 0, 0, 'UTC');

  IF p_now >= v_nomination_start THEN
    INSERT INTO public.city_elections (
      city_id,
      election_year,
      status,
      nomination_start,
      nomination_end,
      voting_start,
      voting_end,
      total_votes
    )
    SELECT
      c.id,
      v_year,
      'nomination',
      v_nomination_start,
      v_voting_start,
      v_voting_start,
      v_voting_end,
      0
    FROM public.cities c
    ON CONFLICT (city_id, election_year) DO NOTHING;
    GET DIAGNOSTICS v_created = ROW_COUNT;
  END IF;

  UPDATE public.city_elections
  SET status = 'voting'
  WHERE status = 'nomination'
    AND voting_start <= p_now;
  GET DIAGNOSTICS v_opened = ROW_COUNT;

  UPDATE public.city_elections
  SET status = 'completed'
  WHERE status = 'voting'
    AND voting_end <= p_now;
  GET DIAGNOSTICS v_completed = ROW_COUNT;

  RETURN jsonb_build_object(
    'created', v_created,
    'openedVoting', v_opened,
    'completed', v_completed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_city_election_lifecycle(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_city_election_lifecycle(timestamptz) TO service_role;

-- city_laws is the source of truth for policy. Keep the older treasury tax_rate_pct
-- column as a compatibility mirror so admin/legacy reporting cannot drift.
CREATE OR REPLACE FUNCTION public.sync_city_treasury_income_tax_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.effective_until IS NULL THEN
    UPDATE public.city_treasury
    SET tax_rate_pct = ROUND(NEW.income_tax_rate)::integer,
        updated_at = now()
    WHERE city_id = NEW.city_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_city_treasury_income_tax_rate_trigger ON public.city_laws;
CREATE TRIGGER sync_city_treasury_income_tax_rate_trigger
AFTER INSERT OR UPDATE OF income_tax_rate, effective_until ON public.city_laws
FOR EACH ROW
EXECUTE FUNCTION public.sync_city_treasury_income_tax_rate();

UPDATE public.city_treasury t
SET tax_rate_pct = ROUND(l.income_tax_rate)::integer,
    updated_at = now()
FROM public.city_laws l
WHERE l.city_id = t.city_id
  AND l.effective_until IS NULL
  AND t.tax_rate_pct IS DISTINCT FROM ROUND(l.income_tax_rate)::integer;

CREATE OR REPLACE FUNCTION public.process_city_governance_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_projects integer := 0;
  v_elections jsonb := '{}'::jsonb;
BEGIN
  v_projects := public.process_due_city_projects(NULL);
  v_elections := public.process_city_election_lifecycle(now());

  RETURN jsonb_build_object(
    'projectsCompleted', v_projects,
    'elections', v_elections,
    'processedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_city_governance_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_city_governance_tick() TO service_role;

-- Reusing the job name keeps repeated migration application from creating
-- multiple governance workers, matching the repository's existing cron pattern.
SELECT cron.schedule(
  'city-governance-tick',
  '*/15 * * * *',
  $cron$SELECT public.process_city_governance_tick();$cron$
);

-- Process any already-due projects/elections immediately when deployed.
SELECT public.process_city_governance_tick();

NOTIFY pgrst, 'reload schema';
