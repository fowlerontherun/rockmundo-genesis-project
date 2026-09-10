-- Apply equipped clothing bonuses to authoritative gameplay paths.
-- Depends on 20260910165000_clothing_gameplay_bonuses.sql.

-- ---------------------------------------------------------------------------
-- Daily stipend XP/AP
-- ---------------------------------------------------------------------------
-- The progression edge function inserts the daily grant and then upserts the
-- wallet. Applying the bonus in a BEFORE wallet trigger keeps the server-side
-- wallet authoritative and lets us amend the already-created grant for audit.
CREATE OR REPLACE FUNCTION public.apply_daily_clothing_bonus_to_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus record;
  v_today date := timezone('utc', now())::date;
  v_is_new_claim boolean := false;
BEGIN
  IF NEW.profile_id IS NULL OR NEW.last_stipend_claim_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_new_claim := NEW.last_stipend_claim_date::date = v_today
    AND (TG_OP = 'INSERT' OR OLD.last_stipend_claim_date IS DISTINCT FROM NEW.last_stipend_claim_date);

  IF NOT v_is_new_claim THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_bonus FROM public.get_equipped_clothing_bonuses(NEW.profile_id);
  IF COALESCE(v_bonus.daily_xp, 0) = 0 AND COALESCE(v_bonus.daily_ap, 0) = 0 THEN
    RETURN NEW;
  END IF;

  NEW.skill_xp_balance := COALESCE(NEW.skill_xp_balance, NEW.xp_balance, 0) + COALESCE(v_bonus.daily_xp, 0);
  NEW.skill_xp_lifetime := COALESCE(NEW.skill_xp_lifetime, NEW.lifetime_xp, 0) + COALESCE(v_bonus.daily_xp, 0);
  NEW.xp_balance := COALESCE(NEW.xp_balance, NEW.skill_xp_balance, 0) + COALESCE(v_bonus.daily_xp, 0);
  NEW.lifetime_xp := COALESCE(NEW.lifetime_xp, NEW.skill_xp_lifetime, 0) + COALESCE(v_bonus.daily_xp, 0);
  NEW.attribute_points_balance := COALESCE(NEW.attribute_points_balance, 0) + COALESCE(v_bonus.daily_ap, 0);
  NEW.attribute_points_lifetime := COALESCE(NEW.attribute_points_lifetime, 0) + COALESCE(v_bonus.daily_ap, 0);

  UPDATE public.profile_daily_xp_grants
  SET
    xp_amount = COALESCE(xp_amount, 0) + COALESCE(v_bonus.daily_xp, 0),
    attribute_points_amount = COALESCE(attribute_points_amount, 0) + COALESCE(v_bonus.daily_ap, 0),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'clothing_bonus_xp', COALESCE(v_bonus.daily_xp, 0),
      'clothing_bonus_ap', COALESCE(v_bonus.daily_ap, 0),
      'clothing_bonus_items', COALESCE(v_bonus.equipped_bonus_items, 0)
    )
  WHERE profile_id = NEW.profile_id
    AND grant_date = v_today
    AND source = 'daily_stipend';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_daily_clothing_bonus_to_wallet ON public.player_xp_wallet;
CREATE TRIGGER trg_apply_daily_clothing_bonus_to_wallet
BEFORE INSERT OR UPDATE OF last_stipend_claim_date ON public.player_xp_wallet
FOR EACH ROW
EXECUTE FUNCTION public.apply_daily_clothing_bonus_to_wallet();

