-- Restore server-side unlocks for legacy achievements whose requirements can be
-- proven from authoritative gameplay tables. Ambiguous and manual requirements
-- are deliberately left for their owning systems/admin flows.

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
       WHERE (s.profile_id = p_profile_id OR (s.profile_id IS NULL AND s.user_id = v_user_id))
         AND (s.completed_at IS NOT NULL OR s.status = 'recorded');
      RETURN coalesce(v_value, 0);
    WHEN 'albums_released' THEN
      SELECT count(DISTINCT r.id)::numeric INTO v_value
        FROM public.releases r
       WHERE lower(r.release_type) = 'album'
         AND r.release_status = 'released'
         AND (r.user_id = v_user_id OR r.band_id IN (
           SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id
         ));
      RETURN coalesce(v_value, 0);
    WHEN 'eps_released' THEN
      SELECT count(DISTINCT r.id)::numeric INTO v_value
        FROM public.releases r
       WHERE lower(r.release_type) IN ('ep', 'e.p.')
         AND r.release_status = 'released'
         AND (r.user_id = v_user_id OR r.band_id IN (
           SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id
         ));
      RETURN coalesce(v_value, 0);
    WHEN 'awards_won' THEN
      SELECT count(DISTINCT aw.id)::numeric INTO v_value
        FROM public.award_wins aw
       WHERE aw.user_id = v_user_id
          OR aw.band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id);
      RETURN coalesce(v_value, 0);
    WHEN 'award_nominations' THEN
      SELECT count(DISTINCT an.id)::numeric INTO v_value
        FROM public.award_nominations an
       WHERE an.user_id = v_user_id
          OR an.band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id);
      RETURN coalesce(v_value, 0);
    WHEN 'chart_entries' THEN
      SELECT count(DISTINCT ce.id)::numeric INTO v_value
        FROM public.chart_entries ce
        JOIN public.songs s ON s.id = ce.song_id
       WHERE s.profile_id = p_profile_id
          OR (s.profile_id IS NULL AND s.user_id = v_user_id)
          OR s.band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id);
      RETURN coalesce(v_value, 0);
    WHEN 'top_40' THEN
      SELECT count(DISTINCT ce.id)::numeric INTO v_value
        FROM public.chart_entries ce
        JOIN public.songs s ON s.id = ce.song_id
       WHERE ce.rank BETWEEN 1 AND 40
         AND (s.profile_id = p_profile_id
          OR (s.profile_id IS NULL AND s.user_id = v_user_id)
          OR s.band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id));
      RETURN coalesce(v_value, 0);
    WHEN 'top_10' THEN
      SELECT count(DISTINCT ce.id)::numeric INTO v_value
        FROM public.chart_entries ce
        JOIN public.songs s ON s.id = ce.song_id
       WHERE ce.rank BETWEEN 1 AND 10
         AND (s.profile_id = p_profile_id
          OR (s.profile_id IS NULL AND s.user_id = v_user_id)
          OR s.band_id IN (SELECT bm.band_id FROM public.band_members bm WHERE bm.profile_id = p_profile_id));
      RETURN coalesce(v_value, 0);
    WHEN 'chart_position' THEN
      SELECT min(ce.rank)::numeric INTO v_value
        FROM public.chart_entries ce
        JOIN public.songs s ON s.id = ce.song_id
       WHERE s.profile_id = p_profile_id
          OR (s.profile_id IS NULL AND s.user_id = v_user_id)
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

