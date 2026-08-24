-- Create enums for gear metadata
DO $$
BEGIN
  CREATE TYPE public.gear_type AS ENUM (
    'instrument',
    'pedal',
    'amplifier',
    'speaker_cabinet',
    'pedalboard',
    'vocal_rig',
    'microphone',
    'outboard',
    'accessory',
    'utility'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.gear_rarity AS ENUM (
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.gear_quality AS ENUM (
    'budget',
    'standard',
    'professional',
    'boutique',
    'experimental'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Catalog of individual gear items
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

CREATE TRIGGER gear_items_set_updated_at
  BEFORE UPDATE ON public.gear_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.gear_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gear catalog readable by everyone"
  ON public.gear_items
  FOR SELECT
  USING (true);

CREATE POLICY "Gear catalog managed by service role"
  ON public.gear_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Primary loadout record keyed by character/profile
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

CREATE INDEX IF NOT EXISTS personal_loadouts_character_idx
  ON public.personal_loadouts (character_id);

CREATE TRIGGER personal_loadouts_set_updated_at
  BEFORE UPDATE ON public.personal_loadouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.personal_loadouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their loadouts"
  ON public.personal_loadouts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = personal_loadouts.character_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can insert their loadouts"
  ON public.personal_loadouts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = personal_loadouts.character_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can update their loadouts"
  ON public.personal_loadouts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = personal_loadouts.character_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = personal_loadouts.character_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can delete their loadouts"
  ON public.personal_loadouts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = personal_loadouts.character_id
        AND p.user_id = auth.uid()
    )
  );

-- Supporting table for non-pedal gear assignments
CREATE TABLE IF NOT EXISTS public.personal_loadout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loadout_id uuid NOT NULL REFERENCES public.personal_loadouts(id) ON DELETE CASCADE,
  gear_item_id uuid NOT NULL REFERENCES public.gear_items(id) ON DELETE RESTRICT,
  slot_kind text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_loadout_items_slot_kind_check CHECK (
    slot_kind = ANY (
      ARRAY[
        'instrument',
        'amp_head',
        'speaker_cabinet',
        'pedalboard_split',
        'vocal_rig',
        'monitoring',
        'utility',
        'outboard',
        'misc'
      ]::text[]
    )
  ),
  CONSTRAINT personal_loadout_items_unique_assignment UNIQUE (loadout_id, gear_item_id, slot_kind)
);

CREATE INDEX IF NOT EXISTS personal_loadout_items_loadout_idx
  ON public.personal_loadout_items (loadout_id);

CREATE TRIGGER personal_loadout_items_set_updated_at
  BEFORE UPDATE ON public.personal_loadout_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.personal_loadout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their loadout items"
  ON public.personal_loadout_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.personal_loadouts pl
      JOIN public.profiles p ON p.id = pl.character_id
      WHERE pl.id = personal_loadout_items.loadout_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can insert their loadout items"
  ON public.personal_loadout_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.personal_loadouts pl
      JOIN public.profiles p ON p.id = pl.character_id
      WHERE pl.id = personal_loadout_items.loadout_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can update their loadout items"
  ON public.personal_loadout_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.personal_loadouts pl
      JOIN public.profiles p ON p.id = pl.character_id
      WHERE pl.id = personal_loadout_items.loadout_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.personal_loadouts pl
      JOIN public.profiles p ON p.id = pl.character_id
      WHERE pl.id = personal_loadout_items.loadout_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can delete their loadout items"
  ON public.personal_loadout_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.personal_loadouts pl
      JOIN public.profiles p ON p.id = pl.character_id
      WHERE pl.id = personal_loadout_items.loadout_id
        AND p.user_id = auth.uid()
    )
  );

-- Pedal slots with explicit slot typing and optional gear link
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
    slot_type = ANY (
      ARRAY[
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
      ]::text[]
    )
  ),
  CONSTRAINT personal_loadout_pedal_slots_unique_slot UNIQUE (loadout_id, slot_number)
);

CREATE INDEX IF NOT EXISTS personal_loadout_pedal_slots_loadout_idx
  ON public.personal_loadout_pedal_slots (loadout_id);

