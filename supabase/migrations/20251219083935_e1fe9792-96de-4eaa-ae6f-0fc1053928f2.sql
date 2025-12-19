-- Add more UK TV networks
INSERT INTO tv_networks (name, country, network_type, viewer_base, quality_level, min_fame_required, genres, description) VALUES
-- BBC Networks
('BBC Three', 'UK', 'national', 8000000, 4, 200, ARRAY['pop', 'indie', 'electronic', 'hip hop'], 'BBC youth-oriented digital channel'),
('BBC Four', 'UK', 'national', 5000000, 4, 300, ARRAY['classical', 'jazz', 'world', 'folk'], 'BBC arts and culture channel'),
-- ITV Networks
('ITV2', 'UK', 'national', 12000000, 4, 150, ARRAY['pop', 'dance', 'hip hop'], 'ITV digital entertainment channel'),
('ITV3', 'UK', 'national', 6000000, 3, 200, ARRAY['pop', 'rock', 'jazz'], 'ITV drama and classic TV channel'),
('ITV4', 'UK', 'national', 4000000, 3, 150, ARRAY['rock', 'indie', 'pop'], 'ITV sport and entertainment channel'),
('ITVBe', 'UK', 'national', 3000000, 3, 100, ARRAY['pop', 'r&b', 'dance'], 'ITV lifestyle and reality channel'),
-- Channel 4 Family
('E4', 'UK', 'national', 10000000, 4, 200, ARRAY['indie', 'alternative', 'pop', 'electronic'], 'Channel 4 youth entertainment'),
('More4', 'UK', 'national', 4000000, 3, 150, ARRAY['world', 'folk', 'jazz'], 'Channel 4 lifestyle channel'),
('Film4', 'UK', 'national', 6000000, 3, 200, ARRAY['soundtrack', 'classical', 'indie'], 'Channel 4 film channel'),
-- UKTV Networks
('Dave', 'UK', 'cable', 8000000, 3, 150, ARRAY['rock', 'indie', 'pop'], 'UKTV comedy and entertainment'),
('Yesterday', 'UK', 'cable', 3000000, 2, 100, ARRAY['classical', 'folk', 'world'], 'UKTV factual channel'),
('Gold', 'UK', 'cable', 5000000, 3, 150, ARRAY['pop', 'rock', 'jazz'], 'UKTV classic comedy channel'),
('Drama', 'UK', 'cable', 4000000, 3, 150, ARRAY['classical', 'pop', 'rock'], 'UKTV drama channel'),
('W', 'UK', 'cable', 3000000, 2, 100, ARRAY['pop', 'r&b', 'soul'], 'UKTV women lifestyle'),
-- Sky Networks
('Sky One', 'UK', 'cable', 15000000, 5, 400, ARRAY['pop', 'rock', 'indie', 'electronic'], 'Sky flagship entertainment'),
('Sky Showcase', 'UK', 'cable', 12000000, 5, 350, ARRAY['pop', 'rock', 'r&b'], 'Sky premiere showcase channel'),
('Sky Max', 'UK', 'cable', 10000000, 4, 300, ARRAY['pop', 'rock'], 'Sky entertainment channel'),
-- Channel 5 Family
('5Star', 'UK', 'national', 5000000, 3, 150, ARRAY['pop', 'dance', 'r&b'], 'Channel 5 entertainment channel'),
('Quest', 'UK', 'national', 4000000, 3, 100, ARRAY['rock', 'country', 'folk'], 'Discovery UK factual channel');