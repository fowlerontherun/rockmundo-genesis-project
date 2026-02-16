
-- Add comprehensive tutorial steps covering all key game systems
-- Current steps go up to order_index 8, starting from 9

INSERT INTO tutorial_steps (step_key, title, description, target_route, order_index, category, is_active) VALUES
-- Education & Skills
('visit_education', 'Level Up Your Skills', 'Visit the Education hub to find university courses, books, mentors, and videos to improve your abilities.', '/education', 9, 'skills', true),
('visit_skill_tree', 'Explore Your Skill Tree', 'Check out your full skill tree to see all available skills from instruments to business acumen.', '/skill-tree', 10, 'skills', true),

-- Equipment & Commerce
('visit_equipment', 'Get Better Gear', 'Browse the Equipment Shop to upgrade your instruments and accessories. Better gear means better performances!', '/equipment', 11, 'commerce', true),
('visit_merch', 'Set Up Merchandise', 'Design and sell band merchandise to earn extra income, especially during gigs and tours.', '/merch', 12, 'commerce', true),

-- Performance expansion
('visit_busking', 'Try Busking', 'Head out to the streets for a quick busking session. No booking needed — earn tips and practice your performance skills!', '/busking', 13, 'performance', true),
('visit_tours', 'Plan a Tour', 'Ready for the big time? Plan a multi-city tour to build fanbases across different regions.', '/tours', 14, 'performance', true),

-- Music Industry
('visit_charts', 'Check the Charts', 'See where your music ranks! Chart positions drive streaming discovery and unlock bigger opportunities.', '/charts', 15, 'music', true),
('visit_radio', 'Get on the Radio', 'Submit your tracks to radio stations for airplay. Radio exposure boosts fame and streams.', '/radio', 16, 'music', true),
('visit_labels', 'Explore Record Labels', 'Submit demos to labels for contract offers, or start your own label empire!', '/labels', 17, 'business', true),

-- World & Travel
('visit_travel', 'Travel the World', 'Travel to new cities to discover venues, studios, jobs, and fanbases. 180+ cities await!', '/travel', 18, 'world', true),
('visit_world_map', 'Explore the World Map', 'Check the interactive world map to see cities, your fanbase spread, and plan your next destination.', '/world-map', 19, 'world', true),

-- Social & Media
('visit_dikcok', 'Create a DikCok Video', 'Make viral short videos to grow your fanbase. Cross-promote with Twaater for maximum reach!', '/dikcok', 20, 'social', true),
('visit_gettit', 'Join the Gettit Community', 'Connect with other players on Gettit — the in-game Reddit-style community forum.', '/gettit', 21, 'social', true),

-- Career & Business
('visit_pr', 'Manage Your PR', 'Handle press, interviews, and public relations to boost your public image and fame.', '/pr', 22, 'business', true),
('visit_employment', 'Find a Day Job', 'Need steady income? Browse 1,700+ jobs across all cities while building your music career.', '/employment', 23, 'business', true),
('visit_schedule', 'Check Your Schedule', 'Keep track of all your upcoming gigs, classes, rehearsals, and work shifts in one place.', '/schedule', 24, 'getting_started', true),

-- Lifestyle
('visit_achievements', 'Track Achievements', 'See what achievements you can unlock! Milestones grant cash, fame, and rare items.', '/achievements', 25, 'lifestyle', true),
('visit_underworld', 'Discover the Underworld', 'Explore the shady side of the music industry for rare consumable items and boosts.', '/underworld', 26, 'lifestyle', true);
