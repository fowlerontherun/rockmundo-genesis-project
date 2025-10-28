-- Fix genre skills: Populate skill_definitions table from skill tree
-- This migration ensures all skills from the skill tree are in the database

-- First, let's insert all skill definitions from the skill tree
-- Genre skills (31 genres × 3 tiers = 93 skills)
INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps) VALUES
-- Rock genre tiers
('genres_basic_rock', 'Basic Rock', 'Study the roots, rhythms, and instrumentation that define Rock.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_rock', 'Professional Rock', 'Produce polished Rock songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_rock', 'Rock Mastery', 'Innovate within Rock and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Pop genre tiers
('genres_basic_pop', 'Basic Pop', 'Study the roots, rhythms, and instrumentation that define Pop.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_pop', 'Professional Pop', 'Produce polished Pop songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_pop', 'Pop Mastery', 'Innovate within Pop and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Hip Hop genre tiers
('genres_basic_hip_hop', 'Basic Hip Hop', 'Study the roots, rhythms, and instrumentation that define Hip Hop.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_hip_hop', 'Professional Hip Hop', 'Produce polished Hip Hop songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_hip_hop', 'Hip Hop Mastery', 'Innovate within Hip Hop and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Jazz genre tiers
('genres_basic_jazz', 'Basic Jazz', 'Study the roots, rhythms, and instrumentation that define Jazz.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_jazz', 'Professional Jazz', 'Produce polished Jazz songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_jazz', 'Jazz Mastery', 'Innovate within Jazz and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Blues genre tiers
('genres_basic_blues', 'Basic Blues', 'Study the roots, rhythms, and instrumentation that define Blues.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_blues', 'Professional Blues', 'Produce polished Blues songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_blues', 'Blues Mastery', 'Innovate within Blues and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Country genre tiers
('genres_basic_country', 'Basic Country', 'Study the roots, rhythms, and instrumentation that define Country.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_country', 'Professional Country', 'Produce polished Country songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_country', 'Country Mastery', 'Innovate within Country and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Reggae genre tiers
('genres_basic_reggae', 'Basic Reggae', 'Study the roots, rhythms, and instrumentation that define Reggae.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_reggae', 'Professional Reggae', 'Produce polished Reggae songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_reggae', 'Reggae Mastery', 'Innovate within Reggae and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Heavy Metal genre tiers
('genres_basic_heavy_metal', 'Basic Heavy Metal', 'Study the roots, rhythms, and instrumentation that define Heavy Metal.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_heavy_metal', 'Professional Heavy Metal', 'Produce polished Heavy Metal songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_heavy_metal', 'Heavy Metal Mastery', 'Innovate within Heavy Metal and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Classical genre tiers
('genres_basic_classical', 'Basic Classical', 'Study the roots, rhythms, and instrumentation that define Classical.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_classical', 'Professional Classical', 'Produce polished Classical songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_classical', 'Classical Mastery', 'Innovate within Classical and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Electronica genre tiers
('genres_basic_electronica', 'Basic Electronica', 'Study the roots, rhythms, and instrumentation that define Electronica.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_electronica', 'Professional Electronica', 'Produce polished Electronica songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_electronica', 'Electronica Mastery', 'Innovate within Electronica and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Latin genre tiers
('genres_basic_latin', 'Basic Latin', 'Study the roots, rhythms, and instrumentation that define Latin.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_latin', 'Professional Latin', 'Produce polished Latin songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_latin', 'Latin Mastery', 'Innovate within Latin and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- World Music genre tiers
('genres_basic_world_music', 'Basic World Music', 'Study the roots, rhythms, and instrumentation that define World Music.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_world_music', 'Professional World Music', 'Produce polished World Music songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_world_music', 'World Music Mastery', 'Innovate within World Music and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- R&B genre tiers
('genres_basic_r_and_b', 'Basic R&B', 'Study the roots, rhythms, and instrumentation that define R&B.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_r_and_b', 'Professional R&B', 'Produce polished R&B songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_r_and_b', 'R&B Mastery', 'Innovate within R&B and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Punk Rock genre tiers
('genres_basic_punk_rock', 'Basic Punk Rock', 'Study the roots, rhythms, and instrumentation that define Punk Rock.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_punk_rock', 'Professional Punk Rock', 'Produce polished Punk Rock songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_punk_rock', 'Punk Rock Mastery', 'Innovate within Punk Rock and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Flamenco genre tiers
('genres_basic_flamenco', 'Basic Flamenco', 'Study the roots, rhythms, and instrumentation that define Flamenco.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_flamenco', 'Professional Flamenco', 'Produce polished Flamenco songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_flamenco', 'Flamenco Mastery', 'Innovate within Flamenco and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- African Music genre tiers
('genres_basic_african_music', 'Basic African Music', 'Study the roots, rhythms, and instrumentation that define African Music.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_african_music', 'Professional African Music', 'Produce polished African Music songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_african_music', 'African Music Mastery', 'Innovate within African Music and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Modern Rock genre tiers
('genres_basic_modern_rock', 'Basic Modern Rock', 'Study the roots, rhythms, and instrumentation that define Modern Rock.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_modern_rock', 'Professional Modern Rock', 'Produce polished Modern Rock songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_modern_rock', 'Modern Rock Mastery', 'Innovate within Modern Rock and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- EDM genre tiers
('genres_basic_edm', 'Basic EDM', 'Study the roots, rhythms, and instrumentation that define EDM.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_edm', 'Professional EDM', 'Produce polished EDM songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_edm', 'EDM Mastery', 'Innovate within EDM and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Trap genre tiers
('genres_basic_trap', 'Basic Trap', 'Study the roots, rhythms, and instrumentation that define Trap.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_trap', 'Professional Trap', 'Produce polished Trap songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_trap', 'Trap Mastery', 'Innovate within Trap and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Drill genre tiers
('genres_basic_drill', 'Basic Drill', 'Study the roots, rhythms, and instrumentation that define Drill.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_drill', 'Professional Drill', 'Produce polished Drill songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_drill', 'Drill Mastery', 'Innovate within Drill and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Lo-Fi Hip Hop genre tiers
('genres_basic_lo_fi_hip_hop', 'Basic Lo-Fi Hip Hop', 'Study the roots, rhythms, and instrumentation that define Lo-Fi Hip Hop.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_lo_fi_hip_hop', 'Professional Lo-Fi Hip Hop', 'Produce polished Lo-Fi Hip Hop songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_lo_fi_hip_hop', 'Lo-Fi Hip Hop Mastery', 'Innovate within Lo-Fi Hip Hop and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- K-Pop/J-Pop genre tiers
('genres_basic_k_pop_j_pop', 'Basic K-Pop/J-Pop', 'Study the roots, rhythms, and instrumentation that define K-Pop/J-Pop.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_k_pop_j_pop', 'Professional K-Pop/J-Pop', 'Produce polished K-Pop/J-Pop songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_k_pop_j_pop', 'K-Pop/J-Pop Mastery', 'Innovate within K-Pop/J-Pop and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Afrobeats/Amapiano genre tiers
('genres_basic_afrobeats_amapiano', 'Basic Afrobeats/Amapiano', 'Study the roots, rhythms, and instrumentation that define Afrobeats/Amapiano.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_afrobeats_amapiano', 'Professional Afrobeats/Amapiano', 'Produce polished Afrobeats/Amapiano songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_afrobeats_amapiano', 'Afrobeats/Amapiano Mastery', 'Innovate within Afrobeats/Amapiano and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Synthwave genre tiers
('genres_basic_synthwave', 'Basic Synthwave', 'Study the roots, rhythms, and instrumentation that define Synthwave.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_synthwave', 'Professional Synthwave', 'Produce polished Synthwave songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_synthwave', 'Synthwave Mastery', 'Innovate within Synthwave and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Indie/Bedroom Pop genre tiers
('genres_basic_indie_bedroom_pop', 'Basic Indie/Bedroom Pop', 'Study the roots, rhythms, and instrumentation that define Indie/Bedroom Pop.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_indie_bedroom_pop', 'Professional Indie/Bedroom Pop', 'Produce polished Indie/Bedroom Pop songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_indie_bedroom_pop', 'Indie/Bedroom Pop Mastery', 'Innovate within Indie/Bedroom Pop and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Hyperpop genre tiers
('genres_basic_hyperpop', 'Basic Hyperpop', 'Study the roots, rhythms, and instrumentation that define Hyperpop.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_hyperpop', 'Professional Hyperpop', 'Produce polished Hyperpop songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_hyperpop', 'Hyperpop Mastery', 'Innovate within Hyperpop and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Metalcore/Djent genre tiers
('genres_basic_metalcore_djent', 'Basic Metalcore/Djent', 'Study the roots, rhythms, and instrumentation that define Metalcore/Djent.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_metalcore_djent', 'Professional Metalcore/Djent', 'Produce polished Metalcore/Djent songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_metalcore_djent', 'Metalcore/Djent Mastery', 'Innovate within Metalcore/Djent and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb),

-- Alt R&B/Neo-Soul genre tiers
('genres_basic_alt_r_and_b_neo_soul', 'Basic Alt R&B/Neo-Soul', 'Study the roots, rhythms, and instrumentation that define Alt R&B/Neo-Soul.', '{"beginner": 50, "intermediate": 100, "advanced": 150}'::jsonb),
('genres_professional_alt_r_and_b_neo_soul', 'Professional Alt R&B/Neo-Soul', 'Produce polished Alt R&B/Neo-Soul songs ready for release and touring.', '{"beginner": 100, "intermediate": 200, "advanced": 300}'::jsonb),
('genres_mastery_alt_r_and_b_neo_soul', 'Alt R&B/Neo-Soul Mastery', 'Innovate within Alt R&B/Neo-Soul and shape the future sound of the genre.', '{"beginner": 200, "intermediate": 400, "advanced": 600}'::jsonb)

ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  tier_caps = EXCLUDED.tier_caps;

-- Add skill parent links for genre progression (basic -> professional -> mastery)
INSERT INTO public.skill_parent_links (skill_id, parent_skill_id) 
SELECT 
  sd_child.id,
  sd_parent.id
FROM skill_definitions sd_child
JOIN skill_definitions sd_parent ON 
  sd_child.slug LIKE 'genres_professional_%' 
  AND sd_parent.slug = REPLACE(sd_child.slug, 'professional', 'basic')
WHERE NOT EXISTS (
  SELECT 1 FROM skill_parent_links 
  WHERE skill_id = sd_child.id AND parent_skill_id = sd_parent.id
);

INSERT INTO public.skill_parent_links (skill_id, parent_skill_id)
SELECT 
  sd_child.id,
  sd_parent.id
FROM skill_definitions sd_child
JOIN skill_definitions sd_parent ON 
  sd_child.slug LIKE 'genres_mastery_%' 
  AND sd_parent.slug = REPLACE(sd_child.slug, 'mastery', 'professional')
WHERE NOT EXISTS (
  SELECT 1 FROM skill_parent_links 
  WHERE skill_id = sd_child.id AND parent_skill_id = sd_parent.id
);