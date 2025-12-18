-- Seed prisons for major cities
INSERT INTO public.prisons (city_id, name, security_level, daily_cost, rehabilitation_rating, escape_difficulty, has_music_program, capacity)
SELECT 
  c.id,
  c.name || ' ' || 
  CASE 
    WHEN c.country IN ('USA', 'United States') THEN 'County Jail'
    WHEN c.country = 'UK' THEN 'Prison'
    WHEN c.country = 'Germany' THEN 'Justizvollzugsanstalt'
    WHEN c.country = 'France' THEN 'Maison d''Arrêt'
    WHEN c.country = 'Japan' THEN 'Detention Center'
    ELSE 'Correctional Facility'
  END,
  CASE 
    WHEN c.population > 5000000 THEN 'maximum'
    WHEN c.population > 1000000 THEN 'medium'
    ELSE 'minimum'
  END,
  CASE 
    WHEN c.country = 'UK' THEN 0  -- Free healthcare
    WHEN c.country IN ('Germany', 'France', 'Sweden', 'Norway') THEN 25
    ELSE 50
  END,
  CASE 
    WHEN c.country IN ('Sweden', 'Norway', 'Germany') THEN 85
    WHEN c.country = 'UK' THEN 70
    WHEN c.country IN ('USA', 'United States') THEN 45
    ELSE 60
  END,
  CASE 
    WHEN c.population > 5000000 THEN 95
    WHEN c.population > 1000000 THEN 85
    ELSE 75
  END,
  c.country IN ('Sweden', 'Norway', 'Germany', 'UK'),  -- Music programs in progressive countries
  CASE 
    WHEN c.population > 5000000 THEN 2000
    WHEN c.population > 1000000 THEN 1000
    ELSE 500
  END
FROM cities c
WHERE c.population IS NOT NULL
ON CONFLICT DO NOTHING;

-- Seed prison events (50+ events across categories)

-- OPPORTUNITY EVENTS
INSERT INTO public.prison_events (title, description, category, is_common, behavior_min, option_a_text, option_a_effects, option_b_text, option_b_effects) VALUES
('Famous Musician Cellmate', 'A legendary musician who fell from grace is your new cellmate. They offer to teach you some of their techniques.', 'opportunity', false, 40, 'Accept their mentorship', '{"skill_bonus": 20, "behavior": 5, "fame": 50}', 'Decline politely', '{"behavior": 2}'),
('Prison Radio Show', 'The prison radio station is looking for a new DJ. They want someone with music knowledge.', 'opportunity', false, 50, 'Volunteer for the position', '{"fame": 100, "behavior": 10, "xp": 50}', 'Pass on the opportunity', '{"behavior": 0}'),
('Music Teacher Visit', 'A volunteer music teacher is visiting and offering free lessons to inmates.', 'opportunity', true, 0, 'Attend the lessons', '{"skill_bonus": 15, "behavior": 5}', 'Skip it', '{"behavior": 0}'),
('Fan Letter Arrives', 'A dedicated fan has tracked you down and sent a heartfelt letter of support.', 'opportunity', true, 0, 'Write back', '{"fame": 25, "behavior": 3, "energy": 10}', 'Ignore it', '{"behavior": 0}'),
('Prison Band Audition', 'The prison has a band program and they''re looking for new members.', 'opportunity', false, 60, 'Audition for the band', '{"fame": 75, "behavior": 15, "xp": 100}', 'Not interested', '{"behavior": 0}'),
('Journalist Interview Request', 'A music journalist wants to interview you about your experience for a major publication.', 'opportunity', false, 30, 'Grant the interview', '{"fame": 200, "behavior": -5}', 'Decline', '{"behavior": 5}'),
('Songwriting Contest', 'The prison is hosting a songwriting contest with a prize for the winner.', 'opportunity', true, 0, 'Enter the contest', '{"xp": 75, "behavior": 10, "cash": 100}', 'Skip it', '{"behavior": 0}'),
('Record Label Letter', 'A small record label has sent a letter expressing interest in signing you upon release.', 'opportunity', false, 50, 'Reply with enthusiasm', '{"fame": 150, "behavior": 5}', 'Play it cool', '{"behavior": 2}'),
('Prison Choir', 'The chaplain is forming a prison choir and needs voices.', 'opportunity', true, 0, 'Join the choir', '{"behavior": 10, "health": 5, "xp": 25}', 'Decline', '{"behavior": 0}'),
('Instrument Donation', 'A charity has donated instruments to the prison. You could claim a guitar.', 'opportunity', false, 40, 'Claim the guitar', '{"skill_bonus": 10, "behavior": 5}', 'Let someone else have it', '{"behavior": 8}'),

