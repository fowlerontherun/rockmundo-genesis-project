-- Attribute new wins to the band or exact character that owns the nominee.
-- Legacy receipts retain their original attribution and no awards run on deploy.
ALTER TABLE public.award_wins ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX award_wins_profile_id_idx ON public.award_wins(profile_id) WHERE profile_id IS NOT NULL;

-- A band owns its catalogue. A solo song uses its owning character. A solo
-- album is eligible only when every track points to the same character on the
-- release account. Never guess a wallet from a submitter or an account ID.
CREATE FUNCTION public._award_nominee_recipient(n public.award_nominations)
RETURNS TABLE (band_id uuid, profile_id uuid, winner_name text)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  WITH identity AS (
    SELECT CASE WHEN n.nominee_id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      THEN n.nominee_id::uuid END AS id
  ), nominee AS (
    SELECT b.id AS band_id, NULL::uuid AS profile_id, b.name AS winner_name
    FROM public.bands b
    WHERE n.nominee_type = 'band' AND b.id = n.band_id AND b.id::text = n.nominee_id
    UNION ALL
    SELECT NULL, p.id, coalesce(nullif(p.display_name,''),p.username)
    FROM public.profiles p
    WHERE n.nominee_type = 'player' AND p.id = (SELECT id FROM identity)
    UNION ALL
    SELECT s.band_id, CASE WHEN s.band_id IS NULL THEN s.profile_id END, s.title
    FROM public.songs s
    WHERE n.nominee_type = 'song' AND s.id = (SELECT id FROM identity)
      AND (s.completed_at IS NOT NULL OR s.status = 'recorded')
    UNION ALL
    SELECT r.band_id, solo.profile_id, r.title
    FROM public.releases r
    LEFT JOIN LATERAL (
      SELECT (array_agg(s.profile_id))[1] AS profile_id
      FROM public.release_songs rs
      LEFT JOIN public.songs s ON s.id = rs.song_id
      LEFT JOIN public.profiles p ON p.id = s.profile_id
      WHERE rs.release_id = r.id
      HAVING count(*) > 0 AND count(DISTINCT s.profile_id) = 1
        AND bool_and(coalesce(p.user_id = r.user_id AND s.band_id IS NULL, false))
    ) solo ON r.band_id IS NULL
    WHERE n.nominee_type = 'album' AND r.id = (SELECT id FROM identity)
      AND lower(r.release_type) = 'album' AND r.release_status = 'released'
  )
  SELECT a.band_id, a.profile_id, a.winner_name
  FROM nominee a
  LEFT JOIN public.bands b ON b.id = a.band_id
  JOIN public.profiles p ON p.id = coalesce(b.leader_id,a.profile_id)
  WHERE p.user_id IS NOT NULL
    AND (a.band_id IS NOT NULL OR (p.deleted_at IS NULL AND p.died_at IS NULL))
    AND (n.band_id IS NULL OR n.band_id = a.band_id)
$$;

REVOKE ALL ON FUNCTION public._award_nominee_recipient(public.award_nominations)
  FROM PUBLIC, anon, authenticated, service_role;

-- Officials submit catalogue or character nominations for review through the
-- same phase lock as settlement. Public submissions retain their existing rules.
CREATE FUNCTION public.award_admin_submit_typed_nomination(
  p_show_id uuid, p_category text, p_nominee_type text, p_nominee_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_show public.award_shows%ROWTYPE;
  v_nom public.award_nominations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
    RAISE EXCEPTION 'Only award administrators can submit typed nominations' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_show FROM public.award_shows WHERE id=p_show_id FOR SHARE;
  IF v_show.status IS DISTINCT FROM 'nominations_open' THEN
    RAISE EXCEPTION 'This award show is not accepting nominations' USING ERRCODE='23514';
  END IF;
  IF p_nominee_type IS NULL OR p_nominee_type NOT IN ('player','song','album')
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_show.categories) c WHERE c->>'name'=p_category
    ) THEN
    RAISE EXCEPTION 'Invalid nominee type or award category' USING ERRCODE='22023';
  END IF;

  v_nom.nominee_type := p_nominee_type;
  v_nom.nominee_id := p_nominee_id::text;
  SELECT r.band_id, r.winner_name INTO v_nom.band_id, v_nom.nominee_name
    FROM public._award_nominee_recipient(v_nom) r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nominee has no eligible band or character owner' USING ERRCODE='23514';
  END IF;

  INSERT INTO public.award_nominations (
    award_show_id,category_name,nominee_type,nominee_id,nominee_name,band_id,user_id,submission_data
  ) VALUES (
    p_show_id,p_category,p_nominee_type,p_nominee_id::text,v_nom.nominee_name,v_nom.band_id,
    auth.uid(),jsonb_build_object('nomination_source','admin_submission')
  ) RETURNING id INTO v_nom.id;
  RETURN v_nom.id;
END;
$$;

