-- Add more real-world TV Networks
INSERT INTO tv_networks (name, network_type, country, viewer_base, min_fame_required, quality_level, is_active, genres) VALUES
-- US Networks
('NBC', 'national', 'United States', 8000000, 15000, 5, true, ARRAY['pop', 'rock', 'country']),
('ABC', 'national', 'United States', 7500000, 14000, 5, true, ARRAY['pop', 'rock']),
('CBS', 'national', 'United States', 7000000, 13000, 5, true, ARRAY['pop', 'country']),
('Fox', 'national', 'United States', 6000000, 12000, 4, true, ARRAY['pop', 'rock', 'hip-hop']),
('HBO', 'cable', 'United States', 3000000, 20000, 5, true, ARRAY['pop', 'rock', 'jazz']),
('Comedy Central', 'cable', 'United States', 1500000, 8000, 4, true, ARRAY['pop', 'hip-hop', 'rock']),
('VH1', 'cable', 'United States', 1200000, 6000, 3, true, ARRAY['pop', 'r&b', 'hip-hop']),
('BET', 'cable', 'United States', 1000000, 5000, 3, true, ARRAY['hip-hop', 'r&b', 'soul']),
('Fuse', 'cable', 'United States', 500000, 3000, 2, true, ARRAY['rock', 'alternative', 'metal']),
('PBS', 'national', 'United States', 2000000, 5000, 4, true, ARRAY['classical', 'jazz', 'world']),
-- European
('ARD', 'national', 'Germany', 6000000, 8000, 4, true, ARRAY['pop', 'schlager']),
('ProSieben', 'national', 'Germany', 3000000, 5000, 3, true, ARRAY['pop', 'rock']),
('TF1', 'national', 'France', 7000000, 10000, 5, true, ARRAY['pop', 'chanson']),
('France 2', 'national', 'France', 4000000, 7000, 4, true, ARRAY['pop', 'world']),
('Canal+', 'cable', 'France', 2000000, 8000, 4, true, ARRAY['pop', 'rock', 'jazz']),
('Rai Uno', 'national', 'Italy', 5000000, 8000, 4, true, ARRAY['pop', 'opera']),
('Mediaset Italia', 'national', 'Italy', 4000000, 6000, 3, true, ARRAY['pop', 'dance']),
('TVE', 'national', 'Spain', 4000000, 6000, 4, true, ARRAY['pop', 'latin', 'flamenco']),
('Antena 3', 'national', 'Spain', 3500000, 5000, 3, true, ARRAY['pop', 'latin']),
('RTL Netherlands', 'national', 'Netherlands', 1500000, 4000, 3, true, ARRAY['pop', 'dance']),
('TV2 Norway', 'national', 'Norway', 1200000, 3000, 3, true, ARRAY['pop', 'indie']),
('SVT', 'national', 'Sweden', 2000000, 4000, 4, true, ARRAY['pop', 'indie', 'electronic']),
('ABC Australia', 'national', 'Australia', 2500000, 5000, 4, true, ARRAY['pop', 'rock', 'indie']),
('Seven Network', 'national', 'Australia', 2000000, 4000, 3, true, ARRAY['pop', 'country']),
('NHK', 'national', 'Japan', 10000000, 15000, 5, true, ARRAY['pop', 'rock', 'electronic']),
-- Streaming
('Apple TV+', 'streaming', 'Global', 5000000, 20000, 5, true, ARRAY['pop', 'rock', 'documentary']),
('Disney+', 'streaming', 'Global', 8000000, 18000, 5, true, ARRAY['pop', 'disney', 'soundtrack']),
('Hulu', 'streaming', 'United States', 4000000, 12000, 4, true, ARRAY['pop', 'rock']),
('Paramount+', 'streaming', 'Global', 3000000, 10000, 4, true, ARRAY['pop', 'rock', 'country']);