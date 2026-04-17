-- ============================================================
-- POLITICS SKILL BOOKS  (base_reading_days must be between 2 and 4)
-- ============================================================
INSERT INTO public.skill_books (skill_slug, title, author, description, price, base_reading_days, skill_percentage_gain, required_skill_level, daily_reading_time, reading_hour, category) VALUES
('basic_public_speaking','Talk Like TED','Carmine Gallo','Nine public-speaking secrets of the world''s top minds.',45,3,0.06,0,30,8,'Politics'),
('basic_public_speaking','The Quick and Easy Way to Effective Speaking','Dale Carnegie','Timeless rules for clarity, confidence, and connection on stage.',35,3,0.05,0,30,8,'Politics'),
('basic_public_speaking','Confessions of a Public Speaker','Scott Berkun','Practical lessons from a working speaker — what really works at the podium.',40,4,0.07,10,40,8,'Politics'),

('basic_governance','The Federalist Papers','Hamilton, Madison & Jay','The foundational essays on republican government and the separation of powers.',55,4,0.08,0,60,9,'Politics'),
('basic_governance','Why Nations Fail','Acemoglu & Robinson','Why some governments build prosperity and others collapse.',60,4,0.09,15,60,9,'Politics'),
('basic_governance','The Dictator''s Handbook','Bruce Bueno de Mesquita','How real political power is won, kept, and lost.',55,4,0.10,20,60,9,'Politics'),

('basic_negotiation','Getting to Yes','Roger Fisher & William Ury','The Harvard method for principled negotiation.',45,3,0.07,0,30,9,'Politics'),
('basic_negotiation','Never Split the Difference','Chris Voss','High-stakes negotiation tactics from a former FBI hostage negotiator.',50,4,0.08,10,40,9,'Politics'),
('basic_negotiation','Bargaining for Advantage','G. Richard Shell','Negotiation strategies for reasonable people.',55,4,0.09,20,40,9,'Politics'),

('professional_diplomacy','Diplomacy','Henry Kissinger','A sweeping study of statesmanship across three centuries.',75,4,0.10,30,90,10,'Politics'),
('professional_diplomacy','The Back Channel','William J. Burns','A career diplomat on the case for American diplomacy.',60,4,0.09,25,60,10,'Politics'),
('professional_diplomacy','Negotiating the Impossible','Deepak Malhotra','Breaking deadlocks and resolving ugly conflicts.',55,4,0.10,30,60,10,'Politics'),

('professional_campaign_strategy','The Victory Lab','Sasha Issenberg','The secret science of winning elections.',55,4,0.10,25,60,10,'Politics'),
('professional_campaign_strategy','Game Change','John Heilemann & Mark Halperin','Inside the modern presidential campaign.',45,4,0.08,20,60,10,'Politics'),
('professional_campaign_strategy','Rules for Radicals','Saul Alinsky','Practical rules for community organisers and political operators.',40,4,0.09,15,40,10,'Politics'),

('master_oratory','Lend Me Your Ears','William Safire','The greatest speeches in history, annotated.',75,4,0.10,40,90,10,'Politics'),
('master_oratory','We Shall Not Be Moved','Russell Freedman','Lessons in moral oratory from the civil rights era.',55,4,0.09,35,60,10,'Politics'),
('master_oratory','The Art of Public Speaking','Stephen E. Lucas','The standard university text on advanced public speaking.',85,4,0.12,50,90,10,'Politics'),

('master_statecraft','On China','Henry Kissinger','Statecraft, strategy, and the long view from one of its great practitioners.',85,4,0.11,45,90,11,'Politics'),
('master_statecraft','The Prince','Niccolò Machiavelli','The original handbook on the acquisition and use of political power.',35,4,0.10,40,45,11,'Politics'),
('master_statecraft','World Order','Henry Kissinger','How great powers build — and break — international systems.',75,4,0.12,55,90,11,'Politics');

