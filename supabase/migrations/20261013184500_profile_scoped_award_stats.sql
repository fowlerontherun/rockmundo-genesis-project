-- Preserve the historical stat evaluator while preventing account-wide
-- award attribution from leaking to sibling character profiles. Legacy
-- solo wins without an explicit profile ID are intentionally not counted.
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
       WHERE aw.band_id IN (
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
