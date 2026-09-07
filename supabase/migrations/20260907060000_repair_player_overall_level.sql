-- Keep profiles.level aligned with the canonical progression wallet and skill progress.

CREATE OR REPLACE FUNCTION public.calculate_profile_overall_level(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lifetime_xp numeric := 0;
  v_fame numeric := 0;
  v_skill_levels numeric := 0;
  v_effective_xp numeric := 0;
  v_level integer := 1;
BEGIN
  SELECT greatest(coalesce(w.skill_xp_lifetime, 0), coalesce(w.lifetime_xp, 0))
    INTO v_lifetime_xp
    FROM public.player_xp_wallet w
   WHERE w.profile_id = p_profile_id;

  SELECT coalesce(p.fame, 0)
    INTO v_fame
    FROM public.profiles p
   WHERE p.id = p_profile_id;

  SELECT coalesce(sum(greatest(coalesce(sp.current_level, 0), 0)), 0)
    INTO v_skill_levels
    FROM public.skill_progress sp
   WHERE sp.profile_id = p_profile_id;

  -- Mirrors src/utils/gameBalance.ts.
  v_effective_xp := greatest(coalesce(v_lifetime_xp, 0), 0)
    + greatest(coalesce(v_fame, 0), 0) * 0.01
    + greatest(coalesce(v_skill_levels, 0), 0) * 2;

  IF v_effective_xp <= 0 THEN
    RETURN 1;
  END IF;

  v_level := floor(
    ln((v_effective_xp * (1.15 - 1) / 250) + 1) / ln(1.15) + 1
  )::integer;

  RETURN greatest(1, least(100, v_level));
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_overall_level(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_level integer;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN 1;
  END IF;

  v_level := public.calculate_profile_overall_level(p_profile_id);

  UPDATE public.profiles
     SET level = v_level
   WHERE id = p_profile_id
     AND level IS DISTINCT FROM v_level;

  RETURN v_level;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_profile_level_from_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sync_profile_overall_level(NEW.profile_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_profile_level_from_skill_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_profile_id := OLD.profile_id;
  ELSE
    v_profile_id := NEW.profile_id;
  END IF;

  PERFORM public.sync_profile_overall_level(v_profile_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_profile_level_from_fame()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.fame IS DISTINCT FROM OLD.fame THEN
    PERFORM public.sync_profile_overall_level(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_level_wallet ON public.player_xp_wallet;
CREATE TRIGGER trg_sync_profile_level_wallet
AFTER INSERT OR UPDATE OF lifetime_xp, skill_xp_lifetime
ON public.player_xp_wallet
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_profile_level_from_wallet();

DROP TRIGGER IF EXISTS trg_sync_profile_level_skill_progress ON public.skill_progress;
CREATE TRIGGER trg_sync_profile_level_skill_progress
AFTER INSERT OR UPDATE OF current_level OR DELETE
ON public.skill_progress
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_profile_level_from_skill_progress();

DROP TRIGGER IF EXISTS trg_sync_profile_level_fame ON public.profiles;
CREATE TRIGGER trg_sync_profile_level_fame
AFTER UPDATE OF fame
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_profile_level_from_fame();

REVOKE ALL ON FUNCTION public.sync_profile_overall_level(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_sync_profile_level_from_wallet() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_sync_profile_level_from_skill_progress() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_sync_profile_level_from_fame() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_profile_id uuid;
BEGIN
  FOR v_profile_id IN SELECT id FROM public.profiles
  LOOP
    PERFORM public.sync_profile_overall_level(v_profile_id);
  END LOOP;
END;
$$;