-- DANGER EVENTS
('Cell Shakedown', 'Guards are conducting random cell searches. Someone slipped contraband into your cell.', 'danger', true, 0, 'Report it immediately', '{"behavior": 15, "sentence_days": 0}', 'Hide it and hope for the best', '{"behavior": -20, "sentence_days": 3}'),
('Yard Confrontation', 'Another inmate is challenging you to a fight in the yard.', 'danger', true, 0, 'Stand your ground', '{"behavior": -10, "health": -15}', 'Walk away', '{"behavior": 5}'),
('Guard Accusation', 'A guard is accusing you of something you didn''t do.', 'danger', false, 0, 'Argue your innocence', '{"behavior": -5}', 'Stay silent and accept it', '{"behavior": -2, "sentence_days": 1}'),
('Theft Attempt', 'Someone tried to steal your personal belongings during the night.', 'danger', true, 0, 'Report the theft', '{"behavior": 5}', 'Handle it yourself', '{"behavior": -10, "health": -5}'),
('Riot Warning', 'Tensions are high and a riot might break out. You need to choose sides.', 'danger', false, 0, 'Stay in your cell', '{"behavior": 10, "health": 5}', 'Join the commotion', '{"behavior": -30, "health": -20, "sentence_days": 5}'),
('Food Poisoning', 'The cafeteria food looks suspicious today.', 'danger', true, 0, 'Skip the meal', '{"energy": -10}', 'Eat anyway', '{"health": -15, "energy": 5}'),
('Solitary Threat', 'A guard is threatening to send you to solitary confinement.', 'danger', false, 20, 'Comply immediately', '{"behavior": 5}', 'Protest the treatment', '{"behavior": -15, "sentence_days": 2}'),
('Contraband Offer', 'An inmate offers you contraband items that could make your stay more comfortable.', 'danger', true, 0, 'Refuse firmly', '{"behavior": 10}', 'Accept the items', '{"behavior": -25, "sentence_days": 4}'),
('Work Detail Accident', 'During work detail, you witness an accident. Guards are asking who''s responsible.', 'danger', false, 0, 'Tell the truth', '{"behavior": 10}', 'Stay silent', '{"behavior": -5}'),
('Gang Recruitment', 'A prison gang is pressuring you to join for protection.', 'danger', false, 0, 'Decline respectfully', '{"behavior": 5, "health": -5}', 'Consider joining', '{"behavior": -20}'),

-- SOCIAL EVENTS
('Cellmate''s Birthday', 'Your cellmate''s birthday is coming up. Other inmates are planning something.', 'social', true, 0, 'Help organize', '{"behavior": 5}', 'Stay out of it', '{"behavior": 0}'),
('Visitation Day', 'A band member has come to visit you.', 'social', false, 30, 'Meet with them', '{"energy": 20, "behavior": 5, "fame": 25}', 'Refuse the visit', '{"behavior": -5}'),
('Chaplain Counseling', 'The prison chaplain offers one-on-one counseling sessions.', 'social', true, 0, 'Accept counseling', '{"health": 10, "energy": 10, "behavior": 5}', 'Decline', '{"behavior": 0}'),
('Cellmate Favor', 'Your cellmate needs help writing a letter to their family.', 'social', true, 0, 'Help them', '{"behavior": 8, "xp": 10}', 'Too busy', '{"behavior": -2}'),
('New Inmate Arrival', 'A scared new inmate arrives and looks lost.', 'social', true, 0, 'Show them the ropes', '{"behavior": 10}', 'Mind your own business', '{"behavior": 0}'),
('Movie Night', 'The prison is showing a movie. You can request to watch.', 'social', true, 0, 'Attend movie night', '{"energy": 5, "behavior": 3}', 'Skip it', '{"behavior": 0}'),
('Book Club', 'The prison library is starting a book club.', 'social', true, 0, 'Join the club', '{"xp": 20, "behavior": 5}', 'Not interested', '{"behavior": 0}'),
('Sports Tournament', 'There''s a basketball tournament in the yard.', 'social', true, 0, 'Participate', '{"health": 5, "behavior": 5, "energy": -10}', 'Watch from the sidelines', '{"behavior": 2}'),
('Art Class', 'The prison is offering art therapy classes.', 'social', true, 0, 'Attend art class', '{"behavior": 5, "xp": 15}', 'Skip it', '{"behavior": 0}'),
('Meditation Group', 'A meditation group meets every morning in the chapel.', 'social', true, 0, 'Join the group', '{"health": 5, "energy": 10, "behavior": 5}', 'Sleep in instead', '{"energy": 5}'),

