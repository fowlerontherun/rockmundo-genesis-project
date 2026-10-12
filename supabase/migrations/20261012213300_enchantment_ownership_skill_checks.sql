-- Authoritative ownership and skill checks on all enchantment inserts/updates.
CREATE OR REPLACE FUNCTION public.validate_equipment_enchantment_requirements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_skill text;
  v_min_level integer;
  v_level integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.player_equipment e
     WHERE e.id=NEW.player_equipment_id AND e.profile_id=NEW.profile_id
  ) THEN
    RAISE EXCEPTION 'enchantment_equipment_not_owned';
  END IF;
  SELECT required_skill_slug, coalesce(min_skill_level,0)
    INTO v_skill, v_min_level
    FROM public.enchantment_catalog WHERE id=NEW.enchantment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'enchantment_catalog_missing'; END IF;
  IF v_skill IS NOT NULL AND length(trim(v_skill))>0 AND v_min_level>0 THEN
    SELECT coalesce(max(current_level),0) INTO v_level
      FROM public.skill_progress
     WHERE profile_id=NEW.profile_id AND skill_slug=v_skill;
    IF coalesce(v_level,0)<v_min_level THEN
      RAISE EXCEPTION 'enchantment_skill_not_unlocked';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_equipment_enchantment_requirements
  ON public.equipment_enchantments;
CREATE TRIGGER enforce_equipment_enchantment_requirements
  BEFORE INSERT OR UPDATE ON public.equipment_enchantments
  FOR EACH ROW EXECUTE FUNCTION public.validate_equipment_enchantment_requirements();
