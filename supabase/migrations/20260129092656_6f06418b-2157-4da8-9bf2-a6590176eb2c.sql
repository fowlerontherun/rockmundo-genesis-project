-- Update Marcus Stone to be the easy-to-find starter mentor
-- Resolve cities by canonical name rather than brittle environment-specific UUIDs.
UPDATE education_mentors 
SET 
  city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('London') LIMIT 1),
  available_day = NULL, -- Available any day
  is_discoverable = false, -- Auto-discovered for all players
  lore_biography = 'A legendary fingerstyle guitarist who trained some of the biggest names in British rock. Known for his patient teaching style and encyclopedic knowledge of music theory.',
  lore_achievement = 'Trained 3 Grammy-winning guitarists',
  discovery_hint = NULL, -- Not needed since auto-discovered
  cost = 15000, -- Premium but accessible
  base_xp = 400,
  skill_gain_ratio = 1.5,
  cooldown_hours = 72
WHERE id = '1006ea78-2490-43ff-8265-486d9dcd70c6';

-- Update other mentors with city/day assignments
UPDATE education_mentors 
SET 
  city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('Nashville') LIMIT 1),
  available_day = 3, -- Wednesday
  cost = 25000,
  lore_biography = 'The greatest songwriter of our generation. His melodies have topped charts in 40 countries.',
  discovery_hint = 'They say a songwriting legend teaches at a famous Nashville studio on Wednesdays...'
WHERE name = 'Burt Backache';

UPDATE education_mentors 
SET 
  city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('Austin') LIMIT 1),
  available_day = 5, -- Friday
  cost = 35000,
  lore_biography = 'Punk rock pioneer who invented the Austin sound. Still rocking at 70.',
  discovery_hint = 'Rumor has it an old punk legend holds court at an Austin dive bar every Friday...'
WHERE name = 'Eddie Van Bumdem';

UPDATE education_mentors 
SET 
  city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('Rio de Janeiro') LIMIT 1),
  available_day = 6, -- Saturday
  cost = 20000,
  lore_biography = 'The groove master from Rio who pioneered the fusion of funk and samba.',
  discovery_hint = 'There is a bass virtuoso in Rio who only teaches on Saturdays during Carnival season...'
WHERE name = 'Groove Master D';

UPDATE education_mentors 
SET 
  city_id = (SELECT id FROM public.cities WHERE lower(name) = lower('Sydney') LIMIT 1),
  available_day = 1, -- Monday
  cost = 30000,
  lore_biography = 'Australian drum legend known for impossibly fast double bass technique.',
  discovery_hint = 'A drum master in Sydney teaches the secrets of speed on Mondays...'
WHERE name = 'Tommy Beats';

-- Auto-discover Marcus Stone for all existing players
INSERT INTO player_master_discoveries (profile_id, mentor_id, discovery_method, discovery_metadata)
SELECT p.id, '1006ea78-2490-43ff-8265-486d9dcd70c6', 'admin_grant', '{"reason": "Starter master - auto-discovered"}'::jsonb
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM player_master_discoveries d 
  WHERE d.profile_id = p.id AND d.mentor_id = '1006ea78-2490-43ff-8265-486d9dcd70c6'
);