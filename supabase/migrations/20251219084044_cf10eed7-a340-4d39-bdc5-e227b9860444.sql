-- Add more podcasts with correct podcast_types
INSERT INTO podcasts (podcast_name, podcast_type, listener_base, quality_level, min_fame_required, genres, host_name, description, episodes_per_week) VALUES
-- UK Popular Podcasts
('Happy Place', 'interview', 2000000, 4, 300, ARRAY['pop', 'indie', 'folk'], 'Fearne Cotton', 'Celebrity wellness and lifestyle interviews', 1),
('Off Menu', 'culture', 1500000, 4, 250, ARRAY['pop'], 'James Acaster & Ed Gamble', 'Comedy food podcast with celebrity guests', 1),
('No Such Thing As A Fish', 'culture', 2500000, 4, 200, ARRAY['pop'], 'QI Elves', 'Fun facts and comedy from QI researchers', 1),
('The Rest Is History', 'storytelling', 1800000, 4, 250, ARRAY['classical', 'world'], 'Tom Holland & Dominic Sandbrook', 'History podcast with celebrity guests', 2),
('Grounded with Louis Theroux', 'interview', 1200000, 5, 400, ARRAY['pop', 'indie'], 'Louis Theroux', 'In-depth celebrity interviews', 1),
-- Music Podcasts
('Switched On Pop', 'music', 800000, 4, 200, ARRAY['pop', 'r&b', 'hip hop'], 'Charlie Harding & Nate Sloan', 'Music analysis and theory podcast', 1),
('Song Exploder', 'music', 1500000, 5, 350, ARRAY['indie', 'rock', 'electronic', 'pop'], 'Hrishikesh Hirway', 'Artists break down their songs', 2),
('Questlove Supreme', 'music', 1000000, 5, 400, ARRAY['hip hop', 'soul', 'r&b', 'funk'], 'Questlove', 'Music interviews and discussions', 1),
('The Bob Lefsetz Podcast', 'industry', 500000, 4, 300, ARRAY['rock', 'pop', 'indie'], 'Bob Lefsetz', 'Music industry analysis', 2),
('Broken Record', 'interview', 800000, 5, 400, ARRAY['rock', 'pop', 'hip hop', 'jazz'], 'Rick Rubin', 'Deep dive music conversations', 1),
-- Celebrity Interview
('WTF with Marc Maron', 'interview', 3000000, 5, 500, ARRAY['rock', 'indie'], 'Marc Maron', 'Long-form celebrity interviews', 2),
('Conan Needs A Friend', 'culture', 2500000, 5, 450, ARRAY['pop'], 'Conan O Brien', 'Celebrity comedy interviews', 1),
('SmartLess', 'culture', 4000000, 5, 500, ARRAY['pop'], 'Bateman Arnett Hayes', 'Surprise celebrity interviews', 1);