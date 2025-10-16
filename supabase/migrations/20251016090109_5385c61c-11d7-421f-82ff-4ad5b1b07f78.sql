-- Seed 100+ Production Notes

-- PYROTECHNICS & FIRE (15 notes)
INSERT INTO setlist_production_notes (name, description, category, impact_type, impact_value, required_fame, required_venue_prestige, cost_per_use, rarity) VALUES
('Stadium Pyro Burst', 'Massive coordinated pyro effects synced to crescendos', 'pyro', 'attendance', 1.25, 2000, 4, 3000, 'rare'),
('Flame Curtain Descent', 'Controlled flame walls for dramatic moments', 'pyro', 'performance', 1.20, 1500, 3, 2000, 'rare'),
('Confetti Cannon Finale', 'Colorful confetti explosion for show ending', 'pyro', 'performance', 1.10, 500, 2, 200, 'common'),
('Sparkler Wall', 'Safe sparkler effects around stage perimeter', 'pyro', 'performance', 1.08, 300, 1, 100, 'common'),
('CO2 Jet Blasts', 'High-pressure CO2 jets for impact moments', 'pyro', 'performance', 1.15, 1000, 3, 800, 'uncommon'),
('Indoor Firework Display', 'Safe indoor pyrotechnics for arena shows', 'pyro', 'attendance', 1.18, 1800, 4, 2500, 'rare'),
('Streamer Cannons', 'Colorful paper streamers shot into crowd', 'pyro', 'performance', 1.06, 200, 0, 80, 'common'),
('Smoke Rings', 'Perfectly timed smoke ring effects', 'pyro', 'performance', 1.07, 400, 1, 150, 'common'),
('Fire Breathing Act', 'Professional fire breather guest performance', 'pyro', 'fame', 1.30, 2500, 4, 4000, 'legendary'),
('Roman Candle Finale', 'Classic firework finale for outdoor venues', 'pyro', 'attendance', 1.15, 1200, 2, 1000, 'uncommon'),
('Flame Thrower Solo', 'Guitarist plays with flame effects', 'pyro', 'performance', 1.22, 1600, 3, 1800, 'rare'),
('Sparkling Fountain Stage', 'Continuous sparkling fountains stage front', 'pyro', 'performance', 1.12, 800, 2, 600, 'uncommon'),
('Flash Pods', 'Bright flash effects for photo moments', 'pyro', 'fame', 1.10, 600, 1, 300, 'uncommon'),
('Gerb Flames', 'Vertical flame jets synchronized to drums', 'pyro', 'performance', 1.14, 1100, 3, 900, 'uncommon'),
('Flame Curtain Rainbow', 'Multi-colored flame wall effect', 'pyro', 'attendance', 1.16, 1400, 3, 1500, 'rare');

-- LIGHTING DESIGN (20 notes)
INSERT INTO setlist_production_notes (name, description, category, impact_type, impact_value, required_skill_slug, required_skill_value, cost_per_use, rarity) VALUES
('Laser Grid Choreography', 'Complex laser patterns synced to music', 'lighting', 'performance', 1.15, 'performance_advanced_stage_presence', 60, 1200, 'uncommon'),
('LED Wall Reactive Visuals', 'Dynamic LED backdrop responding to sound', 'lighting', 'performance', 1.12, 'performance_basic_stage_presence', 50, 800, 'uncommon'),
('Spotlight Fan Dedication', 'Individual fan spotlight moments', 'lighting', 'fame', 1.08, null, null, 100, 'common'),
('Color Chase Wristbands', 'Audience wristbands sync to light show', 'lighting', 'attendance', 1.10, null, null, 500, 'uncommon'),
('Strobe Pulse Synchronization', 'Precision strobe effects for drops', 'lighting', 'performance', 1.09, 'performance_basic_stage_presence', 40, 200, 'common'),
('Followspot Precision Track', 'Professional spotlight operator follows artists', 'lighting', 'performance', 1.07, null, null, 300, 'common'),
('Moving Head Sweep', 'Automated moving lights create dynamic patterns', 'lighting', 'performance', 1.11, 'performance_advanced_stage_presence', 55, 700, 'uncommon'),
('UV Blacklight Sections', 'Ultraviolet lighting for specific songs', 'lighting', 'performance', 1.06, null, null, 150, 'common'),
('Chandelier Drop Reveal', 'Dramatic chandelier lowering with lights', 'lighting', 'attendance', 1.20, null, null, 2000, 'rare'),
('Pixel Mapping Stage Floor', 'LED floor that reacts to movement', 'lighting', 'performance', 1.18, 'performance_advanced_stage_presence', 70, 2500, 'rare'),
('Aurora Borealis Effect', 'Northern lights simulation across venue', 'lighting', 'attendance', 1.13, null, null, 1000, 'uncommon'),
('Starfield Ceiling', 'Thousands of small lights create starry sky', 'lighting', 'performance', 1.10, null, null, 600, 'uncommon'),
('Gobo Pattern Projections', 'Custom pattern projections on stage', 'lighting', 'performance', 1.08, null, null, 250, 'common'),
('RGB Color Wash', 'Full venue color wash changes', 'lighting', 'performance', 1.05, null, null, 100, 'common'),
('Pin Spot Instruments', 'Individual instrument highlighting', 'lighting', 'performance', 1.06, null, null, 120, 'common'),
('Infinity Mirror Effect', 'Creates illusion of endless depth', 'lighting', 'performance', 1.17, 'performance_advanced_stage_presence', 65, 1800, 'rare'),
('Silhouette Shadow Play', 'Backlit shadow effects for dramatic songs', 'lighting', 'performance', 1.09, null, null, 200, 'common'),
('Neon Tube Sculptures', 'Custom neon art installations on stage', 'lighting', 'attendance', 1.14, null, null, 1200, 'uncommon'),
('Prism Light Refraction', 'Creates rainbow effects through prisms', 'lighting', 'performance', 1.08, null, null, 300, 'common'),
('Moonlight Simulation', 'Soft moonlight effect for ballads', 'lighting', 'performance', 1.07, null, null, 150, 'common');