-- MORE OPPORTUNITY EVENTS
('Talent Show', 'The prison is hosting a talent show and you''re encouraged to perform.', 'opportunity', true, 0, 'Perform a song', '{"fame": 100, "behavior": 10, "xp": 50}', 'Watch from the audience', '{"behavior": 2}'),
('Documentary Filming', 'A documentary crew is filming inside the prison and wants to feature you.', 'opportunity', false, 40, 'Agree to be filmed', '{"fame": 300, "behavior": -10}', 'Decline', '{"behavior": 5}'),
('Prison Newsletter', 'You''re offered a column in the prison newsletter about music.', 'opportunity', false, 50, 'Write the column', '{"xp": 30, "behavior": 10}', 'Too much work', '{"behavior": 0}'),
('Rehabilitation Program', 'A music-based rehabilitation program is accepting applications.', 'opportunity', false, 60, 'Apply for the program', '{"behavior": 20, "skill_bonus": 25}', 'Not interested', '{"behavior": 0}'),
('Charity Concert', 'Outside musicians are performing a charity concert at the prison.', 'opportunity', false, 30, 'Request to join them', '{"fame": 150, "behavior": 15, "xp": 75}', 'Enjoy from the crowd', '{"behavior": 5}'),

-- MORE DANGER EVENTS
('Medical Emergency', 'Your cellmate is having a medical emergency.', 'danger', false, 0, 'Call for help immediately', '{"behavior": 15}', 'Panic and freeze', '{"behavior": -5}'),
('False Accusation', 'You''ve been falsely accused of starting a fight.', 'danger', false, 0, 'Demand to see evidence', '{"behavior": 5}', 'Accept the punishment', '{"behavior": -10, "sentence_days": 2}'),
('Pressure to Snitch', 'Guards are pressuring you to inform on other inmates.', 'danger', false, 0, 'Refuse to snitch', '{"behavior": -5, "health": -10}', 'Give them some information', '{"behavior": 5, "sentence_days": -1}'),
('Lockdown', 'The prison goes into lockdown. You''re stuck in your cell for 48 hours.', 'danger', true, 0, 'Use the time to write songs', '{"xp": 20, "behavior": 5}', 'Pace and stress', '{"health": -5, "energy": -10}'),
('Work Injury', 'You injure yourself during work duty.', 'danger', true, 0, 'Report the injury properly', '{"health": -10, "behavior": 5}', 'Tough it out', '{"health": -20}'),

-- ESCAPE EVENTS (RARE)
('Tunnel Discovery', 'You discover an old escape tunnel in the maintenance area.', 'escape', false, 70, 'Attempt to escape', '{"escape_attempt": true, "behavior": -50}', 'Report it to guards', '{"behavior": 25, "sentence_days": -2}'),
('Guard Bribe Opportunity', 'A corrupt guard offers to look the other way for a price.', 'escape', false, 50, 'Take the offer ($10000)', '{"escape_attempt": true, "cash": -10000, "behavior": -40}', 'Refuse and stay quiet', '{"behavior": 5}'),
('Transfer Chaos', 'During a transfer, chaos erupts and you see an opening.', 'escape', false, 60, 'Make a run for it', '{"escape_attempt": true, "behavior": -60}', 'Stay put', '{"behavior": 10}'),
('Celebrity Distraction', 'A famous inmate is causing a scene. Guards are distracted.', 'escape', false, 80, 'Use the distraction', '{"escape_attempt": true, "behavior": -45}', 'Watch the drama unfold', '{"behavior": 0}'),
('Maintenance Vent', 'The maintenance crew left a vent unsecured.', 'escape', false, 75, 'Try to escape through it', '{"escape_attempt": true, "behavior": -55}', 'Alert the guards', '{"behavior": 20, "sentence_days": -1}'),

-- MORE SOCIAL EVENTS
('Family Video Call', 'You''re allowed a video call with family.', 'social', true, 0, 'Take the call', '{"energy": 15, "health": 5, "behavior": 3}', 'Decline the call', '{"behavior": 0}'),
('Inmate Dispute Mediation', 'Two inmates are fighting and look to you to mediate.', 'social', false, 50, 'Help resolve the conflict', '{"behavior": 15, "xp": 25}', 'Stay out of it', '{"behavior": 0}'),
('Cooking Class', 'The prison kitchen is offering cooking classes.', 'social', true, 0, 'Attend the class', '{"behavior": 5, "xp": 10}', 'Skip it', '{"behavior": 0}'),
('Pen Pal Program', 'You''re matched with an outside pen pal.', 'social', false, 40, 'Start writing letters', '{"fame": 50, "behavior": 5}', 'Not interested', '{"behavior": 0}'),
('Graduation Ceremony', 'Inmates who completed education programs are graduating.', 'social', false, 70, 'Attend and support them', '{"behavior": 10, "xp": 15}', 'Too busy', '{"behavior": 0}')

ON CONFLICT DO NOTHING;
