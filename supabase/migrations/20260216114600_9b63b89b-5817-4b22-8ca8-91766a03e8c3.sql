
-- Add season column (may already exist from partial migration)
ALTER TABLE public.random_events ADD COLUMN IF NOT EXISTS season text;

-- Seed 16 seasonal random events
INSERT INTO public.random_events (title, description, category, option_a_text, option_a_effects, option_a_outcome_text, option_b_text, option_b_effects, option_b_outcome_text, is_active, season) VALUES
-- Winter
('Snowbound Studio', 'A heavy snowstorm has blocked roads to the studio.', 'financial', 'Pay £200 to clear the road', '{"cash": -200}', 'The road is cleared and you make it to the studio.', 'Take a day off', '{"energy": 20}', 'You rest at home and recover energy.', true, 'winter'),
('Christmas Market Gig', 'A Christmas market wants you to play a festive set!', 'opportunity', 'Accept the gig', '{"cash": 300, "fame": 50}', 'Great crowd! You earn cash and fame.', 'Decline politely', '{"energy": 10}', 'You enjoy a quiet evening instead.', true, 'winter'),
('New Year''s Resolution', 'A new year begins. Time to set a resolution!', 'personal', 'Focus on skills', '{"skill_boost": 5}', 'You feel sharper and more focused.', 'Focus on health', '{"health": 20}', 'You feel refreshed and healthy.', true, 'winter'),
('Heating Bill', 'Winter heating costs are through the roof.', 'financial', 'Pay the bill', '{"cash": -150}', 'Your studio stays warm and productive.', 'Bundle up and save', '{"health": -10}', 'You save money but catch a chill.', true, 'winter'),

-- Spring
('Festival Season Approaches', 'Festival organisers are accepting early applications.', 'opportunity', 'Apply early', '{"fame": 30, "cash": -50}', 'You secure a great festival slot!', 'Wait and see', '{}', 'You decide to wait for better offers.', true, 'spring'),
('Spring Cleaning', 'While tidying up, you find some old gear in storage.', 'loot', 'Sell the gear', '{"cash": 250}', 'You sell the vintage gear for a nice sum.', 'Keep it', '{"skill_boost": 2}', 'The old gear inspires your creativity.', true, 'spring'),
('Pollen Allergy', 'The vocalist is suffering from hay fever.', 'health', 'Rest up', '{"health": 15, "energy": -20}', 'A few days rest clears it up.', 'Push through', '{"health": -15}', 'The show goes on but quality suffers.', true, 'spring'),
('Cherry Blossom Tour', 'A promoter offers a special spring tour in Japan!', 'opportunity', 'Accept the tour', '{"fame": 100, "cash": 1000}', 'An incredible experience with great exposure!', 'Decline', '{}', 'Maybe next year.', true, 'spring'),

-- Summer
('Heatwave', 'A scorching heatwave hits the city!', 'environment', 'Play outdoor gigs', '{"fame": 50, "cash": -100}', 'Great turnout despite the heat!', 'Stay indoors', '{"energy": 15}', 'You stay cool and well-rested.', true, 'summer'),
('Summer Anthem', 'Your latest track is catching the summer playlist wave!', 'opportunity', 'Promote it hard', '{"fame": 75, "cash": -200}', 'Streams surge! It becomes a summer hit.', 'Let it grow organically', '{"fame": 30}', 'Steady growth without the spend.', true, 'summer'),
('Beach Party Gig', 'A beach party promoter wants a sunset set.', 'opportunity', 'Accept', '{"cash": 400, "fame": 25}', 'Perfect vibes and good pay!', 'Decline', '{}', 'You pass on this one.', true, 'summer'),
('Tour Bus Breakdown', 'The tour bus has broken down on the motorway.', 'financial', 'Pay for repairs', '{"cash": -500}', 'Back on the road after expensive repairs.', 'Hitch a ride', '{"health": -10, "fame": -20}', 'You arrive late and disheveled.', true, 'summer'),

-- Autumn
('Back to School', 'University courses are offering autumn discounts.', 'opportunity', 'Enrol in a course', '{"cash": -100, "skill_boost": 3}', 'You learn valuable new techniques.', 'Skip it', '{}', 'You focus on performing instead.', true, 'autumn'),
('Halloween Special', 'A horror-themed venue wants you for Halloween!', 'opportunity', 'Accept', '{"fame": 80, "cash": 350}', 'The crowd goes wild for your spooky set!', 'Decline', '{}', 'Not your scene.', true, 'autumn'),
('Award Season Buzz', 'Rumours swirl about award nominations for you!', 'personal', 'Campaign for it', '{"fame": 80, "cash": -150}', 'The buzz pays off with great exposure!', 'Stay humble', '{"fame": 30}', 'You let the music speak for itself.', true, 'autumn'),
('Rainy Day Blues', 'Autumn rain has you feeling melancholy.', 'personal', 'Channel it into songwriting', '{"skill_boost": 5}', 'You write a hauntingly beautiful song.', 'Take the day off', '{"health": 10}', 'A quiet day does you good.', true, 'autumn');
