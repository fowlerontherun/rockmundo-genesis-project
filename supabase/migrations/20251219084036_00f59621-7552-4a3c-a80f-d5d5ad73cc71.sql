-- Add more UK TV shows with correct show_types
INSERT INTO tv_shows (network_id, show_name, show_type, host_name, time_slot, viewer_reach, min_fame_required, description, days_of_week) 
SELECT n.id, s.show_name, s.show_type, s.host_name, s.time_slot, s.viewer_reach, s.min_fame_required, s.description, s.days_of_week
FROM (VALUES
  ('BBC Three', 'The Rap Game UK', 'music_special', NULL, 'prime_time', 2000000, 200, 'UK rap competition show', ARRAY[4]),
  ('BBC Four', 'Sounds of the 80s', 'music_special', 'Gary Davies', 'prime_time', 1500000, 250, 'Classic 80s music performances', ARRAY[6]),
  ('ITV2', 'Love Island Aftersun', 'entertainment', 'Maya Jama', 'late_night', 3000000, 300, 'Love Island companion show', ARRAY[0]),
  ('E4', 'Hollyoaks', 'entertainment', NULL, 'prime_time', 2500000, 150, 'Popular UK soap opera', ARRAY[1,2,3,4,5]),
  ('Dave', 'Taskmaster', 'entertainment', 'Greg Davies', 'prime_time', 3000000, 200, 'Comedy panel game show', ARRAY[4]),
  ('Sky One', 'A League of Their Own', 'entertainment', 'Jamie Redknapp', 'prime_time', 4000000, 350, 'Sports comedy panel show', ARRAY[4]),
  ('Gold', 'QI XL', 'entertainment', 'Sandi Toksvig', 'prime_time', 2000000, 200, 'Extended version of QI', ARRAY[5]),
  ('ITV3', 'Heartbeat', 'entertainment', NULL, 'prime_time', 1500000, 100, 'Classic British drama', ARRAY[2]),
  ('More4', 'Grand Designs', 'entertainment', 'Kevin McCloud', 'prime_time', 2000000, 200, 'Architecture and design show', ARRAY[3]),
  ('5Star', 'Celebrity SAS', 'entertainment', 'Ant Middleton', 'prime_time', 2500000, 300, 'Celebrity survival challenge', ARRAY[0])
) AS s(network_name, show_name, show_type, host_name, time_slot, viewer_reach, min_fame_required, description, days_of_week)
JOIN tv_networks n ON n.name = s.network_name;