-- ============================================================
-- POLITICS YOUTUBE VIDEOS
-- ============================================================
INSERT INTO public.education_youtube_resources (title, description, video_url, category, difficulty_level, duration_minutes, tags) VALUES
('Public Speaking for Beginners','Conquer stage fright and deliver a confident first speech.','https://youtube.com/watch?v=politics-ps-101','public_speaking',1,18,ARRAY['public speaking','beginner','politics']),
('How Great Leaders Inspire Action','Simon Sinek''s classic talk on the "Why" behind powerful speeches.','https://youtube.com/watch?v=politics-ps-why','public_speaking',2,22,ARRAY['public speaking','leadership','politics']),
('Body Language for Speakers','Use posture and gesture to command a room.','https://youtube.com/watch?v=politics-ps-body','public_speaking',2,15,ARRAY['public speaking','body language','politics']),

('How Government Works (Crash Course)','Branches, checks, and balances explained simply.','https://youtube.com/watch?v=politics-gov-101','governance',1,16,ARRAY['governance','beginner','politics']),
('Comparative Government Systems','Parliamentary vs presidential vs hybrid systems compared.','https://youtube.com/watch?v=politics-gov-comp','governance',2,24,ARRAY['governance','comparative','politics']),
('Local Politics Explained','How city councils, mayors, and budgets really operate.','https://youtube.com/watch?v=politics-gov-local','governance',1,20,ARRAY['governance','local','politics']),

('Harvard''s Negotiation Course in 30 Minutes','Principled negotiation distilled.','https://youtube.com/watch?v=politics-neg-harvard','negotiation',2,30,ARRAY['negotiation','politics']),
('Tactical Empathy with Chris Voss','FBI negotiation techniques you can use at the bargaining table.','https://youtube.com/watch?v=politics-neg-voss','negotiation',2,25,ARRAY['negotiation','politics']),

('How Modern Political Campaigns Are Won','Targeting, messaging, and field operations.','https://youtube.com/watch?v=politics-camp-modern','campaign_strategy',2,28,ARRAY['campaign','strategy','politics']),
('The Ground Game','Door-knocking, GOTV, and volunteer pyramids.','https://youtube.com/watch?v=politics-camp-ground','campaign_strategy',2,22,ARRAY['campaign','field','politics']),
('Political Advertising That Works','From TV spots to micro-targeted social ads.','https://youtube.com/watch?v=politics-camp-ads','campaign_strategy',3,26,ARRAY['campaign','ads','politics']),

('Diplomacy 101','How embassies, treaties, and back channels actually function.','https://youtube.com/watch?v=politics-dipl-101','diplomacy',2,24,ARRAY['diplomacy','politics']),
('Conflict Resolution Between Nations','Mediation lessons from real peace processes.','https://youtube.com/watch?v=politics-dipl-conflict','diplomacy',3,30,ARRAY['diplomacy','conflict','politics']),

('JFK''s Greatest Speeches Analysed','Rhythm, contrast, and emotion in presidential rhetoric.','https://youtube.com/watch?v=politics-orat-jfk','oratory',3,28,ARRAY['oratory','rhetoric','politics']),
('Churchill: The Power of Words','How wartime speeches changed history.','https://youtube.com/watch?v=politics-orat-churchill','oratory',3,32,ARRAY['oratory','history','politics']),

('Grand Strategy Explained','How great powers think across decades.','https://youtube.com/watch?v=politics-state-grand','statecraft',3,35,ARRAY['statecraft','strategy','politics']),
('The Art of Statecraft','Soft power, hard power, and everything between.','https://youtube.com/watch?v=politics-state-art','statecraft',3,30,ARRAY['statecraft','politics']);

-- ============================================================
-- POLITICS UNIVERSITY COURSES
-- ============================================================
INSERT INTO public.university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, class_start_hour, class_end_hour) VALUES
-- Cambridge University (London)
('e732c5e2-4eea-40a3-91c2-10ecb0f563ed','basic_public_speaking','Rhetoric & Oratory I','Foundations of persuasive public speaking in the Cambridge tradition.',1200,5,0,4,8,10,13),
('e732c5e2-4eea-40a3-91c2-10ecb0f563ed','basic_governance','Constitutional Government','Comparative constitutions, parliamentary procedure, and the rule of law.',1500,7,10,5,9,10,14),
('e732c5e2-4eea-40a3-91c2-10ecb0f563ed','basic_negotiation','Principled Negotiation','The Harvard-Cambridge method for high-stakes bargaining.',1400,6,0,4,8,10,13),
('e732c5e2-4eea-40a3-91c2-10ecb0f563ed','professional_diplomacy','International Diplomacy','Treaty-craft, multilateralism, and the modern diplomatic service.',2200,9,30,6,10,10,14),
('e732c5e2-4eea-40a3-91c2-10ecb0f563ed','professional_campaign_strategy','Election Campaign Management','Strategy, messaging, and field operations for modern campaigns.',1800,7,20,5,9,10,14),
('e732c5e2-4eea-40a3-91c2-10ecb0f563ed','master_oratory','Advanced Oratory','Master class on movement-defining speech.',2500,10,40,7,12,10,14),
('e732c5e2-4eea-40a3-91c2-10ecb0f563ed','master_statecraft','Grand Strategy & Statecraft','Long-horizon thinking for those who would lead nations.',2800,10,50,8,13,10,14),

