-- Seed example gear catalog entries and a sample personal loadout
DO $$
DECLARE
  sample_profile_id uuid;
  loadout_id uuid;
  pedal_router_id uuid;
  lead_drive_id uuid;
  shimmer_mod_id uuid;
  cloud_delay_id uuid;
  vocal_suite_id uuid;
  wireless_monitor_id uuid;
  travel_amp_id uuid;
  micro_cab_id uuid;
BEGIN
  INSERT INTO public.gear_items (name, manufacturer, gear_type, rarity, quality, description, tags)
  VALUES
    ('Solstice Vocal Suite', 'Aural Forge', 'vocal_rig', 'epic', 'professional',
      'Stage vocal rack with transparent compression and dynamic doubler.', ARRAY['vocals','rack','touring']),
    ('Pulse Runner Splitter', 'Nightline Audio', 'pedalboard', 'rare', 'professional',
      'Programmable router for dual-instrument pedalboards with MIDI clock.', ARRAY['routing','utility']),
    ('Nova Gain Stage', 'Straylight Labs', 'pedal', 'rare', 'boutique',
      'Medium-gain drive voiced for clarity in arena mixes.', ARRAY['drive','gain','pedal']),
    ('Horizon Wash Chorus', 'Straylight Labs', 'pedal', 'uncommon', 'professional',
      'Wide stereo chorus tuned for shimmer layers in vocal blends.', ARRAY['modulation','chorus']),
    ('Crescent Trail Delay', 'Orbit Signal', 'pedal', 'epic', 'boutique',
      'Dual-engine ambience delay with spillover for vocal swells.', ARRAY['delay','ambient','pedal']),
    ('Auric Wireless Pack', 'Orbit Signal', 'accessory', 'rare', 'professional',
      'Frequency-agile wireless IEM system with auto gain tracking.', ARRAY['monitoring','iem']),
    ('Emberfly 30 Compact', 'Forge Amplification', 'amplifier', 'uncommon', 'standard',
      'Lightweight 30w amp tuned for fly dates and club shows.', ARRAY['amp','portable']),
    ('Feather 112 Cab', 'Forge Amplification', 'speaker_cabinet', 'uncommon', 'standard',
      'Compact 1x12 cabinet designed to pair with Emberfly series heads.', ARRAY['cabinet','portable'])
  ON CONFLICT (name) DO UPDATE
  SET
    manufacturer = EXCLUDED.manufacturer,
    gear_type = EXCLUDED.gear_type,
    rarity = EXCLUDED.rarity,
    quality = EXCLUDED.quality,
    description = EXCLUDED.description,
    tags = EXCLUDED.tags,
    updated_at = now();

  SELECT id INTO pedal_router_id FROM public.gear_items WHERE name = 'Pulse Runner Splitter';
  SELECT id INTO lead_drive_id FROM public.gear_items WHERE name = 'Nova Gain Stage';
  SELECT id INTO shimmer_mod_id FROM public.gear_items WHERE name = 'Horizon Wash Chorus';
  SELECT id INTO cloud_delay_id FROM public.gear_items WHERE name = 'Crescent Trail Delay';
  SELECT id INTO vocal_suite_id FROM public.gear_items WHERE name = 'Solstice Vocal Suite';
  SELECT id INTO wireless_monitor_id FROM public.gear_items WHERE name = 'Auric Wireless Pack';
  SELECT id INTO travel_amp_id FROM public.gear_items WHERE name = 'Emberfly 30 Compact';
  SELECT id INTO micro_cab_id FROM public.gear_items WHERE name = 'Feather 112 Cab';

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
      'Celestial Harmony Rig',
      'lead vocals + auxiliary guitar',
      'Fly-date configuration pairing compact guitar rig with vocal suite routing',
      'Skybound Offset Deluxe',
      'Router splits guitar pedalboard while feeding Solstice vocal suite and wireless monitors.',
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
        AND name = 'Celestial Harmony Rig';
    END IF;

    IF loadout_id IS NOT NULL THEN
      INSERT INTO public.personal_loadout_slots (loadout_id, gear_item_id, gear_type, pedal_position, pedal_stage, notes)
      VALUES
        (loadout_id, pedal_router_id, 'pedalboard', NULL, NULL, 'Main router providing instrument/vocal splits.'),
        (loadout_id, lead_drive_id, 'pedal', 1, 'drive', 'First gain stage for auxiliary guitar support.'),
        (loadout_id, shimmer_mod_id, 'pedal', 2, 'modulation', 'Wide modulation for vocal shimmer sends.'),
        (loadout_id, cloud_delay_id, 'pedal', 3, 'ambient', 'Long ambient delay shared between guitar and vocals.'),
        (loadout_id, vocal_suite_id, 'vocal_rig', NULL, NULL, 'Primary vocal processing chain for lead singer.'),
        (loadout_id, wireless_monitor_id, 'accessory', NULL, NULL, 'Wireless in-ears synchronized to router clock.'),
        (loadout_id, travel_amp_id, 'amplifier', NULL, NULL, 'Compact amp capturing split guitar signal.'),
        (loadout_id, micro_cab_id, 'speaker_cabinet', NULL, NULL, 'Lightweight cab mic’d for FOH and broadcast mix.')
      ON CONFLICT (loadout_id, gear_item_id) DO UPDATE
      SET
        gear_type = EXCLUDED.gear_type,
        pedal_position = EXCLUDED.pedal_position,
        pedal_stage = EXCLUDED.pedal_stage,
        notes = EXCLUDED.notes,
        updated_at = now();
    END IF;
  END IF;
END $$;
