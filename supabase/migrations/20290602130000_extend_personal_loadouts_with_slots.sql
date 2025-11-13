-- Create pedal chain stage enum used for describing pedal roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'pedal_chain_stage'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.pedal_chain_stage AS ENUM (
      'input',
      'preamp',
      'drive',
      'modulation',
      'ambient',
      'utility',
      'loop',
      'multi_fx',
      'expression',
      'output'
    );
  END IF;
END $$;

-- Join table for all personal loadout gear assignments including pedal slots
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
  CONSTRAINT personal_loadout_slots_pedal_position_range CHECK (
    pedal_position IS NULL OR (pedal_position BETWEEN 1 AND 10)
  ),
  CONSTRAINT personal_loadout_slots_pedal_requirements CHECK (
    (gear_type <> 'pedal' AND pedal_position IS NULL AND pedal_stage IS NULL)
    OR (gear_type = 'pedal' AND pedal_position BETWEEN 1 AND 10)
  )
);

CREATE INDEX IF NOT EXISTS personal_loadout_slots_loadout_idx
  ON public.personal_loadout_slots (loadout_id);

CREATE UNIQUE INDEX IF NOT EXISTS personal_loadout_slots_unique_assignment
  ON public.personal_loadout_slots (loadout_id, gear_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS personal_loadout_slots_pedal_position_unique
  ON public.personal_loadout_slots (loadout_id, pedal_position)
  WHERE gear_type = 'pedal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'personal_loadout_slots_set_updated_at'
  ) THEN
    CREATE TRIGGER personal_loadout_slots_set_updated_at
      BEFORE UPDATE ON public.personal_loadout_slots
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.personal_loadout_slots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'personal_loadout_slots'
      AND policyname = 'Players can view their loadout slots'
  ) THEN
    CREATE POLICY "Players can view their loadout slots"
      ON public.personal_loadout_slots
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.personal_loadouts pl
          JOIN public.profiles p ON p.id = pl.character_id
          WHERE pl.id = personal_loadout_slots.loadout_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'personal_loadout_slots'
      AND policyname = 'Players can insert their loadout slots'
  ) THEN
    CREATE POLICY "Players can insert their loadout slots"
      ON public.personal_loadout_slots
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.personal_loadouts pl
          JOIN public.profiles p ON p.id = pl.character_id
          WHERE pl.id = personal_loadout_slots.loadout_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'personal_loadout_slots'
      AND policyname = 'Players can update their loadout slots'
  ) THEN
    CREATE POLICY "Players can update their loadout slots"
      ON public.personal_loadout_slots
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.personal_loadouts pl
          JOIN public.profiles p ON p.id = pl.character_id
          WHERE pl.id = personal_loadout_slots.loadout_id
            AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.personal_loadouts pl
          JOIN public.profiles p ON p.id = pl.character_id
          WHERE pl.id = personal_loadout_slots.loadout_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'personal_loadout_slots'
      AND policyname = 'Players can delete their loadout slots'
  ) THEN
    CREATE POLICY "Players can delete their loadout slots"
      ON public.personal_loadout_slots
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.personal_loadouts pl
          JOIN public.profiles p ON p.id = pl.character_id
          WHERE pl.id = personal_loadout_slots.loadout_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;
