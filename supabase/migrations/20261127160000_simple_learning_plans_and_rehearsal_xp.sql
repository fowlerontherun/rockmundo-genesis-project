-- One simple, per-character learning goal powers the shared Education overview.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learning_goal text NOT NULL DEFAULT 'all';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_learning_goal_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_learning_goal_check CHECK (learning_goal IN (
    'all', 'lead_guitarist', 'rhythm_guitarist', 'bassist', 'drummer',
    'lead_vocalist', 'backing_vocalist', 'songwriter', 'dj', 'producer',
    'sound_engineer', 'live_frontperson'
  ));

-- The old rehearsal completion worker called the disabled direct-award-XP API.
-- Settle practice rewards from the completed, time-verified rehearsal row instead.
-- This is independent of the band's chemistry and attendance contribution logs.
CREATE TABLE IF NOT EXISTS public.band_rehearsal_learning_rewards (
  rehearsal_id uuid NOT NULL REFERENCES public.band_rehearsals(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  xp_awarded integer NOT NULL CHECK (xp_awarded BETWEEN 1 AND 90),
  skill_slug text,
  skill_xp_awarded integer NOT NULL DEFAULT 0 CHECK (skill_xp_awarded BETWEEN 0 AND 90),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rehearsal_id, profile_id)
);

ALTER TABLE public.band_rehearsal_learning_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can see their rehearsal learning" ON public.band_rehearsal_learning_rewards;
CREATE POLICY "Players can see their rehearsal learning"
  ON public.band_rehearsal_learning_rewards FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_id AND p.user_id = (SELECT auth.uid())
  ));

REVOKE ALL ON public.band_rehearsal_learning_rewards FROM anon, authenticated;
GRANT SELECT ON public.band_rehearsal_learning_rewards TO authenticated;