CREATE TRIGGER personal_loadout_pedal_slots_set_updated_at
  BEFORE UPDATE ON public.personal_loadout_pedal_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.personal_loadout_pedal_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their pedal slots"
  ON public.personal_loadout_pedal_slots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.personal_loadouts pl
      JOIN public.profiles p ON p.id = pl.character_id
      WHERE pl.id = personal_loadout_pedal_slots.loadout_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can insert their pedal slots"
  ON public.personal_loadout_pedal_slots
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.personal_loadouts pl
      JOIN public.profiles p ON p.id = pl.character_id
      WHERE pl.id = personal_loadout_pedal_slots.loadout_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can update their pedal slots"
  ON public.personal_loadout_pedal_slots
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.personal_loadouts pl
      JOIN public.profiles p ON p.id = pl.character_id
      WHERE pl.id = personal_loadout_pedal_slots.loadout_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.personal_loadouts pl
      JOIN public.profiles p ON p.id = pl.character_id
      WHERE pl.id = personal_loadout_pedal_slots.loadout_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Players can delete their pedal slots"
  ON public.personal_loadout_pedal_slots
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.personal_loadouts pl
      JOIN public.profiles p ON p.id = pl.character_id
      WHERE pl.id = personal_loadout_pedal_slots.loadout_id
        AND p.user_id = auth.uid()
    )
  );

-- Illustrative sample data showcasing pedal board splits, vocal rigs, and misc gear
DO $$
DECLARE
  sample_profile_id uuid;
  loadout_id uuid;
  splitter_id uuid;
  drive_id uuid;
  modulation_id uuid;
  ambient_id uuid;
  utility_id uuid;
  amp_head_id uuid;
  cab_id uuid;
  vocal_rig_id uuid;
  monitoring_id uuid;
