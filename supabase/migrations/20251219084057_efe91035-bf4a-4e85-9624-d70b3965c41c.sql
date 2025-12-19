-- Add more UK radio stations - national only (local requires city_id)
INSERT INTO radio_stations (name, station_type, country, listener_base, quality_level, min_fame_required, accepted_genres, description) VALUES
-- BBC Regional/Talk
('BBC Radio 4', 'national', 'UK', 10000000, 5, 400, ARRAY['classical', 'folk', 'world'], 'BBC spoken word and current affairs'),
('BBC Radio 5 Live', 'national', 'UK', 6000000, 4, 300, ARRAY['pop', 'rock'], 'BBC news and sport station'),
-- Commercial Talk/Urban
('LBC', 'national', 'UK', 4000000, 4, 350, ARRAY['pop', 'classical'], 'Leading British talk radio'),
('talkSPORT', 'national', 'UK', 3500000, 4, 250, ARRAY['rock', 'pop'], 'UK sports talk radio'),
('Capital Xtra', 'national', 'UK', 3000000, 4, 200, ARRAY['hip hop', 'r&b', 'grime', 'afrobeats'], 'Urban and hip hop music'),
('Kisstory', 'national', 'UK', 4000000, 3, 150, ARRAY['dance', 'r&b', 'pop'], 'Classic dance and R&B hits'),
-- Specialty
('Jazz FM', 'national', 'UK', 800000, 4, 200, ARRAY['jazz', 'soul', 'blues'], 'UK dedicated jazz station'),
('Scala Radio', 'national', 'UK', 1000000, 4, 250, ARRAY['classical'], 'UK classical music station'),
('Kerrang Radio', 'national', 'UK', 1200000, 4, 200, ARRAY['rock', 'metal', 'alternative'], 'UK rock and metal station'),
('Planet Rock', 'national', 'UK', 1500000, 4, 200, ARRAY['rock', 'classic rock'], 'Classic rock station'),
('Smooth Radio', 'national', 'UK', 5000000, 4, 200, ARRAY['pop', 'soul', 'jazz'], 'Easy listening adult contemporary');