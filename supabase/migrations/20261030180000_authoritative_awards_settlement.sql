-- Authoritative awards settlement. No automatic backfill or payouts on deploy.
-- An administrator must preview then explicitly finalise a LIVE ceremony.
-- Winning bands receive their prize via the existing band_earnings trigger;
-- never update band_balance separately or the treasury would double-credit.
-- Zero-ballot categories are shown as unawarded rather than picking a random winner.

CREATE UNIQUE INDEX IF NOT EXISTS band_earnings_one_awards_prize_per_win
  ON public.band_earnings ((metadata->>'award_win_id'))
  WHERE source = 'award_show_prize'
    AND metadata->>'award_win_id' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.award_admin_preview_results(p_show_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_show public.award_shows%ROWTYPE;
  v_results jsonb := '[]'::jsonb;
  v_unawarded jsonb := '[]'::jsonb;
  v_pending integer;
  v_disputed_votes integer;
  v_invalid integer;
  v_existing integer;
  v_awards integer;
BEGIN
  IF auth.uid() IS NULL
    OR NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
    RAISE EXCEPTION 'Only award administrators can preview results'
      USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_show FROM public.award_shows WHERE id=p_show_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Award show not found' USING ERRCODE='P0002';
  END IF;

  IF v_show.status='completed' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'category',w.category_name,'nominee',w.winner_name,
      'band_id',w.band_id,'weighted_votes',null,
      'ballots',null,'will_award',true,'published',true
    ) ORDER BY w.category_name),'[]'::jsonb)
    INTO v_results FROM public.award_wins w
    WHERE w.award_show_id=p_show_id;
    RETURN jsonb_build_object(
      'show_id',p_show_id,'show_name',v_show.show_name,'status',v_show.status,
      'results',v_results,'awards_to_issue',0,
      'winner_fame_boost',v_show.winner_fame_boost,
      'winner_prize_money',v_show.winner_prize_money,
      'pending_nominations',0,'ballots_on_nonfinalists',0,
      'invalid_shortlisted_nominations',0,
      'existing_wins',jsonb_array_length(v_results),
      'unawarded_categories','[]'::jsonb,'ready',false
    );
  END IF;

  SELECT count(*) FILTER (WHERE status='pending')
    INTO v_pending FROM public.award_nominations WHERE award_show_id=p_show_id;
  SELECT count(*) INTO v_disputed_votes
    FROM public.award_votes v
    JOIN public.award_nominations n ON n.id=v.nomination_id
    WHERE n.award_show_id=p_show_id AND n.status <> 'shortlisted';
  SELECT count(*) INTO v_invalid
    FROM public.award_nominations n
    WHERE n.award_show_id=p_show_id AND n.status='shortlisted'
      AND (
        n.nominee_type <> 'band' OR n.band_id IS NULL
        OR n.nominee_id IS DISTINCT FROM n.band_id::text
        OR NOT EXISTS (
          SELECT 1 FROM public.bands b
          JOIN public.profiles p ON p.id=b.leader_id
          WHERE b.id=n.band_id AND p.user_id IS NOT NULL
        )
        OR NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_show.categories) c
          WHERE c->>'name'=n.category_name
        )
      );
  SELECT count(*) INTO v_existing FROM public.award_wins WHERE award_show_id=p_show_id;

  -- Authoritative ballot rows (not the editable vote_count projection) are
  -- ranked by weighted votes, number of ballots, then first nomination date/ID.
  WITH tallies AS (
    SELECT n.id,n.category_name,n.nominee_name,n.nominee_type,n.band_id,
      n.created_at,coalesce(sum(v.weight),0)::numeric AS points,
      count(v.id)::integer AS ballots
    FROM public.award_nominations n
    LEFT JOIN public.award_votes v ON v.nomination_id=n.id
    WHERE n.award_show_id=p_show_id AND n.status='shortlisted'
    GROUP BY n.id
  ), ranked AS (
    SELECT t.*,row_number() OVER (
      PARTITION BY t.category_name
      ORDER BY t.points DESC,t.ballots DESC,t.created_at ASC,t.id ASC
    ) AS position,
    count(*) OVER (PARTITION BY t.category_name,t.points,t.ballots) AS tied_count
    FROM tallies t
  )
  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'category',r.category_name,'nomination_id',r.id,
      'nominee',r.nominee_name,'nominee_type',r.nominee_type,'band_id',r.band_id,
      'weighted_votes',r.points,'ballots',r.ballots,
      'tied_on_votes',r.tied_count > 1,
      'will_award',r.ballots > 0 AND r.points > 0
    ) ORDER BY r.category_name),'[]'::jsonb),
    count(*) FILTER (WHERE r.ballots > 0 AND r.points > 0)::integer
  INTO v_results,v_awards
  FROM ranked r WHERE r.position=1;

  SELECT coalesce(jsonb_agg(category_name ORDER BY category_name),'[]'::jsonb)
  INTO v_unawarded
  FROM (
    SELECT DISTINCT c->>'name' AS category_name
    FROM jsonb_array_elements(v_show.categories) c
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_results) r
      WHERE r->>'category'=c->>'name'
        AND (r->>'will_award')::boolean
    )
  ) missing;

  RETURN jsonb_build_object(
    'show_id',p_show_id,'show_name',v_show.show_name,'status',v_show.status,
    'ceremony_date',v_show.ceremony_date,
    'winner_fame_boost',v_show.winner_fame_boost,
    'winner_prize_money',v_show.winner_prize_money,
    'results',v_results,'awards_to_issue',v_awards,
    'unawarded_categories',v_unawarded,'pending_nominations',v_pending,
    'ballots_on_nonfinalists',v_disputed_votes,
    'invalid_shortlisted_nominations',v_invalid,
    'existing_wins',v_existing,
    'ready',
      v_show.status='live'
      AND v_show.ceremony_date IS NOT NULL
      AND v_show.ceremony_date <= now()
      AND v_show.winner_prize_money >= 0 AND v_show.winner_fame_boost >= 0
      AND v_pending=0 AND v_disputed_votes=0 AND v_invalid=0
      AND v_existing=0 AND v_awards>0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.award_admin_finalize_show(p_show_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_show public.award_shows%ROWTYPE;
  v_preview jsonb;
  v_result jsonb;
  v_nom public.award_nominations%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_user_id uuid;
  v_win_id uuid;
  v_awards_issued integer := 0;
  v_awards_json jsonb := '[]'::jsonb;
  v_runner_up_id uuid;
BEGIN
  IF auth.uid() IS NULL
    OR NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
    RAISE EXCEPTION 'Only award administrators can settle results'
      USING ERRCODE='42501';
  END IF;

  -- Serialize competing administrators and make every retry idempotent.
  SELECT * INTO v_show FROM public.award_shows
    WHERE id=p_show_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Award show not found' USING ERRCODE='P0002';
  END IF;
  IF v_show.status='completed' THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',w.id,'category',w.category_name,'winner',w.winner_name,
      'band_id',w.band_id,'fame',w.fame_boost,'money',w.prize_money
    ) ORDER BY w.category_name),'[]'::jsonb)
    INTO v_awards_json FROM public.award_wins w
    WHERE w.award_show_id=p_show_id;
    RETURN jsonb_build_object(
      'already_completed',true,'show_id',p_show_id,'winners',v_awards_json
    );
  END IF;

  -- Lock nominees so review operations cannot race the result snapshot.
  PERFORM 1 FROM public.award_nominations
    WHERE award_show_id=p_show_id ORDER BY id FOR UPDATE;

  v_preview := public.award_admin_preview_results(p_show_id);
  IF NOT coalesce((v_preview->>'ready')::boolean,false) THEN
    RAISE EXCEPTION 'Awards cannot be finalised; review preview blockers: %',
      v_preview::text USING ERRCODE='23514';
  END IF;

  -- A negative legacy vote weight should never choose a winner.
  IF EXISTS (
    SELECT 1 FROM public.award_votes v
    JOIN public.award_nominations n ON n.id=v.nomination_id
    WHERE n.award_show_id=p_show_id AND v.weight <= 0
  ) THEN
    RAISE EXCEPTION 'Invalid ballot weight in award show'
      USING ERRCODE='23514';
  END IF;

  FOR v_result IN SELECT value FROM jsonb_array_elements(v_preview->'results')
  LOOP
    IF NOT (v_result->>'will_award')::boolean THEN CONTINUE; END IF;

    SELECT * INTO STRICT v_nom FROM public.award_nominations
      WHERE id=(v_result->>'nomination_id')::uuid
        AND award_show_id=p_show_id AND status='shortlisted';
    SELECT * INTO STRICT v_band FROM public.bands
      WHERE id=v_nom.band_id FOR UPDATE;
    SELECT p.user_id INTO v_user_id FROM public.profiles p
      WHERE p.id=v_band.leader_id;
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Winning band has no valid account owner'
        USING ERRCODE='23514';
    END IF;

    INSERT INTO public.award_wins (
      award_show_id,category_name,winner_name,band_id,user_id,
      fame_boost,prize_money
    ) VALUES (
      p_show_id,v_nom.category_name,v_band.name,v_band.id,v_user_id,
      v_show.winner_fame_boost,v_show.winner_prize_money
    ) RETURNING id INTO v_win_id;

    -- The finance ledger's existing INSERT trigger credits both band balance
    -- and primary treasury; directly updating band_balance here would double pay.
    IF v_show.winner_prize_money > 0 THEN
      INSERT INTO public.band_earnings (
        band_id,amount,source,description,earned_by_user_id,metadata
      ) VALUES (
        v_band.id,v_show.winner_prize_money,'award_show_prize',
        'Award winner: ' || v_show.show_name || ' — ' || v_nom.category_name,
        v_user_id,
        jsonb_build_object(
          'award_win_id',v_win_id,'award_show_id',p_show_id,
          'category_name',v_nom.category_name
        )
      );
    END IF;

    IF v_show.winner_fame_boost > 0 THEN
      UPDATE public.bands
        SET fame=coalesce(fame,0)+v_show.winner_fame_boost,
            collective_fame_earned=coalesce(collective_fame_earned,0)+v_show.winner_fame_boost
      WHERE id=v_band.id;
    END IF;
    UPDATE public.award_nominations SET status='winner' WHERE id=v_nom.id;

    -- Runner-up is the next eligible nominee, not every unsuccessful entrant.
    SELECT ranked.id INTO v_runner_up_id
    FROM (
      SELECT n.id,
        coalesce(sum(v.weight),0)::numeric AS score,
        count(v.id)::integer AS ballots,n.created_at
      FROM public.award_nominations n
      LEFT JOIN public.award_votes v ON v.nomination_id=n.id
      WHERE n.award_show_id=p_show_id
        AND n.category_name=v_nom.category_name AND n.status='shortlisted'
      GROUP BY n.id
      ORDER BY score DESC,ballots DESC,n.created_at ASC,n.id ASC
      LIMIT 1
    ) ranked WHERE ranked.score>0 AND ranked.ballots>0;
    IF v_runner_up_id IS NOT NULL THEN
      UPDATE public.award_nominations SET status='runner_up'
        WHERE id=v_runner_up_id;
    END IF;

    v_awards_issued := v_awards_issued + 1;
    v_awards_json := v_awards_json || jsonb_build_array(
      jsonb_build_object(
        'id',v_win_id,'category',v_nom.category_name,
        'winner',v_band.name,'band_id',v_band.id,
        'fame',v_show.winner_fame_boost,'money',v_show.winner_prize_money
      )
    );
  END LOOP;

  IF v_awards_issued=0 THEN
    RAISE EXCEPTION 'No award results eligible for settlement'
      USING ERRCODE='23514';
  END IF;
  UPDATE public.award_shows SET status='completed' WHERE id=p_show_id;

  RETURN jsonb_build_object(
    'already_completed',false,'show_id',p_show_id,
    'awards_issued',v_awards_issued,'winners',v_awards_json,
    'unawarded_categories',v_preview->'unawarded_categories'
  );
