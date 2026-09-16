-- Reconcile existing skill rows created by older XP formulas without losing earned XP.
DO $do$
DECLARE
  r record;
  v_level integer;
  v_xp integer;
  v_req integer;
  v_max integer;
BEGIN
  FOR r IN
    SELECT sp.id, sp.skill_slug, sp.current_level, sp.current_xp, sp.required_xp
    FROM public.skill_progress sp
    JOIN public.skill_definitions sd ON sd.slug::text = sp.skill_slug
    FOR UPDATE OF sp
  LOOP
    v_max := public.progression_skill_max_level(r.skill_slug);
    v_level := least(greatest(coalesce(r.current_level, 0), 0), v_max);
    v_xp := greatest(coalesce(r.current_xp, 0), 0);

    IF v_level >= v_max THEN
      v_level := v_max;
      v_xp := 0;
      v_req := 0;
    ELSE
      v_req := public.progression_skill_required_xp(v_level);

      WHILE v_level < v_max AND v_xp >= v_req LOOP
        v_xp := v_xp - v_req;
        v_level := v_level + 1;
        IF v_level < v_max THEN
          v_req := public.progression_skill_required_xp(v_level);
        END IF;
      END LOOP;

      IF v_level >= v_max THEN
        v_level := v_max;
        v_xp := 0;
        v_req := 0;
      END IF;
    END IF;

    UPDATE public.skill_progress
    SET current_level = v_level,
        current_xp = v_xp,
        required_xp = v_req,
        updated_at = timezone('utc', now()),
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
               'xp_curve_reconciled_at', timezone('utc', now()),
               'xp_curve', 'canonical_2026_09_16'
             )
    WHERE id = r.id;
  END LOOP;
END
$do$;
