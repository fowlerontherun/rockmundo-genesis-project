-- Seed Twaater Outcome Catalog with 50 variants

-- Engagement Outcomes (8)
INSERT INTO twaater_outcome_catalog (code, outcome_group, weight_base, description_template, effects) VALUES
('E1', 'engagement', 1.0, 'Micro-lift: Your post gained {delta_likes}% more likes than expected', '{"likes_mult": 1.08}'::jsonb),
('E2', 'engagement', 0.9, 'Reply chain started! {delta_replies} fans joined the conversation', '{"replies_add": 2}'::jsonb),
('E3', 'engagement', 0.85, 'Retwaat ripple: {delta_retwaats} influential accounts shared your post', '{"retwaats_add": 2}'::jsonb),
('E4', 'engagement', 1.1, 'Hashtag discovery: Your post reached {delta_impressions}% more feeds', '{"impressions_mult": 1.12}'::jsonb),
('E5', 'engagement', 0.7, 'Fan Q&A thread opened in {city} - engagement spiking', '{"replies_add": 3, "clicks_add": 5}'::jsonb),
('E6', 'engagement', 0.6, '{venue} liked your post! Venue relationship +5', '{"likes_add": 1, "venue_rel": 5}'::jsonb),
('E7', 'engagement', 0.8, 'Added to {city} scene list - local discovery boost', '{"impressions_mult": 1.15, "clicks_add": 3}'::jsonb),
('E8', 'engagement', 0.5, 'Late-night slow burn - impressions phasing through night owls', '{"impressions_mult": 1.1, "delayed": true}'::jsonb);

-- Growth Outcomes (8)
INSERT INTO twaater_outcome_catalog (code, outcome_group, weight_base, description_template, effects) VALUES
('G1', 'growth', 1.2, 'Follower boost: +{delta_followers} new followers', '{"followers_pct": 0.5}'::jsonb),
('G2', 'growth', 0.8, '{count} micro-influencers followed you back', '{"followers_add": 2, "influencer": true}'::jsonb),
('G3', 'growth', 0.9, 'Sticky retention: Followers are 5% more engaged for 7 days', '{"retention_boost": 5, "duration_days": 7}'::jsonb),
('G4', 'growth', 1.0, 'Local scene adoption in {city}: +{delta_followers} city-based fans', '{"followers_pct": 0.4, "city_weighted": true}'::jsonb),
('G5', 'growth', 0.6, '"For You" trial surfacing - algorithmic test boost', '{"impressions_mult": 1.2, "trial": true}'::jsonb),
('G6', 'growth', 0.7, 'Dormant fans re-engaged: {count} inactive followers returned', '{"followers_reactive": 3}'::jsonb),
('G7', 'growth', 0.5, 'Cross-band followback chain initiated with {band}', '{"followers_add": 1, "followback": true}'::jsonb),
('G8', 'growth', 0.4, 'Fan club sign-ups trickling in from {city}', '{"followers_add": 2, "superfans": true}'::jsonb);

-- Commerce/RSVP Outcomes (8)
INSERT INTO twaater_outcome_catalog (code, outcome_group, weight_base, description_template, effects) VALUES
('C1', 'commerce', 1.0, '+{delta_rsvps} gig RSVPs from your post', '{"rsvps_add": 2}'::jsonb),
('C2', 'commerce', 1.1, 'Stream bump: +{delta_streams}% streams in next 24h', '{"streams_pct": 1.0}'::jsonb),
('C3', 'commerce', 0.9, '+{delta_clicks} merch store clicks', '{"clicks_add": 2, "merch": true}'::jsonb),
('C4', 'commerce', 0.8, 'Ticket link CTR spiked +15% for 2 hours', '{"clicks_mult": 1.15, "duration_hours": 2}'::jsonb),
('C5', 'commerce', 0.7, 'Pre-save surge for {song}: +{count} saves', '{"sales_add": 3, "presave": true}'::jsonb),
('C6', 'commerce', 0.6, 'Bundle upsell working: {count} album+merch combos', '{"sales_add": 1, "bundle": true}'::jsonb),
('C7', 'commerce', 0.5, '{venue} guestlist requests flooding in', '{"rsvps_add": 3, "guestlist": true}'::jsonb),
('C8', 'commerce', 0.4, 'Street team volunteer offers from {city}', '{"followers_add": 1, "volunteer": true}'::jsonb);