CREATE OR REPLACE FUNCTION public.reconcile_profile_achievements(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_achievement record;
  v_key text;
  v_target numeric;
  v_actual numeric;
  v_unlocked integer := 0;
BEGIN
  SELECT user_id INTO v_user_id FROM public.profiles WHERE id = p_profile_id;
  IF v_user_id IS NULL THEN RETURN 0; END IF;

  FOR v_achievement IN
    SELECT a.id, a.requirements
      FROM public.achievements a
     WHERE a.requirements IS NOT NULL
       AND jsonb_typeof(a.requirements) = 'object'
       AND (SELECT count(*) FROM jsonb_object_keys(a.requirements)) = 1
  LOOP
    SELECT key INTO v_key FROM jsonb_each(v_achievement.requirements) LIMIT 1;
    IF v_key = 'manual' THEN CONTINUE; END IF;

    v_actual := public.get_profile_achievement_stat(p_profile_id, v_key);
    IF v_actual IS NULL THEN CONTINUE; END IF;

    BEGIN
      IF jsonb_typeof(v_achievement.requirements -> v_key) = 'boolean' THEN
        v_target := CASE WHEN (v_achievement.requirements ->> v_key)::boolean THEN 1 ELSE 0 END;
      ELSE
        v_target := (v_achievement.requirements ->> v_key)::numeric;
      END IF;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      CONTINUE;
    END;

    -- Chart rank is inverse: rank 1 satisfies a target of 10; counters use >=.
    IF (v_key = 'chart_position' AND v_actual > v_target)
       OR (v_key <> 'chart_position' AND v_actual < v_target) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.player_achievements(user_id, profile_id, achievement_id, unlocked_at, progress)
    SELECT v_user_id,
           p_profile_id,
           v_achievement.id,
           now(),
           jsonb_build_object('criterion', v_key, 'value', v_actual, 'target', v_target, 'source', 'server_reconciliation')
     WHERE NOT EXISTS (
       SELECT 1 FROM public.player_achievements pa
        WHERE pa.achievement_id = v_achievement.id
          AND pa.profile_id = p_profile_id
     )
    ON CONFLICT DO NOTHING;

    IF FOUND THEN v_unlocked := v_unlocked + 1; END IF;
  END LOOP;

  RETURN v_unlocked;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reconcile_achievements_skill_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.reconcile_profile_achievements(NEW.profile_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reconcile_achievements_profile_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.reconcile_profile_achievements(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reconcile_achievements_gig()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_profile_id uuid;
BEGIN
  IF NEW.status = 'completed' OR NEW.completed_at IS NOT NULL THEN
    FOR v_profile_id IN
      SELECT DISTINCT gp.profile_id FROM public.gig_performers gp
       WHERE gp.gig_id = NEW.id AND gp.profile_id IS NOT NULL
    LOOP
      PERFORM public.reconcile_profile_achievements(v_profile_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reconcile_achievements_song()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_profile_id uuid;
BEGIN
  IF NEW.completed_at IS NOT NULL OR NEW.status = 'recorded' THEN
    IF NEW.profile_id IS NOT NULL THEN
      PERFORM public.reconcile_profile_achievements(NEW.profile_id);
    ELSIF NEW.user_id IS NOT NULL THEN
      FOR v_profile_id IN SELECT p.id FROM public.profiles p WHERE p.user_id = NEW.user_id
      LOOP
        PERFORM public.reconcile_profile_achievements(v_profile_id);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reconcile_achievements_band_or_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_user_id uuid := nullif(to_jsonb(NEW) ->> 'user_id', '')::uuid;
  v_band_id uuid := nullif(to_jsonb(NEW) ->> 'band_id', '')::uuid;
BEGIN
  IF v_user_id IS NOT NULL THEN
    FOR v_profile_id IN SELECT p.id FROM public.profiles p WHERE p.user_id = v_user_id
    LOOP
      PERFORM public.reconcile_profile_achievements(v_profile_id);
    END LOOP;
  END IF;

  IF v_band_id IS NOT NULL THEN
    FOR v_profile_id IN
      SELECT DISTINCT bm.profile_id FROM public.band_members bm
       WHERE bm.band_id = v_band_id AND bm.profile_id IS NOT NULL
    LOOP
      PERFORM public.reconcile_profile_achievements(v_profile_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reconcile_achievements_chart_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_song public.songs%ROWTYPE;
BEGIN
  SELECT * INTO v_song FROM public.songs WHERE id = NEW.song_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_song.profile_id IS NOT NULL THEN
    PERFORM public.reconcile_profile_achievements(v_song.profile_id);
  ELSIF v_song.user_id IS NOT NULL THEN
    FOR v_profile_id IN SELECT p.id FROM public.profiles p WHERE p.user_id = v_song.user_id
    LOOP
      PERFORM public.reconcile_profile_achievements(v_profile_id);
    END LOOP;
  END IF;

  IF v_song.band_id IS NOT NULL THEN
    FOR v_profile_id IN
      SELECT DISTINCT bm.profile_id FROM public.band_members bm
       WHERE bm.band_id = v_song.band_id AND bm.profile_id IS NOT NULL
    LOOP
      PERFORM public.reconcile_profile_achievements(v_profile_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_achievements_skill_progress ON public.skill_progress;
CREATE TRIGGER trg_reconcile_achievements_skill_progress
AFTER INSERT OR UPDATE OF current_level ON public.skill_progress
FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_achievements_skill_progress();

DROP TRIGGER IF EXISTS trg_reconcile_achievements_profile_level ON public.profiles;
CREATE TRIGGER trg_reconcile_achievements_profile_level
AFTER UPDATE OF level ON public.profiles
FOR EACH ROW WHEN (NEW.level IS DISTINCT FROM OLD.level)
EXECUTE FUNCTION public.trg_reconcile_achievements_profile_level();

DROP TRIGGER IF EXISTS trg_reconcile_achievements_gig ON public.gigs;
CREATE TRIGGER trg_reconcile_achievements_gig
AFTER UPDATE OF status, completed_at ON public.gigs
FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_achievements_gig();

DROP TRIGGER IF EXISTS trg_reconcile_achievements_song ON public.songs;
CREATE TRIGGER trg_reconcile_achievements_song
AFTER INSERT OR UPDATE OF status, completed_at ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_achievements_song();

DROP TRIGGER IF EXISTS trg_reconcile_achievements_release ON public.releases;
CREATE TRIGGER trg_reconcile_achievements_release
AFTER INSERT OR UPDATE OF release_status ON public.releases
FOR EACH ROW WHEN (NEW.release_status = 'released')
EXECUTE FUNCTION public.trg_reconcile_achievements_band_or_user();

DROP TRIGGER IF EXISTS trg_reconcile_achievements_award_win ON public.award_wins;
CREATE TRIGGER trg_reconcile_achievements_award_win
AFTER INSERT ON public.award_wins
FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_achievements_band_or_user();

DROP TRIGGER IF EXISTS trg_reconcile_achievements_award_nomination ON public.award_nominations;
CREATE TRIGGER trg_reconcile_achievements_award_nomination
AFTER INSERT ON public.award_nominations
FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_achievements_band_or_user();

DROP TRIGGER IF EXISTS trg_reconcile_achievements_chart_entry ON public.chart_entries;
CREATE TRIGGER trg_reconcile_achievements_chart_entry
AFTER INSERT OR UPDATE OF rank ON public.chart_entries
FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_achievements_chart_entry();

REVOKE ALL ON FUNCTION public.get_profile_achievement_stat(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_profile_achievements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_reconcile_achievements_skill_progress() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_reconcile_achievements_profile_level() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_reconcile_achievements_gig() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_reconcile_achievements_song() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_reconcile_achievements_band_or_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_reconcile_achievements_chart_entry() FROM PUBLIC, anon, authenticated;

-- Backfill only facts that can be proven by the supported stat keys above.
DO $$
DECLARE v_profile_id uuid;
BEGIN
  FOR v_profile_id IN SELECT id FROM public.profiles
  LOOP
    PERFORM public.reconcile_profile_achievements(v_profile_id);
  END LOOP;
END;
$$;
