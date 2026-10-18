-- Read-only smoke test of clean nightclub quest catalogue, safe against live DB.
DO $check$
DECLARE expected_count integer;
DECLARE orphan_count integer;
BEGIN
  WITH required(npc_id, club_name) AS (VALUES ('berghain_bouncer_sven', 'Berghain'),
('tresor_dj_resident', 'Tresor'),
('marquee_promoter_vince', 'Marquee New York'),
('output_sound_eng', 'Output'),
('amnesia_owner_martin', 'Amnesia'),
('ushuaia_booker_sofia', 'Ushuaïa'),
('subclub_dj_harri', 'Sub Club'),
('motion_promoter_jay', 'Motion'),
('circus_owner_yousef', 'Circus'),
('smartbar_resident_derrick', 'Smart Bar'),
('space_terrace_dj', 'Club Space'),
('liv_manager_david', 'LIV'),
('xs_booker_jesse', 'XS Nightclub'),
('blacksheep_owner_maz', 'The Black Sheep'),
('wire_owner_tom', 'Wire'),
('paradiso_curator_eva', 'Paradiso'),
('caves_dj_angus', 'The Caves'),
('hopeworks_promoter_lee', 'Hope Works'),
('digital_booker_sarah', 'Digital'),
('clwb_manager_rhys', 'Clwb Ifor Bach'),
('patterns_curator_nina', 'Patterns'),
('stealth_owner_kim', 'Stealth'),
('limelight_vicar_pete', 'Limelight'),
('colo_owner_marcus', 'The Colosseum'),
('sound_curator_adam', 'Sound Nightclub'))
  SELECT count(*) INTO expected_count
  FROM required req
  JOIN public.city_night_clubs club ON lower(club.name) = lower(req.club_name)
  JOIN public.nightclub_quests quest ON quest.club_id=club.id AND quest.npc_id=req.npc_id;
  IF expected_count<>25 THEN
    RAISE EXCEPTION 'Expected 25 seeded nightclub quests with matching clubs/NPCs; got %',expected_count;
  END IF;
  SELECT count(*) INTO orphan_count FROM public.nightclub_quests quest
  LEFT JOIN public.city_night_clubs club ON club.id=quest.club_id
  WHERE club.id IS NULL;
  IF orphan_count<>0 THEN RAISE EXCEPTION 'Nightclub quests contain % orphan rows',orphan_count; END IF;
  IF (SELECT count(*) FROM public.city_night_clubs WHERE name='The Black Sheep')<>1 THEN
    RAISE EXCEPTION 'Black Sheep nightclub must exist exactly once';
  END IF;
END $check$;