-- Press/Review Outcomes (6)
INSERT INTO twaater_outcome_catalog (code, outcome_group, weight_base, description_template, effects) VALUES
('P1', 'press', 0.8, 'Local blogger {name} mentioned your post', '{"fame_add": 2, "impressions_mult": 1.1}'::jsonb),
('P2', 'press', 0.7, '{city} zine added you to "On Our Radar"', '{"fame_add": 5, "impressions_mult": 1.15}'::jsonb),
('P3', 'press', 0.6, 'Scene newsletter feature incoming from {publication}', '{"fame_add": 3, "followers_pct": 0.3}'::jsonb),
('P4', 'press', 0.5, '{station} college radio ping - airplay consideration', '{"fame_add": 4, "radio": true}'::jsonb),
('P5', 'press', 0.4, 'Playlist scout {name} liked your post', '{"fame_add": 2, "playlist_chance": 10}'::jsonb),
('P6', 'press', 0.2, 'National micro-blip: {publication} picked up your story', '{"fame_add": 15, "impressions_mult": 1.5}'::jsonb);

-- Collab/Network Outcomes (6)
INSERT INTO twaater_outcome_catalog (code, outcome_group, weight_base, description_template, effects) VALUES
('N1', 'collab', 0.9, '{band} replied to your post - potential synergy', '{"replies_add": 1, "collab_chance": 5}'::jsonb),
('N2', 'collab', 0.7, 'Producer {name} liked your sound', '{"fame_add": 2, "producer_interest": true}'::jsonb),
('N3', 'collab', 0.5, 'Support slot DM invite from {band} (check messages)', '{"gig_offer": true}'::jsonb),
('N4', 'collab', 0.6, 'Photographer {name} offering free shoot', '{"collab_chance": 10, "photographer": true}'::jsonb),
('N5', 'collab', 0.4, 'Collab jam interest from {musician} on {instrument}', '{"collab_chance": 8}'::jsonb),
('N6', 'collab', 0.3, '{festival} intern bookmarked your profile', '{"fame_add": 1, "festival_chance": 3}'::jsonb);

-- Backfire Outcomes (6)
INSERT INTO twaater_outcome_catalog (code, outcome_group, weight_base, description_template, effects) VALUES
('B1', 'backfire', 0.5, 'Price discourse: Fans debating if {price} is too high', '{"likes_mult": 0.8, "replies_add": 3, "negative": true}'::jsonb),
('B2', 'backfire', 0.6, '"All promo no soul" comments appearing', '{"sentiment": -1, "likes_mult": 0.85}'::jsonb),
('B3', 'backfire', 0.4, 'Off-topic rant - algorithm muted your reach', '{"impressions_mult": 0.7}'::jsonb),
('B4', 'backfire', 0.3, 'Minor call-out thread - apology template unlocked', '{"sentiment": -1, "replies_add": 2, "apology": true}'::jsonb),
('B5', 'backfire', 0.2, 'Rival fan base brigade in replies (temporary)', '{"replies_add": 5, "negative": true}'::jsonb),
('B6', 'backfire', 0.4, 'Algorithm cool-off: -15% reach for 24h', '{"impressions_mult": 0.85, "duration_hours": 24}'::jsonb);

-- Algo/Serendipity Outcomes (8)
INSERT INTO twaater_outcome_catalog (code, outcome_group, weight_base, description_template, effects) VALUES
('A1', 'algo', 0.7, 'Timing boost: Commute hour engagement spike', '{"impressions_mult": 1.2, "clicks_mult": 1.15}'::jsonb),
('A2', 'algo', 0.6, 'Night-owl cluster discovery - late engagement rising', '{"impressions_mult": 1.1, "delayed": true}'::jsonb),
('S1', 'serendipity', 0.5, 'Memeable line: Extra retwaats from {city} scene', '{"retwaats_add": 3, "meme": true}'::jsonb),
('S2', 'serendipity', 0.4, 'Fan art appeared! {artist} replied with sketch', '{"replies_add": 1, "fame_add": 2, "fanart": true}'::jsonb),
('S3', 'serendipity', 0.6, '{venue} reposted to their {follower_count} followers', '{"impressions_mult": 1.3, "venue_boost": true}'::jsonb),
('S4', 'serendipity', 0.3, 'Playlist curator {name} followed you', '{"followers_add": 1, "playlist_chance": 15}'::jsonb),
('S5', 'serendipity', 0.2, '{station} radio shoutout during drive time', '{"fame_add": 8, "impressions_mult": 1.4}'::jsonb),
('S6', 'serendipity', 0.1, 'Busking clip went viral in {city} - {views} views!', '{"fame_add": 12, "impressions_mult": 2.0, "viral": true}'::jsonb);