CREATE OR REPLACE FUNCTION public.award_rehearsal_learning_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_member record;
  v_duration_hours numeric;
  v_xp integer;
  v_skill_slug text;
  v_skill_level integer;
  v_peer_level integer;
  v_skill_xp integer;
  v_inserted uuid;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- No rewards for premature, impossible, or excessively long schedules.
  IF NEW.scheduled_start IS NULL OR NEW.scheduled_end IS NULL
     OR NEW.scheduled_end > now()
     OR NEW.scheduled_end - NEW.scheduled_start < interval '30 minutes'
     OR NEW.scheduled_end - NEW.scheduled_start > interval '6 hours' THEN
    RETURN NEW;
  END IF;

  v_duration_hours := extract(epoch FROM (NEW.scheduled_end - NEW.scheduled_start)) / 3600;
  v_xp := least(90, greatest(5, round(v_duration_hours * 15)::integer));

  FOR v_member IN
    SELECT DISTINCT ON (p.id) p.id AS profile_id, p.user_id, bm.instrument_role
    FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
      OR (bm.profile_id IS NULL AND p.user_id = bm.user_id AND p.is_active IS TRUE)
    WHERE bm.band_id = NEW.band_id
      AND coalesce(bm.member_status, 'active') = 'active'
      AND p.died_at IS NULL AND p.deleted_at IS NULL
    ORDER BY p.id, bm.id
  LOOP
    v_skill_slug := CASE
      WHEN lower(coalesce(v_member.instrument_role,'')) LIKE '%bass%' THEN 'bass'
      WHEN lower(coalesce(v_member.instrument_role,'')) LIKE '%guitar%' THEN 'guitar'
      WHEN lower(coalesce(v_member.instrument_role,'')) LIKE '%drum%' THEN 'drums'
      WHEN lower(coalesce(v_member.instrument_role,'')) LIKE '%vocal%'
        OR lower(coalesce(v_member.instrument_role,'')) LIKE '%sing%' THEN 'vocals'
      WHEN lower(coalesce(v_member.instrument_role,'')) LIKE '%rap%' THEN 'basic_rapping'
      WHEN lower(coalesce(v_member.instrument_role,'')) LIKE '%piano%'
        OR lower(coalesce(v_member.instrument_role,'')) LIKE '%keyboard%' THEN 'basic_keyboard'
      WHEN lower(coalesce(v_member.instrument_role,'')) LIKE '%sax%'
        OR lower(coalesce(v_member.instrument_role,'')) LIKE '%flute%'
        OR lower(coalesce(v_member.instrument_role,'')) LIKE '%clarinet%' THEN 'basic_woodwinds'
      WHEN lower(coalesce(v_member.instrument_role,'')) LIKE '%trumpet%'
        OR lower(coalesce(v_member.instrument_role,'')) LIKE '%trombone%' THEN 'basic_brass'
      WHEN lower(coalesce(v_member.instrument_role,'')) LIKE '%violin%'
        OR lower(coalesce(v_member.instrument_role,'')) LIKE '%harp%'
        OR lower(coalesce(v_member.instrument_role,'')) LIKE '%cello%' THEN 'basic_strings'
      ELSE 'performance'
    END;

    v_skill_xp := 0;
    SELECT sp.current_level INTO v_skill_level
    FROM public.skill_progress sp
    WHERE sp.profile_id = v_member.profile_id AND sp.skill_slug = v_skill_slug
      AND sp.current_level >= 1 AND sp.current_level < public.progression_skill_max_level(v_skill_slug);

    IF v_skill_level IS NOT NULL AND public.skill_tier_unlocked(v_member.profile_id, v_skill_slug) THEN
      -- Learning alongside stronger members helps, up to a modest 25% bonus.
      SELECT coalesce(max(peer_sp.current_level), v_skill_level) INTO v_peer_level
      FROM public.band_members peer
      JOIN public.skill_progress peer_sp ON peer_sp.profile_id = peer.profile_id
        AND peer_sp.skill_slug = v_skill_slug
      WHERE peer.band_id = NEW.band_id
        AND coalesce(peer.member_status, 'active') = 'active';

      v_skill_xp := least(90, greatest(1, round(v_xp * 0.5 *
        (1 + least(0.25, greatest(0, v_peer_level - v_skill_level) * 0.05)))::integer));
    END IF;

    INSERT INTO public.band_rehearsal_learning_rewards
      (rehearsal_id, profile_id, xp_awarded, skill_slug, skill_xp_awarded)
    VALUES (NEW.id, v_member.profile_id, v_xp,
      CASE WHEN v_skill_xp > 0 THEN v_skill_slug ELSE NULL END, v_skill_xp)
    ON CONFLICT (rehearsal_id, profile_id) DO NOTHING
    RETURNING rehearsal_id INTO v_inserted;

    IF v_inserted IS NOT NULL THEN
      UPDATE public.profiles
      SET experience = coalesce(experience, 0) + v_xp
      WHERE id = v_member.profile_id;

      INSERT INTO public.experience_ledger
        (user_id, profile_id, activity_type, xp_amount, skill_slug, metadata)
      VALUES (v_member.user_id, v_member.profile_id, 'band_rehearsal', v_xp,
        CASE WHEN v_skill_xp > 0 THEN v_skill_slug ELSE NULL END,
        jsonb_build_object('rehearsal_id', NEW.id, 'band_id', NEW.band_id,
          'skill_xp', v_skill_xp, 'learning_by_doing', true));

      IF v_skill_xp > 0 THEN
        PERFORM public._d10_award_skill_xp(v_member.profile_id, v_skill_slug, v_skill_xp);
      END IF;
    END IF;
    v_inserted := NULL;
    v_skill_level := NULL;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.award_rehearsal_learning_on_completion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_award_rehearsal_learning ON public.band_rehearsals;
CREATE TRIGGER trg_award_rehearsal_learning
  AFTER UPDATE OF status ON public.band_rehearsals
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.award_rehearsal_learning_on_completion();
