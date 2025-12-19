-- Add real-world TV Shows (US networks only for now)
INSERT INTO tv_shows (network_id, show_name, show_type, host_name, time_slot, viewer_reach, slots_per_day, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, min_fame_required, is_active) VALUES
('cee6d3e3-d6ca-4966-bc04-c3b4b82bb89d', 'The Tonight Show Starring Jimmy Fallon', 'late_night', 'Jimmy Fallon', 'late_night', 3500000, 2, 800, 1500, 2000, 5000, 15000, 50000, 15000, true),
('cee6d3e3-d6ca-4966-bc04-c3b4b82bb89d', 'Today Show', 'morning_show', 'Hoda Kotb', 'morning', 4000000, 3, 600, 1200, 1500, 4000, 10000, 35000, 12000, true),
('cee6d3e3-d6ca-4966-bc04-c3b4b82bb89d', 'Saturday Night Live', 'entertainment', 'Various', 'late_night', 8000000, 1, 2000, 5000, 5000, 15000, 50000, 150000, 25000, true),
('5a0d4e0c-3810-4f54-b537-61337d54f24c', 'Good Morning America', 'morning_show', 'Robin Roberts', 'morning', 4500000, 3, 700, 1400, 1800, 4500, 12000, 40000, 14000, true),
('5a0d4e0c-3810-4f54-b537-61337d54f24c', 'Jimmy Kimmel Live', 'late_night', 'Jimmy Kimmel', 'late_night', 2000000, 2, 500, 1000, 1200, 3000, 12000, 40000, 12000, true),
('68191158-02c0-49ed-a310-8977ea479e50', 'The Late Show with Stephen Colbert', 'late_night', 'Stephen Colbert', 'late_night', 3000000, 2, 700, 1400, 1800, 4500, 15000, 45000, 14000, true),
('68191158-02c0-49ed-a310-8977ea479e50', 'CBS Mornings', 'morning_show', 'Gayle King', 'morning', 2800000, 3, 500, 1000, 1200, 3000, 10000, 30000, 10000, true),
('48a5523d-f03a-42bc-8ebe-bceec1681b74', 'The Masked Singer', 'entertainment', 'Nick Cannon', 'prime_time', 5000000, 1, 800, 1600, 2500, 6000, 20000, 60000, 15000, true),
('af4f13ae-49e0-436e-99cd-a5dc94b916f6', 'Last Week Tonight', 'talk_show', 'John Oliver', 'prime_time', 1500000, 1, 500, 1000, 1000, 2500, 15000, 40000, 12000, true),
('ff67467b-9bdb-4d71-a8f0-d96282651a65', 'Austin City Limits', 'music_special', 'Various', 'prime_time', 1000000, 1, 400, 800, 800, 2000, 5000, 15000, 5000, true),
('f843fb66-6e3c-49d8-b60e-d63623c2a16c', 'Music Station', 'music_special', 'Tamori', 'prime_time', 5000000, 2, 800, 1600, 2000, 5000, 15000, 45000, 12000, true);