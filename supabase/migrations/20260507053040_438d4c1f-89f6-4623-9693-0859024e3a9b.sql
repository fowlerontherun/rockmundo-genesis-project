
ALTER TABLE public.crafting_blueprints DROP CONSTRAINT IF EXISTS crafting_blueprints_source_check;
ALTER TABLE public.crafting_blueprints
  ADD CONSTRAINT crafting_blueprints_source_check
  CHECK (source = ANY (ARRAY['purchased','mentor','achievement','drop','starter']));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='crafting_blueprints_profile_recipe_unique') THEN
    ALTER TABLE public.crafting_blueprints
      ADD CONSTRAINT crafting_blueprints_profile_recipe_unique UNIQUE (profile_id, recipe_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.grant_starter_crafting_blueprints(_profile_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN
    SELECT id FROM public.crafting_recipes
    WHERE name IN ('Apprentice S-Style Guitar','PJ Bass','Stage Dynamic Mic')
  LOOP
    INSERT INTO public.crafting_blueprints (profile_id, recipe_id, source)
    VALUES (_profile_id, rec.id, 'starter')
    ON CONFLICT (profile_id, recipe_id) DO NOTHING;
  END LOOP;
END;$$;

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT id FROM public.profiles LOOP
    PERFORM public.grant_starter_crafting_blueprints(p.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_profile_starter_blueprints()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.grant_starter_crafting_blueprints(NEW.id);
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_profile_starter_blueprints ON public.profiles;
CREATE TRIGGER trg_profile_starter_blueprints
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_profile_starter_blueprints();