REVOKE ALL ON FUNCTION public.award_admin_submit_typed_nomination(uuid,text,text,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_admin_submit_typed_nomination(uuid,text,text,uuid)
  TO authenticated;

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
      'band_id',w.band_id,'profile_id',w.profile_id,'weighted_votes',null,
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
        NOT EXISTS (SELECT 1 FROM public._award_nominee_recipient(n))
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
  v_profile_id uuid;
  v_band_id uuid;
  v_winner_name text;
  v_cash_context text;
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
      'band_id',w.band_id,'profile_id',w.profile_id,'fame',w.fame_boost,'money',w.prize_money
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
    SELECT recipient.band_id, recipient.profile_id, recipient.winner_name
      INTO STRICT v_band_id, v_profile_id, v_winner_name
      FROM public._award_nominee_recipient(v_nom) recipient;

    IF v_band_id IS NOT NULL THEN
      SELECT * INTO STRICT v_band FROM public.bands WHERE id=v_band_id FOR UPDATE;
      SELECT p.user_id INTO STRICT v_user_id FROM public.profiles p
        WHERE p.id=v_band.leader_id AND p.user_id IS NOT NULL;
    ELSE
      SELECT p.user_id INTO STRICT v_user_id FROM public.profiles p
        WHERE p.id=v_profile_id AND p.user_id IS NOT NULL
          AND p.deleted_at IS NULL AND p.died_at IS NULL
        FOR UPDATE;
    END IF;

    INSERT INTO public.award_wins (
      award_show_id,category_name,winner_name,band_id,profile_id,user_id,
      fame_boost,prize_money
    ) VALUES (
      p_show_id,v_nom.category_name,v_winner_name,v_band_id,v_profile_id,v_user_id,
      v_show.winner_fame_boost,v_show.winner_prize_money
    ) RETURNING id INTO v_win_id;

    IF v_band_id IS NOT NULL THEN
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
    ELSE
      v_cash_context := current_setting('app.player_cash_context', true);
      PERFORM set_config('app.player_cash_context', jsonb_build_object(
        'classification','award_show_prize',
        'display_category','award_show_prize',
        'description','Award winner: ' || v_show.show_name || ' — ' || v_nom.category_name,
        'idempotency_key','award-win:' || v_win_id::text
      )::text, true);
      UPDATE public.profiles
        SET fame=coalesce(fame,0)+v_show.winner_fame_boost,
            cash=coalesce(cash,0)+v_show.winner_prize_money
        WHERE id=v_profile_id;
      PERFORM set_config('app.player_cash_context',coalesce(v_cash_context,''),true);
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
        'winner',v_winner_name,'band_id',v_band_id,'profile_id',v_profile_id,
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

CREATE OR REPLACE FUNCTION public.notify_award_winner_receipt()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_show_name text;
  v_message text;
BEGIN
  IF NEW.band_id IS NULL AND NEW.profile_id IS NULL THEN RETURN NEW; END IF;

  SELECT show_name INTO v_show_name FROM public.award_shows
   WHERE id=NEW.award_show_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Award show missing for winner notification';
  END IF;

  v_message := NEW.winner_name || ' won ' || NEW.category_name
    || ' at ' || v_show_name
    || '. Fame awarded: +' || NEW.fame_boost::text
    || CASE WHEN NEW.prize_money > 0
       THEN '. Prize: $' || NEW.prize_money::text
       ELSE '' END || '.';

  -- One notification per living band character, including the leader.
  -- The normal inbox is profile-scoped; a user_id-only notice would not
  -- show consistently in the character's unread notification counter.
  INSERT INTO public.notifications (
    user_id, profile_id, category, type, title, message, action_path, metadata
  )
  SELECT p.user_id, p.id, 'awards', 'success',
    'Award won: ' || NEW.category_name, v_message, '/awards',
    jsonb_build_object(
      'award_win_id',NEW.id,'award_show_id',NEW.award_show_id,
      'band_id',NEW.band_id,'category_name',NEW.category_name
    )
  FROM public.profiles p
  WHERE p.user_id IS NOT NULL
    AND p.deleted_at IS NULL AND p.died_at IS NULL
    AND (
      p.id=NEW.profile_id
      OR p.id=(SELECT b.leader_id FROM public.bands b WHERE b.id=NEW.band_id)
      OR EXISTS (
        SELECT 1 FROM public.band_members bm
        WHERE bm.band_id=NEW.band_id AND bm.profile_id=p.id
          AND bm.member_status='active'
      )
    )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_achievement_stat(p_profile_id uuid, p_key text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_value numeric;
BEGIN
  SELECT user_id INTO v_user_id FROM public.profiles WHERE id = p_profile_id;
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  CASE p_key
    WHEN 'join' THEN RETURN 1;
    WHEN 'level' THEN
      SELECT level INTO v_value FROM public.profiles WHERE id = p_profile_id;
      RETURN coalesce(v_value, 1);
    WHEN 'gigs_played' THEN
      SELECT count(DISTINCT gp.gig_id)::numeric INTO v_value
        FROM public.gig_performers gp
        JOIN public.gigs g ON g.id = gp.gig_id
       WHERE gp.profile_id = p_profile_id
         AND (g.status = 'completed' OR g.completed_at IS NOT NULL OR gp.performed_at IS NOT NULL);
      RETURN coalesce(v_value, 0);
    WHEN 'songs_written' THEN
      SELECT count(DISTINCT s.id)::numeric INTO v_value
        FROM public.songs s
       WHERE (s.profile_id = p_profile_id)
         AND (s.completed_at IS NOT NULL OR s.status = 'recorded');
      RETURN coalesce(v_value, 0);
    WHEN 'albums_released' THEN
      SELECT count(DISTINCT r.id)::numeric INTO v_value
        FROM public.releases r
       WHERE lower(r.release_type) = 'album'
         AND r.release_status = 'released'
         AND (EXISTS(
             SELECT 1 FROM public.release_songs rs
             JOIN public.songs authored ON authored.id=rs.song_id
             WHERE rs.release_id=r.id AND authored.profile_id=p_profile_id
           ) OR r.band_id IN (
             SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id=p_profile_id
           ));
      RETURN coalesce(v_value, 0);
    WHEN 'eps_released' THEN
      SELECT count(DISTINCT r.id)::numeric INTO v_value
        FROM public.releases r
       WHERE lower(r.release_type) IN ('ep', 'e.p.')
         AND r.release_status = 'released'
         AND (EXISTS(
             SELECT 1 FROM public.release_songs rs
             JOIN public.songs authored ON authored.id=rs.song_id
             WHERE rs.release_id=r.id AND authored.profile_id=p_profile_id
           ) OR r.band_id IN (
             SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id=p_profile_id
           ));
      RETURN coalesce(v_value, 0);
    WHEN 'awards_won' THEN
      SELECT count(DISTINCT aw.id)::numeric INTO v_value
        FROM public.award_wins aw
       WHERE aw.profile_id = p_profile_id OR aw.band_id IN (
          SELECT bm.band_id FROM public.band_members bm
          WHERE bm.profile_id = p_profile_id AND bm.joined_at <= aw.won_at
        );
      RETURN coalesce(v_value, 0);
    WHEN 'award_nominations' THEN
      SELECT count(DISTINCT an.id)::numeric INTO v_value
        FROM public.award_nominations an
       WHERE (an.nominee_type IN ('artist','solo','player') AND an.nominee_id=p_profile_id::text)
          OR an.band_id IN (
            SELECT bm.band_id FROM public.band_members bm
            WHERE bm.profile_id=p_profile_id AND bm.joined_at <= an.created_at
          );
      RETURN coalesce(v_value, 0);
    WHEN 'chart_entries' THEN
      SELECT count(DISTINCT ce.id)::numeric INTO v_value
        FROM public.chart_entries ce
        JOIN public.songs s ON s.id = ce.song_id
       WHERE s.profile_id = p_profile_id
          OR s.band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id);
      RETURN coalesce(v_value, 0);
    WHEN 'top_40' THEN
      SELECT count(DISTINCT ce.id)::numeric INTO v_value
        FROM public.chart_entries ce
        JOIN public.songs s ON s.id = ce.song_id
       WHERE ce.rank BETWEEN 1 AND 40
         AND (s.profile_id = p_profile_id
          OR s.band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id));
      RETURN coalesce(v_value, 0);
    WHEN 'top_10' THEN
      SELECT count(DISTINCT ce.id)::numeric INTO v_value
        FROM public.chart_entries ce
        JOIN public.songs s ON s.id = ce.song_id
       WHERE ce.rank BETWEEN 1 AND 10
         AND (s.profile_id = p_profile_id
          OR s.band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id));
      RETURN coalesce(v_value, 0);
    WHEN 'chart_position' THEN
      SELECT min(ce.rank)::numeric INTO v_value
        FROM public.chart_entries ce
        JOIN public.songs s ON s.id = ce.song_id
       WHERE s.profile_id = p_profile_id
          OR s.band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id);
      RETURN v_value;
    WHEN 'guitar_skill' THEN
      SELECT max(coalesce(sp.current_level, 0))::numeric INTO v_value
        FROM public.skill_progress sp
       WHERE sp.profile_id = p_profile_id
         AND (sp.skill_slug = 'guitar' OR sp.skill_slug LIKE '%guitar%');
      RETURN coalesce(v_value, 0);
    WHEN 'vocals_skill' THEN
      SELECT max(coalesce(sp.current_level, 0))::numeric INTO v_value
        FROM public.skill_progress sp
       WHERE sp.profile_id = p_profile_id
         AND (sp.skill_slug = 'vocals' OR sp.skill_slug LIKE '%vocal%');
      RETURN coalesce(v_value, 0);
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.seal_award_settlement_snapshot()
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
    NEW.id, 'weighted-ballots-v2', NEW.categories,
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
      'band_id', w.band_id, 'profile_id', w.profile_id, 'fame', w.fame_boost, 'money', w.prize_money
    ) ORDER BY w.category_name, w.id)
    FROM public.award_wins w WHERE w.award_show_id = NEW.id)
  );
  RETURN NEW;
END;
$$;

