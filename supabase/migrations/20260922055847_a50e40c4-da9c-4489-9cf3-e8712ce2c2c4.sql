CREATE OR REPLACE FUNCTION public.sync_band_fame_from_members(p_band_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band RECORD;
  v_member_fame numeric := 0;
  v_member_pop numeric := 0;
  v_weighted numeric := 0;
  v_weight numeric := 0;
  v_computed numeric := 0;
  v_chem numeric := 1;
BEGIN
  SELECT id, fame, popularity, collective_fame_earned, chemistry_level, is_solo_artist, leader_id
    INTO v_band FROM public.bands WHERE id = p_band_id;
  IF v_band.id IS NULL THEN RETURN; END IF;

  IF COALESCE(v_band.is_solo_artist, false) THEN
    SELECT COALESCE(MAX(p.fame), 0), COALESCE(MAX(p.popularity), 0)
      INTO v_member_fame, v_member_pop
    FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = p_band_id AND COALESCE(bm.is_touring_member, false) = false;

    v_computed := ROUND(v_member_fame * 1.2);
  ELSE
    SELECT
      COALESCE(SUM(p.fame * w.weight), 0),
      COALESCE(SUM(w.weight), 0),
      COALESCE(MAX(p.popularity), 0)
      INTO v_weighted, v_weight, v_member_pop
    FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    CROSS JOIN LATERAL (
      SELECT (CASE WHEN bm.user_id = v_band.leader_id THEN 1.5 ELSE 1.0 END)
           * (CASE WHEN bm.vocal_role = 'Lead Singer' THEN 1.3 ELSE 1.0 END) AS weight
    ) w
    WHERE bm.band_id = p_band_id AND COALESCE(bm.is_touring_member, false) = false;

    v_chem := 0.5 + (COALESCE(v_band.chemistry_level, 50)::numeric / 100) * 1.5;
    IF v_weight > 0 THEN
      v_computed := ROUND(((v_weighted / v_weight) + COALESCE(v_band.collective_fame_earned, 0)) * v_chem);
    ELSE
      v_computed := 0;
    END IF;
  END IF;

  UPDATE public.bands
     SET fame = GREATEST(COALESCE(fame, 0), COALESCE(v_computed, 0))::bigint,
         popularity = GREATEST(COALESCE(popularity, 0), LEAST(100, COALESCE(v_member_pop, 0)))::int,
         last_fame_calculation = now()
   WHERE id = p_band_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_band_fame_from_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_band_fame_from_members(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_sync_band_fame_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  IF COALESCE(NEW.fame, 0) = COALESCE(OLD.fame, 0)
     AND COALESCE(NEW.popularity, 0) = COALESCE(OLD.popularity, 0) THEN
    RETURN NEW;
  END IF;
  FOR r IN
    SELECT DISTINCT band_id FROM public.band_members
     WHERE profile_id = NEW.id AND COALESCE(is_touring_member, false) = false
  LOOP
    PERFORM public.sync_band_fame_from_members(r.band_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_band_fame_from_profile ON public.profiles;
CREATE TRIGGER sync_band_fame_from_profile
AFTER UPDATE OF fame, popularity ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_band_fame_from_profile();

DO $$
DECLARE b RECORD;
BEGIN
  FOR b IN SELECT id FROM public.bands LOOP
    PERFORM public.sync_band_fame_from_members(b.id);
  END LOOP;
END $$;