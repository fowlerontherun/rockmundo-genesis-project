-- Repair historical migration ordering for clean database rebuilds.
-- The original June 2025 loadout migrations predate public.profiles, so the
-- dependency-free gear catalogue remains there and profile-owned tables are
-- created here once the full base schema exists. Everything is idempotent so
-- existing/live databases are unaffected.

CREATE TABLE IF NOT EXISTS public.personal_loadouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  scenario text,
  primary_instrument text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_loadouts_character_name_unique UNIQUE (character_id, name)
);
CREATE INDEX IF NOT EXISTS personal_loadouts_character_idx ON public.personal_loadouts(character_id);

CREATE TABLE IF NOT EXISTS public.personal_loadout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loadout_id uuid NOT NULL REFERENCES public.personal_loadouts(id) ON DELETE CASCADE,
  gear_item_id uuid NOT NULL REFERENCES public.gear_items(id) ON DELETE RESTRICT,
  slot_kind text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_loadout_items_slot_kind_check CHECK (
    slot_kind = ANY (ARRAY['instrument','amp_head','speaker_cabinet','pedalboard_split','vocal_rig','monitoring','utility','outboard','misc']::text[])
  ),
  CONSTRAINT personal_loadout_items_unique_assignment UNIQUE (loadout_id, gear_item_id, slot_kind)
);
CREATE INDEX IF NOT EXISTS personal_loadout_items_loadout_idx ON public.personal_loadout_items(loadout_id);

CREATE TABLE IF NOT EXISTS public.personal_loadout_pedal_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loadout_id uuid NOT NULL REFERENCES public.personal_loadouts(id) ON DELETE CASCADE,
  slot_number smallint NOT NULL,
  slot_type text NOT NULL,
  gear_item_id uuid REFERENCES public.gear_items(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_loadout_pedal_slots_slot_number_check CHECK (slot_number BETWEEN 1 AND 10),
  CONSTRAINT personal_loadout_pedal_slots_slot_type_check CHECK (
    slot_type = ANY (ARRAY['input','preamp','drive','modulation','ambient','utility','loop','multi_fx','expression','output']::text[])
  ),
  CONSTRAINT personal_loadout_pedal_slots_unique_slot UNIQUE (loadout_id, slot_number)
);
CREATE INDEX IF NOT EXISTS personal_loadout_pedal_slots_loadout_idx ON public.personal_loadout_pedal_slots(loadout_id);

CREATE TABLE IF NOT EXISTS public.personal_loadout_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loadout_id uuid NOT NULL REFERENCES public.personal_loadouts(id) ON DELETE CASCADE,
  gear_item_id uuid NOT NULL REFERENCES public.gear_items(id) ON DELETE RESTRICT,
  gear_type public.gear_type NOT NULL,
  pedal_position smallint,
  pedal_stage public.pedal_chain_stage,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_loadout_slots_pedal_position_range CHECK (pedal_position IS NULL OR pedal_position BETWEEN 1 AND 10),
  CONSTRAINT personal_loadout_slots_pedal_requirements CHECK (
    (gear_type <> 'pedal' AND pedal_position IS NULL AND pedal_stage IS NULL)
    OR (gear_type = 'pedal' AND pedal_position BETWEEN 1 AND 10)
  )
);
CREATE INDEX IF NOT EXISTS personal_loadout_slots_loadout_idx ON public.personal_loadout_slots(loadout_id);
CREATE UNIQUE INDEX IF NOT EXISTS personal_loadout_slots_unique_assignment ON public.personal_loadout_slots(loadout_id, gear_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS personal_loadout_slots_pedal_position_unique ON public.personal_loadout_slots(loadout_id, pedal_position) WHERE gear_type = 'pedal';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('personal_loadouts_set_updated_at','personal_loadouts'),
    ('personal_loadout_items_set_updated_at','personal_loadout_items'),
    ('personal_loadout_pedal_slots_set_updated_at','personal_loadout_pedal_slots'),
    ('personal_loadout_slots_set_updated_at','personal_loadout_slots')
  ) AS t(trigger_name, table_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = r.trigger_name) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', r.trigger_name, r.table_name);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.personal_loadouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_loadout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_loadout_pedal_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_loadout_slots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_loadouts' AND policyname='Players can view their loadouts') THEN
    CREATE POLICY "Players can view their loadouts" ON public.personal_loadouts FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=personal_loadouts.character_id AND p.user_id=auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_loadouts' AND policyname='Players can insert their loadouts') THEN
    CREATE POLICY "Players can insert their loadouts" ON public.personal_loadouts FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=personal_loadouts.character_id AND p.user_id=auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_loadouts' AND policyname='Players can update their loadouts') THEN
    CREATE POLICY "Players can update their loadouts" ON public.personal_loadouts FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=personal_loadouts.character_id AND p.user_id=auth.uid())
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=personal_loadouts.character_id AND p.user_id=auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_loadouts' AND policyname='Players can delete their loadouts') THEN
    CREATE POLICY "Players can delete their loadouts" ON public.personal_loadouts FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=personal_loadouts.character_id AND p.user_id=auth.uid())
    );
  END IF;
END $$;

DO $$
DECLARE
  tbl text;
  suffix text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['personal_loadout_items','personal_loadout_pedal_slots','personal_loadout_slots']
  LOOP
    suffix := CASE tbl
      WHEN 'personal_loadout_items' THEN 'loadout items'
      WHEN 'personal_loadout_pedal_slots' THEN 'pedal slots'
      ELSE 'loadout slots'
    END;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tbl AND policyname='Players can view their '||suffix) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (EXISTS (SELECT 1 FROM public.personal_loadouts pl JOIN public.profiles p ON p.id=pl.character_id WHERE pl.id=%I.loadout_id AND p.user_id=auth.uid()))', 'Players can view their '||suffix, tbl, tbl);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tbl AND policyname='Players can insert their '||suffix) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.personal_loadouts pl JOIN public.profiles p ON p.id=pl.character_id WHERE pl.id=%I.loadout_id AND p.user_id=auth.uid()))', 'Players can insert their '||suffix, tbl, tbl);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tbl AND policyname='Players can update their '||suffix) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING (EXISTS (SELECT 1 FROM public.personal_loadouts pl JOIN public.profiles p ON p.id=pl.character_id WHERE pl.id=%I.loadout_id AND p.user_id=auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.personal_loadouts pl JOIN public.profiles p ON p.id=pl.character_id WHERE pl.id=%I.loadout_id AND p.user_id=auth.uid()))', 'Players can update their '||suffix, tbl, tbl, tbl);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tbl AND policyname='Players can delete their '||suffix) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING (EXISTS (SELECT 1 FROM public.personal_loadouts pl JOIN public.profiles p ON p.id=pl.character_id WHERE pl.id=%I.loadout_id AND p.user_id=auth.uid()))', 'Players can delete their '||suffix, tbl, tbl);
    END IF;
  END LOOP;
END $$;