-- Manchester University
('7a2a6433-3604-4aeb-bbec-1295d8c3a128','basic_public_speaking','Speaking on the Stump','Practical campaign speaking for first-time candidates.',700,4,0,3,6,11,14),
('7a2a6433-3604-4aeb-bbec-1295d8c3a128','basic_governance','Local Government in Practice','How councils, committees, and budgets actually work.',850,5,0,3,7,11,14),
('7a2a6433-3604-4aeb-bbec-1295d8c3a128','basic_negotiation','Negotiation for Council','Settling disputes and brokering deals at the local level.',800,4,0,3,6,11,14),
('7a2a6433-3604-4aeb-bbec-1295d8c3a128','professional_campaign_strategy','Grassroots Campaigning','Door-to-door, ground game, and volunteer leadership.',1100,6,15,4,8,11,14),

-- Chicago Conservatory of Arts
('0b98bca8-b0cf-488a-a0dc-06c8f1734881','basic_public_speaking','American Political Speech','From the State of the Union to the stump speech.',1100,5,0,4,8,10,14),
('0b98bca8-b0cf-488a-a0dc-06c8f1734881','basic_governance','American Government','Federalism, checks and balances, and the modern presidency.',1300,6,5,4,8,10,14),
('0b98bca8-b0cf-488a-a0dc-06c8f1734881','professional_campaign_strategy','Modern Campaign Operations','Data, targeting, and message discipline in U.S. campaigns.',1700,7,20,5,9,10,14),
('0b98bca8-b0cf-488a-a0dc-06c8f1734881','professional_diplomacy','U.S. Foreign Service Track','Preparing for a career in American diplomacy.',2100,9,30,6,10,10,14),
('0b98bca8-b0cf-488a-a0dc-06c8f1734881','master_oratory','Presidential Oratory','Studying and crafting speech worthy of the Oval.',2400,10,40,7,12,10,14),

-- London Conservatory of Arts
('3330cd55-2305-476e-bb8a-60bbd08fbc60','basic_negotiation','The Whitehall Bargain','Negotiation inside the British political machine.',1000,5,0,3,7,10,13),
('3330cd55-2305-476e-bb8a-60bbd08fbc60','professional_diplomacy','Foreign Office Foundations','First steps toward a diplomatic career.',1600,7,25,5,9,10,14);

-- ============================================================
-- POLITICS MENTORS — UK & USA
-- ============================================================
INSERT INTO public.education_mentors
  (name, focus_skill, description, specialty, cost, cooldown_hours, base_xp, difficulty,
   attribute_keys, required_skill_value, skill_gain_ratio, bonus_description,
   city_id, available_day, lore_biography, lore_achievement, discovery_hint, discovery_type)
VALUES
-- ============== UNITED KINGDOM ==============
('Dame Eleanor Whitcombe','basic_public_speaking',
 'Westminster speech coach to three Prime Ministers.',
 'Confidence and clarity at the despatch box',
 18000, 24, 160, 'beginner',
 '["charisma","discipline"]'::jsonb, 0, 0.18,
 'Despatch-box confidence',
 '9f26ad86-51ed-4477-856d-610f14979310', 1,
 'A retired Westminster speech coach who turned three nervous backbenchers into Prime Ministers. She still holds private sessions in a quiet Pimlico townhouse.',
 'Coached three sitting Prime Ministers through their first PMQs.',
 'Tuesdays in London, ask after the coach who whispers from the gallery.',
 'exploration'),

