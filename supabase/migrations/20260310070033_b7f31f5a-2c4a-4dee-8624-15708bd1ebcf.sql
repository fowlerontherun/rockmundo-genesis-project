INSERT INTO achievements (name, description, icon, category, rarity, requirements, rewards) VALUES
-- SOCIAL
('Twaater Debut', 'Post your first twaat', '📱', 'social', 'common', '{"twaats_posted": 1}', '{"experience": 50, "fame": 10}'),
('Viral Sensation', 'Get a twaat with 500+ likes', '🔥', 'social', 'epic', '{"twaat_likes": 500}', '{"fame": 500, "cash": 5000}'),
('Influencer', 'Reach 1,000 Twaater followers', '👥', 'social', 'rare', '{"twaater_followers": 1000}', '{"fame": 200, "cash": 2000}'),
('Social Butterfly', 'Post 50 twaats', '🦋', 'social', 'rare', '{"twaats_posted": 50}', '{"experience": 300, "fame": 100}'),
('Mega Influencer', 'Reach 10,000 Twaater followers', '⭐', 'social', 'legendary', '{"twaater_followers": 10000}', '{"fame": 1000, "cash": 10000}'),
('DikCok Debut', 'Create your first DikCok video', '🎬', 'social', 'common', '{"dikcok_videos": 1}', '{"experience": 50, "fame": 15}'),
('Content Creator', 'Create 10 DikCok videos', '📹', 'social', 'rare', '{"dikcok_videos": 10}', '{"fame": 200, "cash": 3000}'),
('DikCok Star', 'Get 10,000 total DikCok views', '🌟', 'social', 'epic', '{"dikcok_views": 10000}', '{"fame": 500, "cash": 8000}'),
('Press Pass', 'Complete your first media interview', '📰', 'social', 'common', '{"media_interviews": 1}', '{"experience": 75, "fame": 30}'),
('Media Darling', 'Get featured in 10 media outlets', '📺', 'social', 'epic', '{"media_features": 10}', '{"fame": 500, "cash": 5000}'),
('Cover Star', 'Land a magazine cover story', '📖', 'social', 'rare', '{"magazine_covers": 1}', '{"fame": 300, "cash": 3000}'),
-- PERFORMANCE
('First Gig', 'Play your first live show', '🎸', 'performance', 'common', '{"gigs_played": 1}', '{"experience": 100, "fame": 25}'),
('Road Warrior', 'Play 25 gigs', '🚐', 'performance', 'rare', '{"gigs_played": 25}', '{"fame": 300, "cash": 5000}'),
('World Tour', 'Play gigs in 10 different countries', '🌍', 'performance', 'legendary', '{"countries_played": 10}', '{"fame": 2000, "cash": 50000}'),
('Festival Headliner', 'Headline a festival', '🎪', 'performance', 'epic', '{"festival_headline": 1}', '{"fame": 1000, "cash": 15000}'),
('Crowd Pleaser', 'Get a 90%+ satisfaction rating at a gig', '🎉', 'performance', 'rare', '{"gig_satisfaction": 90}', '{"fame": 150, "cash": 2000}'),
('Award Winner', 'Win your first award', '🏆', 'performance', 'epic', '{"awards_won": 1}', '{"fame": 500, "cash": 10000}'),
('Red Carpet Regular', 'Attend 5 award ceremonies', '👔', 'performance', 'rare', '{"ceremonies_attended": 5}', '{"fame": 300, "cash": 3000}'),
-- CREATIVE
('First Release', 'Release your first single or album', '💿', 'creative', 'common', '{"releases": 1}', '{"experience": 100, "fame": 50}'),
('Album Artist', 'Release an album', '📀', 'creative', 'rare', '{"albums_released": 1}', '{"fame": 300, "cash": 5000}'),
('Hit Machine', 'Release 10 singles', '🎵', 'creative', 'rare', '{"singles_released": 10}', '{"fame": 400, "cash": 5000}'),
('Platinum Record', 'Sell 100,000 copies of a single release', '💎', 'creative', 'legendary', '{"single_release_sales": 100000}', '{"fame": 5000, "cash": 100000}'),
('Hype Builder', 'Get a release to 500+ hype score', '📈', 'creative', 'epic', '{"release_hype": 500}', '{"fame": 500, "cash": 8000}'),
-- FINANCIAL
('First Paycheck', 'Earn your first $100', '💵', 'financial', 'common', '{"total_earned": 100}', '{"experience": 50}'),
('Money Maker', 'Earn $100,000 total', '💰', 'financial', 'epic', '{"total_earned": 100000}', '{"fame": 300}'),
('Record Deal', 'Sign your first label contract', '📝', 'financial', 'rare', '{"label_contracts": 1}', '{"fame": 200, "cash": 5000}');