-- CROWD INTERACTION (18 notes)
INSERT INTO setlist_production_notes (name, description, category, impact_type, impact_value, required_fame, required_skill_slug, cost_per_use, rarity) VALUES
('Interactive Wave Trigger', 'Crowd creates wave effects tracked by cameras', 'crowd_interaction', 'attendance', 1.12, 700, 'performance_basic_stage_presence', 400, 'uncommon'),
('Crowd Sing-Along Moment', 'Planned audience participation segment', 'crowd_interaction', 'fame', 1.12, 300, null, 0, 'common'),
('B-Stage Bridge Walk', 'Walk through crowd to secondary stage', 'crowd_interaction', 'attendance', 1.15, 1000, 'performance_advanced_stage_presence', 800, 'uncommon'),
('Fan Brings Friend On Stage', 'Surprise fan guest appearance', 'crowd_interaction', 'fame', 1.20, 500, 'performance_basic_stage_presence', 0, 'uncommon'),
('Crowd Surfing Sanctioned Zone', 'Safe designated area for crowd surfing', 'crowd_interaction', 'attendance', 1.10, 800, null, 200, 'uncommon'),
('Phone Flashlight Sea', 'Audience lights create atmosphere', 'crowd_interaction', 'performance', 1.05, 200, null, 0, 'common'),
('Call-and-Response Extended', 'Multiple call and response segments', 'crowd_interaction', 'performance', 1.08, null, 'performance_basic_stage_presence', 0, 'common'),
('Audience Choice Setlist', 'Fans vote on next song in real-time', 'crowd_interaction', 'fame', 1.18, 1500, 'performance_advanced_stage_presence', 500, 'rare'),
('Mosh Pit Coordination', 'Organized mosh pit with safety crew', 'crowd_interaction', 'attendance', 1.13, 900, null, 300, 'uncommon'),
('Balloon Drop Audience', 'Thousands of balloons released to crowd', 'crowd_interaction', 'performance', 1.09, 600, null, 400, 'uncommon'),
('Crowd Circle Formation', 'Create circular opening in crowd for performance', 'crowd_interaction', 'attendance', 1.11, 700, 'performance_basic_stage_presence', 100, 'uncommon'),
('Audience Percussion Section', 'Distribute shakers for crowd participation', 'crowd_interaction', 'performance', 1.10, 400, null, 150, 'common'),
('Human Chain Link', 'Crowd creates connected chain across venue', 'crowd_interaction', 'attendance', 1.14, 1100, 'performance_advanced_stage_presence', 200, 'uncommon'),
('Stadium Wave Initiation', 'Start the wave in large venues', 'crowd_interaction', 'attendance', 1.16, 1800, null, 0, 'rare'),
('Glow Stick Distribution', 'Hand out glow sticks for night shows', 'crowd_interaction', 'performance', 1.07, 300, null, 250, 'common'),
('Acoustic Unplugged Circle', 'Intimate acoustic moment in crowd center', 'crowd_interaction', 'fame', 1.22, 1200, 'performance_advanced_stage_presence', 0, 'rare'),
('Crowd Clap Rhythm', 'Get entire venue clapping in rhythm', 'crowd_interaction', 'performance', 1.06, 100, null, 0, 'common'),
('Beach Ball Toss Chaos', 'Release beach balls into crowd during upbeat songs', 'crowd_interaction', 'performance', 1.08, 400, null, 100, 'common');