('Sir Reginald Hawthorne','master_statecraft',
 'Former Cabinet Secretary turned mentor on grand strategy.',
 'Long-horizon political thinking',
 32000, 48, 260, 'advanced',
 '["intellect","discipline"]'::jsonb, 40, 0.22,
 'Whitehall strategic thinking',
 '9f26ad86-51ed-4477-856d-610f14979310', 3,
 'Once the most powerful unelected man in Britain. Ran the Civil Service through two crises and a referendum, and now teaches the few who can keep up.',
 'Drafted the strategic doctrine that survived four governments.',
 'Thursdays in London, the mandarins still know where he takes tea.',
 'exploration'),

('Maggie O''Donnell','professional_campaign_strategy',
 'Northern campaign organiser who flipped seats nobody thought could move.',
 'Grassroots ground game',
 22000, 24, 200, 'intermediate',
 '["charisma","stamina"]'::jsonb, 15, 0.20,
 'Door-to-door turnout uplift',
 '8bb73a75-bd57-49b3-9a03-a68f37a19f56', 5,
 'Built her reputation flipping marginal Northern seats by knocking on every single door. Her phonebank scripts are passed around like sacred texts.',
 'Won 11 marginal constituencies with double-digit swings.',
 'Saturdays in Manchester, follow the leaflets to the loudest committee room.',
 'exploration'),

('Harold Pemberton','basic_negotiation',
 'Veteran trade-union negotiator and parliamentary fixer.',
 'Coalition deal-making',
 15000, 24, 150, 'beginner',
 '["intellect","charisma"]'::jsonb, 0, 0.16,
 'Settling impossible disputes',
 '8bb73a75-bd57-49b3-9a03-a68f37a19f56', 2,
 'Spent thirty years brokering deals between unions and government. Every minister of either party has at some point quietly asked for his help.',
 'Settled the 1998 dock strike in a single weekend.',
 'Wednesdays in Manchester, the back room of the old Labour club.',
 'exploration'),

('Professor Iain MacLeod','basic_governance',
 'Constitutional scholar and former adviser to the Scottish Parliament.',
 'Comparative constitutional design',
 17000, 24, 180, 'intermediate',
 '["intellect","discipline"]'::jsonb, 10, 0.18,
 'Constitutional procedure mastery',
 'f082fb21-717b-4abb-af6e-8cb5556dd072', 4,
 'A Scottish constitutional scholar whose textbook is required reading in every law faculty north of the border. Quietly drafted half of devolution.',
 'Co-authored the Scotland Act 1998.',
 'Fridays in Edinburgh, the Old Town pubs near the Parliament.',
 'exploration'),

('Ambassador Ravi Chakraborty','professional_diplomacy',
 'Former British Ambassador to the United States and to the UN.',
 'Multilateral diplomacy',
 28000, 48, 240, 'advanced',
 '["charisma","intellect"]'::jsonb, 30, 0.20,
 'Treaty-craft and back-channel etiquette',
 '9f26ad86-51ed-4477-856d-610f14979310', 0,
 'Britain''s top diplomat for two decades. Negotiated peace agreements on three continents and is rumoured to have prevented two wars no one ever heard about.',
 'Lead negotiator on three landmark UN treaties.',
 'Sundays in London, ask at the right gentleman''s club in St James''s.',
 'exploration'),

-- ============== UNITED STATES ==============
('Marcus "Money" Holloway','professional_campaign_strategy',
 'Beltway campaign architect who has run senate races in 22 states.',
 'Modern data-driven campaigning',
 26000, 24, 230, 'advanced',
 '["intellect","charisma"]'::jsonb, 20, 0.22,
 'Microtargeting and message discipline',
 '11001f1b-fc01-4ad4-b8e4-96ec86a1a70c', 3,
 'A legendary Beltway operator. If a senator is in trouble, Marcus is the first call. He has run more winning races than anyone of his generation.',
 'Managed 14 winning Senate campaigns across both parties.',
 'Thursdays in Washington DC, the steakhouses near K Street.',
 'exploration'),