-- ---------------------------------------------------------------------------
-- Songwriting final quality
-- ---------------------------------------------------------------------------
-- Preserve the existing server-authoritative songwriting function and wrap it
-- once so the clothing modifier is applied after the normal outcome formula.
DO $$
BEGIN
  IF to_regprocedure('public.complete_songwriting_project_base(uuid,uuid,text,uuid)') IS NULL
     AND to_regprocedure('public.complete_songwriting_project(uuid,uuid,text,uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.complete_songwriting_project(uuid, uuid, text, uuid)
      RENAME TO complete_songwriting_project_base;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_songwriting_project(
  p_profile_id uuid,
  p_project_id uuid,
  p_catalog_status text DEFAULT 'private',
  p_band_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_bonus record;
  v_base_score integer;
  v_final_score integer;
  v_song_id uuid;
  v_breakdown jsonb;
BEGIN
  v_result := public.complete_songwriting_project_base(
    p_profile_id,
    p_project_id,
    p_catalog_status,
    p_band_id
  );

  -- Duplicate calls return the already-adjusted persisted result.
  IF COALESCE((v_result->>'duplicate')::boolean, false) THEN
    RETURN v_result;
  END IF;

  SELECT * INTO v_bonus FROM public.get_equipped_clothing_bonuses(p_profile_id);
  IF COALESCE(v_bonus.songwriting_pct, 0) <= 0 THEN
    RETURN v_result;
  END IF;

  v_song_id := NULLIF(v_result->>'song_id', '')::uuid;
  v_base_score := COALESCE((v_result->>'final_score')::integer, 0);
  v_final_score := LEAST(1000, round(v_base_score * (1 + v_bonus.songwriting_pct / 100.0))::integer);
  v_breakdown := COALESCE(v_result->'breakdown', '{}'::jsonb) || jsonb_build_object(
    'clothing_bonus_pct', v_bonus.songwriting_pct,
    'clothing_bonus_items', v_bonus.equipped_bonus_items,
    'pre_clothing_score', v_base_score,
    'final_score', v_final_score
  );

  UPDATE public.songs
  SET quality_score = v_final_score,
      song_rating = v_final_score,
      songwriting_breakdown = v_breakdown
  WHERE id = v_song_id;

  UPDATE public.songwriting_projects
  SET song_rating = v_final_score,
      quality_score = LEAST(100, round(v_final_score / 10.0)),
      songwriting_breakdown = v_breakdown,
      songwriting_input_snapshot = COALESCE(songwriting_input_snapshot, '{}'::jsonb) || jsonb_build_object(
        'clothing_bonus_pct', v_bonus.songwriting_pct,
        'clothing_bonus_items', v_bonus.equipped_bonus_items
      ),
      updated_at = timezone('utc', now())
  WHERE id = p_project_id;

  RETURN v_result || jsonb_build_object('final_score', v_final_score, 'breakdown', v_breakdown);
END;
$$;

-- ---------------------------------------------------------------------------
-- Recording final quality
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recording_session_clothing_bonus_pct(p_session_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_pct numeric := 0;
BEGIN
  SELECT profile_id, band_id INTO v_session
  FROM public.recording_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_session.profile_id IS NOT NULL THEN
    SELECT recording_pct INTO v_pct
    FROM public.get_equipped_clothing_bonuses(v_session.profile_id);
    RETURN COALESCE(v_pct, 0);
  END IF;

  IF v_session.band_id IS NOT NULL THEN
    SELECT COALESCE(AVG(b.recording_pct), 0)
      INTO v_pct
    FROM public.band_members bm
    CROSS JOIN LATERAL public.get_equipped_clothing_bonuses(bm.profile_id) b
    WHERE bm.band_id = v_session.band_id
      AND bm.profile_id IS NOT NULL
      AND COALESCE(bm.member_status, 'active') = 'active';
  END IF;

  RETURN LEAST(20, COALESCE(v_pct, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_recording_clothing_bonus_to_song()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_pct numeric := 0;
  v_base numeric;
  v_adjusted numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'recorded' OR NEW.quality_score IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.quality_score IS NOT DISTINCT FROM NEW.quality_score
     AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT rs.id, rs.source_song_quality, rs.outcome_breakdown
    INTO v_session
  FROM public.recording_sessions rs
  WHERE rs.status = 'completed'
    AND (rs.song_id = NEW.id OR rs.song_id = NEW.parent_song_id)
    AND COALESCE(rs.outcome_breakdown, '{}'::jsonb) ? 'clothing_bonus_applied' = false
  ORDER BY rs.completed_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_pct := public.recording_session_clothing_bonus_pct(v_session.id);
  IF v_pct <= 0 THEN RETURN NEW; END IF;

  v_base := NEW.quality_score;
  v_adjusted := LEAST(1000, round(v_base * (1 + v_pct / 100.0)));
  NEW.quality_score := v_adjusted;

  UPDATE public.recording_sessions
  SET final_master_quality = v_adjusted,
      quality_improvement = GREATEST(0, v_adjusted - COALESCE(source_song_quality, 0)),
      outcome_breakdown = COALESCE(outcome_breakdown, '{}'::jsonb) || jsonb_build_object(
        'clothing_bonus_applied', true,
        'clothing_bonus_pct', v_pct,
        'pre_clothing_quality', v_base,
        'final_clothing_quality', v_adjusted
      ),
      updated_at = timezone('utc', now())
  WHERE id = v_session.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_recording_clothing_bonus_to_song ON public.songs;
CREATE TRIGGER trg_apply_recording_clothing_bonus_to_song
BEFORE UPDATE OF quality_score, status ON public.songs
FOR EACH ROW
EXECUTE FUNCTION public.apply_recording_clothing_bonus_to_song();

NOTIFY pgrst, 'reload schema';
