-- Seed light-hearted daily random events that reward an already-learned, non-maxed skill.
-- The trigger stores the chosen skill on player_events so outcome processing is deterministic.

alter table public.random_events
  add column if not exists awards_random_skill_xp boolean not null default false,
  add column if not exists skill_xp_min integer,
  add column if not exists skill_xp_max integer;

alter table public.player_events
  add column if not exists target_skill_slug text;

alter table public.random_events
  drop constraint if exists random_events_skill_xp_range_check;

alter table public.random_events
  add constraint random_events_skill_xp_range_check
  check (
    (not awards_random_skill_xp and skill_xp_min is null and skill_xp_max is null)
    or (
      awards_random_skill_xp
      and skill_xp_min between 1 and 5000
      and skill_xp_max between skill_xp_min and 5000
    )
  );

insert into public.random_events (
  title, description, category, is_common,
  option_a_text, option_a_effects, option_a_outcome_text,
  option_b_text, option_b_effects, option_b_outcome_text,
  is_active, awards_random_skill_xp, skill_xp_min, skill_xp_max
)
select * from (values
  (
    'Accidental Masterclass',
    'You duck into the wrong room looking for the toilets and somehow end up sitting through an intense masterclass. Leaving early would now be socially impossible.',
    'random', true,
    'Take furious notes', '{}'::jsonb,
    'Against all expectations, several useful ideas stick. You leave slightly confused but noticeably better at something you already knew.',
    'Pretend you meant to be there', '{}'::jsonb,
    'Your committed nodding fools everyone, including yourself. Somewhere along the way, you genuinely learn something.',
    true, true, 140, 360
  ),
  (
    'The Extremely Competitive Busker',
    'A street musician mistakes your casual glance for a challenge and launches into an absurdly impressive performance directly at you.',
    'random', true,
    'Answer with your own technique', '{}'::jsonb,
    'What begins as petty one-upmanship turns into a surprisingly useful practice session.',
    'Study their moves from a safe distance', '{}'::jsonb,
    'You avoid the duel but quietly steal several good ideas. Educational cowardice pays off.',
    true, true, 120, 300
  ),
  (
    'Lift Music Revelation',
    'You are trapped in a lift for twenty minutes with the same eight-bar loop playing endlessly. Something about repetition starts rewiring your brain.',
    'random', true,
    'Analyse every detail', '{}'::jsonb,
    'By the time the doors open, you have accidentally completed a tiny private conservatoire course.',
    'Hum an increasingly elaborate harmony', '{}'::jsonb,
    'Your boredom mutates into practice. The other passengers are less impressed than your skill progression is.',
    true, true, 100, 260
  ),
  (
    'Neighbour Complains Too Specifically',
    'A neighbour bangs on the wall and shouts an unexpectedly detailed critique of your technique, timing and general artistic choices.',
    'random', true,
    'Actually listen to the feedback', '{}'::jsonb,
    'Annoyingly, the critique was useful. You make an adjustment and immediately notice the difference.',
    'Prove them wrong', '{}'::jsonb,
    'Spite is not a recognised teaching method, but today it works beautifully.',
    true, true, 130, 340
  ),
  (
    'Tutorial Rabbit Hole',
    'You open one harmless tutorial and emerge three hours later knowing far too much about a very specific technique.',
    'random', true,
    'Keep following recommended videos', '{}'::jsonb,
    'The algorithm finally does something helpful and your existing skill gets a sizeable bump.',
    'Practise the weirdest tip immediately', '{}'::jsonb,
    'It looks ridiculous, but it works. You learn faster than you would ever admit publicly.',
    true, true, 180, 420
  ),
  (
    'Overconfident Pub Expert',
    'Someone at the bar confidently explains your own craft to you despite clearly having learned everything five minutes ago.',
    'social', true,
    'Correct them with a demonstration', '{}'::jsonb,
    'Teaching the point forces you to sharpen your own technique. The expert quietly changes the subject.',
    'Ask increasingly difficult questions', '{}'::jsonb,
    'Their answers collapse, but making the questions teaches you more than expected.',
    true, true, 110, 280
  ),
  (
    'Mystery Rehearsal Room',
    'A booking mix-up puts you in a rehearsal room full of unfamiliar equipment and a handwritten note saying: GOOD LUCK.',
    'career', true,
    'Experiment until something works', '{}'::jsonb,
    'After several alarming noises, experimentation turns into genuine improvement.',
    'Read every label before touching anything', '{}'::jsonb,
    'Unusually responsible behaviour reveals several useful techniques you had overlooked.',
    true, true, 170, 390
  ),
  (
    'The Cable Knot From Hell',
    'You discover a cable knot so complex it may qualify as a new branch of mathematics.',
    'random', true,
    'Untangle it patiently', '{}'::jsonb,
    'The ordeal becomes a bizarre exercise in concentration and technique. You emerge victorious and slightly wiser.',
    'Use creative problem solving', '{}'::jsonb,
    'Your unconventional solution should not have worked. It did, and you learned something useful in the process.',
    true, true, 100, 240
  ),
  (
    'Unexpected Kids Workshop',
    'You are mistaken for the instructor at a beginner workshop. A room full of children is already staring at you expectantly.',
    'social', true,
    'Teach the basics confidently', '{}'::jsonb,
    'Explaining fundamentals exposes tiny gaps in your own technique and helps you tighten them up.',
    'Turn it into a chaotic group exercise', '{}'::jsonb,
    'The session is loud, disorganised and surprisingly educational for everyone involved.',
    true, true, 160, 380
  ),
  (
    'Backstage Bet',
    'Someone backstage bets you cannot demonstrate a tricky technique cleanly three times in a row.',
    'career', true,
    'Accept immediately', '{}'::jsonb,
    'Your pride forces an unusually focused practice burst. The third attempt is almost suspiciously good.',
    'Negotiate five attempts instead', '{}'::jsonb,
    'Technically you changed the rules, but the extra repetitions pay off.',
    true, true, 150, 350
  ),
  (
    'Wrong Autocorrect, Right Idea',
    'A badly autocorrected message from a bandmate accidentally describes a practice technique that makes no sense whatsoever.',
    'random', true,
    'Try it literally', '{}'::jsonb,
    'Against reason and several laws of good taste, the nonsense exercise improves your technique.',
    'Work out what they probably meant', '{}'::jsonb,
    'Decoding the message becomes a useful bit of focused practice.',
    true, true, 120, 320
  ),
  (
    'The One-Take Challenge',
    'A friend announces that anything worth doing can be done perfectly in one take, then immediately starts filming you.',
    'social', true,
    'Commit to the one take', '{}'::jsonb,
    'Pressure sharpens your focus and you discover a cleaner approach to a skill you already use.',
    'Demand a warm-up first', '{}'::jsonb,
    'The warm-up becomes the useful part. By the actual take, you have genuinely improved.',
    true, true, 180, 430
  ),
  (
    'Suspiciously Helpful Roadie',
    'A roadie watches you work for thirty seconds, sighs deeply, and says: "Want to know the easy way?"',
    'career', true,
    'Swallow your pride and listen', '{}'::jsonb,
    'The easy way is infuriatingly effective. You immediately incorporate it into your existing skillset.',
    'Ask them to prove it', '{}'::jsonb,
    'They do. Repeatedly. The demonstration becomes an accidental lesson.',
    true, true, 140, 360
  ),
  (
    'Coffee Shop Rhythm Section',
    'A broken coffee machine, a squeaky door and someone tapping a spoon accidentally form an annoyingly catchy rhythm.',
    'random', true,
    'Join in mentally', '{}'::jsonb,
    'You turn the accidental groove into a useful exercise and walk away with improved instincts.',
    'Record the pattern before it disappears', '{}'::jsonb,
    'Studying the ridiculous little pattern later gives one of your existing skills a useful workout.',
    true, true, 100, 300
  ),
  (
    'Five-Minute Expert Challenge',
    'Someone claims nobody can noticeably improve at anything in five minutes. This is obviously unacceptable.',
    'random', true,
    'Attempt to prove them wrong', '{}'::jsonb,
    'Weaponised stubbornness produces a surprisingly effective micro-practice session.',
    'Turn it into a ten-minute challenge', '{}'::jsonb,
    'You technically miss the point but gain more practice, which is what matters.',
    true, true, 100, 250
  ),
  (
    'Legendary Soundcheck Mistake',
    'During soundcheck you make a mistake so strange that everyone stops talking. Then somebody asks you to do it again.',
    'career', true,
    'Recreate it deliberately', '{}'::jsonb,
    'Trying to reproduce the accident forces you to understand what happened, improving an existing skill in the process.',
    'Pretend it was intentional all along', '{}'::jsonb,
    'Maintaining the lie requires rapid experimentation. Somehow, you come out better at your craft.',
    true, true, 200, 500
  )
) as v(
  title, description, category, is_common,
  option_a_text, option_a_effects, option_a_outcome_text,
  option_b_text, option_b_effects, option_b_outcome_text,
  is_active, awards_random_skill_xp, skill_xp_min, skill_xp_max
)
where not exists (
  select 1 from public.random_events existing where existing.title = v.title
);
