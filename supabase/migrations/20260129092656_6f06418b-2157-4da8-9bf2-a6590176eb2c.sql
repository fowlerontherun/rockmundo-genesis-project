-- Update Marcus Stone to be the easy-to-find starter mentor
-- Located in London, available every day (null = any day), not discoverable (auto-discovered)
UPDATE education_mentors 
SET 
  city_id = '9f26ad86-51ed-4477-856d-610f14979310', -- London
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
  city_id = '2a518758-067c-4d34-8ff6-666a31169fe7', -- Nashville
  available_day = 3, -- Wednesday
  cost = 25000,
  lore_biography = 'The greatest songwriter of our generation. His melodies have topped charts in 40 countries.',
  discovery_hint = 'They say a songwriting legend teaches at a famous Nashville studio on Wednesdays...'
WHERE name = 'Burt Backache';

UPDATE education_mentors 
SET 
  city_id = '8215d23e-5714-478e-9ac8-b7b82994fdc6', -- Austin
  available_day = 5, -- Friday
  cost = 35000,
  lore_biography = 'Punk rock pioneer who invented the Austin sound. Still rocking at 70.',
  discovery_hint = 'Rumor has it an old punk legend holds court at an Austin dive bar every Friday...'
WHERE name = 'Eddie Van Bumdem';

UPDATE education_mentors 
SET 
  city_id = '0c9c8a7e-c6b4-4927-932a-8491c2b40a06', -- Rio de Janeiro
  available_day = 6, -- Saturday
  cost = 20000,
  lore_biography = 'The groove master from Rio who pioneered the fusion of funk and samba.',
  discovery_hint = 'There is a bass virtuoso in Rio who only teaches on Saturdays during Carnival season...'
WHERE name = 'Groove Master D';

UPDATE education_mentors 
SET 
  city_id = '06a16e6b-5888-4046-90d8-dfca01eda238', -- Sydney
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