('Dr. Helena Voss','master_statecraft',
 'Former National Security Advisor turned mentor.',
 'Grand strategy and national security',
 35000, 48, 280, 'advanced',
 '["intellect","discipline"]'::jsonb, 50, 0.24,
 'National-security strategic thinking',
 '11001f1b-fc01-4ad4-b8e4-96ec86a1a70c', 5,
 'Served two Presidents at the National Security Council. Quietly steered American grand strategy through a decade most people would rather forget.',
 'Architect of the doctrine that defines current U.S. foreign policy.',
 'Saturdays in Washington DC, lectures occasionally at Georgetown.',
 'exploration'),

('Nathan "Nate" Goldstein','basic_negotiation',
 'Wall Street dealmaker turned political negotiation coach.',
 'High-stakes bargaining',
 20000, 24, 190, 'intermediate',
 '["intellect","charisma"]'::jsonb, 10, 0.20,
 'Reading the room and closing the deal',
 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 2,
 'Closed billion-dollar mergers before pivoting to coaching mayors and senators. He says politics is just M&A with worse coffee.',
 'Closed a $40B merger and a city budget deadlock in the same month.',
 'Tuesdays in New York, a corner booth at a Midtown bar.',
 'exploration'),

('Vivian Carter','basic_public_speaking',
 'Broadway-trained voice coach to mayors, senators, and at least one President.',
 'Stage presence and vocal projection',
 19000, 24, 170, 'beginner',
 '["charisma","discipline"]'::jsonb, 0, 0.18,
 'Voice projection and audience command',
 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 1,
 'A Broadway voice coach who discovered that politicians needed her even more than actors. Her studio in the West Village is by referral only.',
 'Coached the most-quoted convention speech of the last decade.',
 'Mondays in New York, look for the green door in the West Village.',
 'exploration'),

('Alderman Ruth Maddox','basic_governance',
 'Five-term Chicago alderman with deep machine experience.',
 'Big-city governance and coalition-building',
 16000, 24, 170, 'intermediate',
 '["intellect","stamina"]'::jsonb, 5, 0.18,
 'Urban governance and political machines',
 '29809134-e947-408b-9786-6d7b51181548', 4,
 'Five terms on the Chicago city council and never once lost a vote she actually cared about. She knows where every body in city hall is buried, and which ones still vote.',
 'Passed the city''s landmark housing reform after seven years of trying.',
 'Fridays in Chicago, ward office on the South Side, doors open Friday afternoons.',
 'exploration'),

('Tony "The Machine" Rinaldi','professional_campaign_strategy',
 'Old-school Chicago political operator.',
 'Big-city machine politics',
 23000, 24, 210, 'intermediate',
 '["charisma","stamina"]'::jsonb, 15, 0.20,
 'Turning out the base when it matters',
 '29809134-e947-408b-9786-6d7b51181548', 6,
 'Inherited the family operation in the 1990s and modernised it without losing a single ward. Mayors come and go; Tony stays.',
 'Delivered Chicago for every winning mayoral candidate since 1995.',
 'Sundays in Chicago, the family restaurant in Bridgeport.',
 'exploration'),

('Reverend James Whitfield','master_oratory',
 'Civil rights veteran and master of the moral speech.',
 'Movement-building oratory',
 30000, 48, 270, 'advanced',
 '["charisma","intellect"]'::jsonb, 35, 0.22,
 'Cadence, conviction, and crowd movement',
 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a', 0,
 'Marched in the 1960s, preached through the 1980s, and now teaches a small handful of students at a time the cadence of speech that moves people to act.',
 'His sermon at the 1992 reconciliation rally is studied in three countries.',
 'Sundays in Los Angeles, the church on Crenshaw, after the second service.',
 'exploration'),

('Ambassador Theodore Whitman','professional_diplomacy',
 'Career Foreign Service officer with postings on six continents.',
 'Bilateral diplomacy and crisis management',
 28000, 48, 240, 'advanced',
 '["charisma","intellect"]'::jsonb, 30, 0.20,
 'Crisis-room diplomacy',
 '11001f1b-fc01-4ad4-b8e4-96ec86a1a70c', 1,
 'Forty years in the Foreign Service. Reportedly talked an entire region back from the brink of war over a single dinner.',
 'Lead negotiator on the Treaty of Algiers (II).',
 'Tuesdays in Washington DC, lunches at the Cosmos Club.',
 'exploration');