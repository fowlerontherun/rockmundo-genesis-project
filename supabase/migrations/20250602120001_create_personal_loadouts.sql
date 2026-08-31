-- Historical ordering note:
-- this migration predates the migration that creates public.profiles.
-- Keep only the dependency-free gear catalogue here; player-owned loadout
-- tables are materialised later by 20260831180000_finalize_personal_loadouts.sql.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  CREATE TYPE public.gear_type AS ENUM (
    'instrument','pedal','amplifier','speaker_cabinet','pedalboard',
    'vocal_rig','microphone','outboard','accessory','utility'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.gear_rarity AS ENUM ('common','uncommon','rare','epic','legendary');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.gear_quality AS ENUM ('budget','standard','professional','boutique','experimental');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.gear_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manufacturer text,
  gear_type public.gear_type NOT NULL,
  rarity public.gear_rarity NOT NULL DEFAULT 'common',
  quality public.gear_quality NOT NULL DEFAULT 'standard',
  description text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gear_items_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS gear_items_type_idx ON public.gear_items (gear_type);
CREATE INDEX IF NOT EXISTS gear_items_rarity_idx ON public.gear_items (rarity);
CREATE INDEX IF NOT EXISTS gear_items_quality_idx ON public.gear_items (quality);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'gear_items_set_updated_at') THEN
    CREATE TRIGGER gear_items_set_updated_at
      BEFORE UPDATE ON public.gear_items
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.gear_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gear_items' AND policyname='Gear catalog readable by everyone') THEN
    CREATE POLICY "Gear catalog readable by everyone" ON public.gear_items FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gear_items' AND policyname='Gear catalog managed by service role') THEN
    CREATE POLICY "Gear catalog managed by service role" ON public.gear_items FOR ALL
      USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;