-- SPECIAL EFFECTS (15 notes)
INSERT INTO setlist_production_notes (name, description, category, impact_type, impact_value, required_fame, required_venue_prestige, cost_per_use, rarity) VALUES
('Augmented Reality Overlay', 'AR effects visible through phones', 'special_effects', 'fame', 1.25, 2500, 4, 5000, 'legendary'),
('Drone Swarm Choreography', 'Coordinated light-up drones flying above', 'special_effects', 'attendance', 1.30, 3000, 5, 8000, 'legendary'),
('Hologram Guest Appearance', 'Holographic duet with another artist', 'special_effects', 'fame', 1.35, 2000, 4, 6000, 'legendary'),
('Smoke Machine Atmosphere', 'Classic fog effects throughout venue', 'special_effects', 'performance', 1.05, 100, 0, 50, 'common'),
('Bubble Machine Magic', 'Continuous bubble effects for fun atmosphere', 'special_effects', 'performance', 1.06, 150, 0, 80, 'common'),
('Mirror Ball Classic', 'Traditional disco ball effect', 'special_effects', 'performance', 1.03, null, null, 20, 'common'),
('Falling Snow Effect', 'Artificial snow falling during winter songs', 'special_effects', 'performance', 1.12, 800, 2, 600, 'uncommon'),
('Fog Screen Projection', 'Project images onto fog screen', 'special_effects', 'performance', 1.14, 1000, 3, 1000, 'uncommon'),
('Levitating Platform', 'Motorized platform raises band members', 'special_effects', 'attendance', 1.20, 1600, 4, 3000, 'rare'),
('Water Curtain Display', 'Projections on falling water screens', 'special_effects', 'performance', 1.16, 1300, 3, 1500, 'rare'),
('Dry Ice Low Fog', 'Ground-level fog effect', 'special_effects', 'performance', 1.07, 200, 0, 100, 'common'),
('Fiber Optic Curtains', 'Light-up fiber optic backdrop', 'special_effects', 'performance', 1.11, 700, 2, 800, 'uncommon'),
('Plasma Ball Effects', 'Tesla coil style electricity effects', 'special_effects', 'performance', 1.18, 1400, 3, 2000, 'rare'),
('Kinetic Stage Elements', 'Moving stage pieces during performance', 'special_effects', 'attendance', 1.17, 1500, 4, 2500, 'rare'),
('Scent Distribution System', 'Pump specific scents during themed songs', 'special_effects', 'performance', 1.09, 600, 2, 400, 'uncommon');

-- VIDEO & PROJECTION (12 notes)
INSERT INTO setlist_production_notes (name, description, category, impact_type, impact_value, required_fame, required_skill_slug, cost_per_use, rarity) VALUES
('Live Social Feed Wall', 'Display live tweets and posts from audience', 'video', 'fame', 1.15, 1000, 'performance_basic_stage_presence', 700, 'uncommon'),
('Music Video Backdrop Sync', 'Play official videos behind performance', 'video', 'performance', 1.10, 600, null, 300, 'uncommon'),
('Fan Cam Montage Real-Time', 'Live editing of fan reactions', 'video', 'fame', 1.12, 800, null, 500, 'uncommon'),
('Animated Lyric Projection', 'Display animated lyrics for sing-along', 'video', 'performance', 1.08, 400, null, 200, 'common'),
('360° Stage Camera Spin', 'Rotating camera captures full performance', 'video', 'fame', 1.14, 1200, 'performance_advanced_stage_presence', 900, 'uncommon'),
('Cinematic Interlude Videos', 'Short films between song sections', 'video', 'performance', 1.13, 900, null, 600, 'uncommon'),
('Live Loop Pedal Visual', 'Visualize loop layers being built', 'video', 'performance', 1.09, 500, 'performance_basic_stage_presence', 250, 'common'),
('Album Art Animation', 'Animated album covers on screens', 'video', 'performance', 1.07, 300, null, 150, 'common'),
('Crowd Reaction Split Screen', 'Multiple crowd angles shown simultaneously', 'video', 'fame', 1.11, 700, null, 400, 'uncommon'),
('VJ Live Mixing', 'Professional VJ creates live visuals', 'video', 'performance', 1.16, 1400, 'performance_advanced_stage_presence', 1200, 'rare'),
('Projection Mapping Stage', 'Complex 3D projection mapping on stage elements', 'video', 'attendance', 1.22, 2000, 4, 3500, 'rare'),
('Retro CRT Screen Aesthetics', 'Vintage TV screens with retro visuals', 'video', 'performance', 1.08, 400, null, 200, 'common');