BEGIN
  -- Seed canonical gear entries
  INSERT INTO public.gear_items (name, manufacturer, gear_type, rarity, quality, description, tags)
  VALUES
    ('Helios Deluxe Splitter', 'Sunwake Audio', 'pedalboard', 'rare', 'professional',
      'Programmable stereo splitter for routing guitar and vocal pedal chains.', ARRAY['routing','utility']),
    ('Aurora Drive MKII', 'Lumen Works', 'pedal', 'epic', 'boutique',
      'Dual-stage overdrive tuned for articulate festival stages.', ARRAY['drive','gain']),
    ('Cascade Prism Chorus', 'Skyline FX', 'pedal', 'rare', 'professional',
      'Lush analog chorus designed to keep modulation clear over stadium PAs.', ARRAY['modulation','chorus']),
    ('Nebula Trails Delay', 'Skyline FX', 'pedal', 'epic', 'boutique',
      'Dual-engine ambient delay with separate trails for wet/dry splits.', ARRAY['delay','ambient']),
    ('Atlas Expression Volume', 'Northstar Tone', 'pedal', 'uncommon', 'professional',
      'Passive volume/expression hybrid for swells and vocal throw automation.', ARRAY['volume','expression']),
    ('Thunderbolt 50 Head', 'Stormcraft Amplification', 'amplifier', 'rare', 'professional',
      'Road-tuned 50w tube head voiced for arena guitar clarity.', ARRAY['amp','head']),
    ('Midnight 212 Cabinet', 'Stormcraft Amplification', 'speaker_cabinet', 'uncommon', 'standard',
      'Stack-matched 2x12 cabinet with cardioid isolation ports.', ARRAY['cab','speaker']),
    ('Voxon Stage Vocal Rack', 'Voxon Labs', 'vocal_rig', 'rare', 'professional',
      'Integrated vocal preamp, compressor, and spatial doubler for headline sets.', ARRAY['vocals','rack']),
    ('Skyline Wireless IEM Set', 'Skyline FX', 'accessory', 'rare', 'professional',
      'Diversity wireless in-ear monitor system synced to pedalboard clocking.', ARRAY['monitoring','iem'])
  ON CONFLICT (name) DO UPDATE
  SET
    manufacturer = EXCLUDED.manufacturer,
    gear_type = EXCLUDED.gear_type,
    rarity = EXCLUDED.rarity,
    quality = EXCLUDED.quality,
    description = EXCLUDED.description,
    tags = EXCLUDED.tags,
    updated_at = now();

  SELECT id INTO splitter_id FROM public.gear_items WHERE name = 'Helios Deluxe Splitter';
  SELECT id INTO drive_id FROM public.gear_items WHERE name = 'Aurora Drive MKII';
  SELECT id INTO modulation_id FROM public.gear_items WHERE name = 'Cascade Prism Chorus';
  SELECT id INTO ambient_id FROM public.gear_items WHERE name = 'Nebula Trails Delay';
  SELECT id INTO utility_id FROM public.gear_items WHERE name = 'Atlas Expression Volume';
  SELECT id INTO amp_head_id FROM public.gear_items WHERE name = 'Thunderbolt 50 Head';
  SELECT id INTO cab_id FROM public.gear_items WHERE name = 'Midnight 212 Cabinet';
  SELECT id INTO vocal_rig_id FROM public.gear_items WHERE name = 'Voxon Stage Vocal Rack';
  SELECT id INTO monitoring_id FROM public.gear_items WHERE name = 'Skyline Wireless IEM Set';

  SELECT id INTO sample_profile_id
  FROM public.profiles
  ORDER BY created_at
  LIMIT 1;

  IF sample_profile_id IS NOT NULL THEN
    INSERT INTO public.personal_loadouts (
      character_id,
      name,
      role,
      scenario,
      primary_instrument,
      notes,
      is_active
    )
    VALUES (
      sample_profile_id,
      'Hybrid Arena Rig',
      'guitar + lead vocals',
      'Arena tour with vocal/guitar split routing',
      'Solaris Custom Baritone',
      'Dual-path setup splitting guitar pedalboard to Thunderbolt head while feeding Voxon vocal rack and IEM send.',
      true
    )
    ON CONFLICT (character_id, name) DO UPDATE
    SET
      scenario = EXCLUDED.scenario,
      notes = EXCLUDED.notes,
      updated_at = now()
    RETURNING id INTO loadout_id;

    IF loadout_id IS NULL THEN
      SELECT id INTO loadout_id
      FROM public.personal_loadouts
      WHERE character_id = sample_profile_id
        AND name = 'Hybrid Arena Rig';
    END IF;

    IF loadout_id IS NOT NULL THEN
      INSERT INTO public.personal_loadout_items (loadout_id, gear_item_id, slot_kind, notes)
      VALUES
        (loadout_id, splitter_id, 'pedalboard_split', 'Routes dry guitar to amp and wet blend to vocal rack.'),
        (loadout_id, amp_head_id, 'amp_head', 'Main stage head driven from pedalboard A path.'),
        (loadout_id, cab_id, 'speaker_cabinet', 'Backline cab mic’d plus ISO cab for broadcast mix.'),
        (loadout_id, vocal_rig_id, 'vocal_rig', 'Handles lead vocal sweetening and delay compensation.'),
        (loadout_id, monitoring_id, 'monitoring', 'Wireless IEMs synced to Helios clock out.')
      ON CONFLICT (loadout_id, gear_item_id, slot_kind) DO UPDATE
      SET notes = EXCLUDED.notes,
          updated_at = now();

      INSERT INTO public.personal_loadout_pedal_slots (loadout_id, slot_number, slot_type, gear_item_id, notes)
      VALUES
        (loadout_id, 1, 'input', splitter_id, 'Buffer and split before drive section.'),
        (loadout_id, 2, 'drive', drive_id, 'Primary gain staging with programmable channels.'),
        (loadout_id, 3, 'modulation', modulation_id, 'Mod chorus fed only to wet split.'),
        (loadout_id, 4, 'ambient', ambient_id, 'Stereo delays blended to FOH and IEM returns.'),
        (loadout_id, 5, 'expression', utility_id, 'Expression pedal mapped to vocal doubler mix.')
      ON CONFLICT (loadout_id, slot_number) DO UPDATE
      SET
        slot_type = EXCLUDED.slot_type,
        gear_item_id = EXCLUDED.gear_item_id,
        notes = EXCLUDED.notes,
        updated_at = now();
    END IF;
  END IF;
END $$;