END;
$$;

-- SECURITY DEFINER only for needed server-side ledger and status updates.
-- All entry points require a real authenticated admin account.
REVOKE ALL ON FUNCTION public.award_admin_preview_results(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.award_admin_finalize_show(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_admin_preview_results(uuid)
  TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.award_admin_finalize_show(uuid)
  TO authenticated,service_role;

-- Historic nominations were allowed to receive votes before shortlist.
-- Permit an administrator to explicitly shortlist one, preserving its ballots.
-- Never silently drop or reject an existing vote.
CREATE OR REPLACE FUNCTION public.award_admin_review_nomination(
  p_nomination_id uuid, p_decision text
)
RETURNS public.award_nominations
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_nomination public.award_nominations%ROWTYPE;
  v_show_id uuid;
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
  -- Lock the show before nomination, matching finalisation's lock order.
  -- This prevents admin review/finalisation deadlocks.
  SELECT award_show_id INTO v_show_id
    FROM public.award_nominations WHERE id=p_nomination_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nomination not found' USING ERRCODE='P0002';
  END IF;
  SELECT status INTO v_show_status FROM public.award_shows
    WHERE id=v_show_id FOR SHARE;
  IF NOT FOUND OR v_show_status <> 'nominations_open' THEN
    RAISE EXCEPTION 'Nomination review is closed for this show'
      USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_nomination FROM public.award_nominations
    WHERE id=p_nomination_id AND award_show_id=v_show_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nomination disappeared during review'
      USING ERRCODE='P0002';
  END IF;
  IF v_nomination.status IN ('winner','runner_up') THEN
    RAISE EXCEPTION 'Settled nominations cannot be reviewed'
      USING ERRCODE='23514';
  END IF;
  IF p_decision='rejected' AND EXISTS (
    SELECT 1 FROM public.award_votes WHERE nomination_id=p_nomination_id
  ) THEN
    RAISE EXCEPTION 'Cannot reject a nomination with existing ballots; shortlist to preserve votes'
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
REVOKE ALL ON FUNCTION public.award_admin_review_nomination(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_admin_review_nomination(uuid,text)
  TO authenticated,service_role;
