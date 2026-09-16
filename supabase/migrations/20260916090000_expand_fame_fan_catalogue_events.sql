insert into public.random_events (
  title, description, category, is_common,
  option_a_text, option_a_effects, option_a_outcome_text,
  option_b_text, option_b_effects, option_b_outcome_text,
  is_active, band_fame_min, band_fame_max, band_fans_min, band_fans_max,
  requires_released_music, release_age_min_days, release_age_max_days, target_release_type
)
select * from (values
  (
    'Local Radio DJ Champions Your Track',
    'A local radio DJ has become obsessed with one of your releases and keeps slipping it into late-night shows. Listeners are starting to look you up.',
    'career', false,
    'Send the station a promo pack', '{"cash":-150,"fans":60,"fame":20,"release_hype":95}'::jsonb,
    'The DJ doubles down and the extra airplay gives the release a useful early sales and streaming bump.',
    'Let the DJ keep championing it', '{"fans":85,"fame":12,"release_hype":65}'::jsonb,
    'The support stays authentic and a small but loyal new audience starts discovering the release.',
    true, 0, 2000, 50, 5000, true, 1, 90, null
  ),
  (
    'College Radio Finds Your Debut EP',
    'A cluster of college radio stations has picked up your EP and students are sharing it between campuses.',
    'industry', false,
    'Press a campus campaign', '{"cash":-400,"fans":140,"fame":35,"release_hype":150}'::jsonb,
    'The campus push works and the EP starts appearing on more playlists, wishlists and turntables.',
    'Keep it grassroots', '{"fans":190,"fame":25,"release_hype":105}'::jsonb,
    'Word of mouth spreads between campuses and your EP quietly builds a wider audience.',
    true, 0, 3000, 100, 8000, true, 3, 180, 'ep'
  ),
  (
    'Niche Playlist Resurfaces an Older Track',
    'A respected niche playlist has unexpectedly added one of your older tracks and listeners are working backwards through your catalogue.',
    'social', false,
    'Promote the playlist placement', '{"cash":-600,"fans":220,"fame":55,"release_hype":210}'::jsonb,
    'Your promotion compounds the playlist discovery and gives the release a strong second wave.',
    'Let discovery stay organic', '{"fans":280,"fame":35,"release_hype":150}'::jsonb,
    'Listeners keep sharing the playlist and the older release steadily climbs again.',
    true, 100, 5000, 250, 12000, true, 7, null, null
  ),
  (
    'Fan Edit Starts Trending',
    'A dramatic fan edit using one of your songs is spreading fast across short-form video platforms.',
    'social', false,
    'Post your own version', '{"cash":-500,"fans":300,"fame":70,"release_hype":250}'::jsonb,
    'Your response pushes the trend further and thousands of viewers jump to the original release.',
    'Stay out of the way', '{"fans":360,"fame":45,"release_hype":180}'::jsonb,
    'The fans keep ownership of the trend and the song still gets a healthy surge in attention.',
    true, 300, 7000, 500, 15000, true, 5, null, null
  ),
  (
    'Unexpected Overseas Breakthrough',
    'One of your releases has suddenly taken off in a country where your band has barely promoted before.',
    'industry', false,
    'Target the new market', '{"cash":-1800,"fans":650,"fame":130,"release_hype":360}'::jsonb,
    'Localized promotion turns the surprise spike into a serious new market for the band.',
    'See how far it travels', '{"fans":800,"fame":95,"release_hype":260}'::jsonb,
    'The overseas audience keeps growing through recommendations and fan sharing.',
    true, 1000, 10000, 2000, 25000, true, 3, null, null
  ),
  (
    'Cover Band Sends Listeners Back to You',
    'A popular cover band has started closing shows with one of your older songs and audiences are searching for the original.',
    'career', false,
    'Invite them to collaborate online', '{"cash":-1200,"fans":700,"fame":140,"release_hype":390}'::jsonb,
    'The collaboration introduces both audiences to each other and your original recording surges.',
    'Give them your blessing', '{"fans":850,"fame":95,"release_hype":275}'::jsonb,
    'Fans appreciate the gesture and steadily pour back toward your original release.',
    true, 1500, 12000, 3000, 30000, true, 10, null, null
  ),
  (
    'Your Single Becomes a Wedding Favourite',
    'Couples have started using one of your older singles for first dances and wedding videos are sending new listeners to the track.',
    'social', false,
    'Lean into the romantic trend', '{"cash":-2500,"fans":900,"fame":160,"release_hype":430}'::jsonb,
    'A tasteful campaign helps the single become a genuine wedding-season favourite.',
    'Let couples spread it naturally', '{"fans":1100,"fame":120,"release_hype":315}'::jsonb,
    'The personal videos keep circulating and the single enjoys a warm, sustained revival.',
    true, 2000, 15000, 5000, 35000, true, 10, null, 'single'
  ),
  (
    'Podcast Theme Song Takes Off',
    'A fast-growing podcast has adopted one of your songs as its theme and listeners are asking where they can hear the full track.',
    'industry', false,
    'Partner with the podcast', '{"cash":2500,"fans":1100,"fame":210,"release_hype":480}'::jsonb,
    'Cross-promotion turns the theme placement into a major new source of listeners and buyers.',
    'Take the exposure and fee', '{"cash":5000,"fans":850,"fame":160,"release_hype":350}'::jsonb,
    'The podcast keeps growing and its listeners continue finding their way to your release.',
    true, 2500, 20000, 5000, 40000, true, 5, null, null
  ),
  (
    'Indie Film Sleeper Hit Placement',
    'A small film using your single has become an unexpected sleeper hit and viewers have fallen for the soundtrack.',
    'industry', false,
    'Push the soundtrack connection', '{"cash":-3500,"fans":1400,"fame":280,"release_hype":540}'::jsonb,
    'The soundtrack campaign catches the film''s momentum and the single becomes closely associated with it.',
    'Collect the licensing upside', '{"cash":9000,"fans":1050,"fame":220,"release_hype":400}'::jsonb,
    'The film keeps finding viewers and the single gains a valuable second life.',
    true, 3000, 20000, 6000, 45000, true, 7, null, 'single'
  ),
  (
    'Collectors Rediscover Your Early EP',
    'Collectors have started hunting down your early EP after fans began calling it an overlooked gem.',
    'career', false,
    'Launch an anniversary push', '{"cash":-4500,"fans":1400,"fame":300,"release_hype":570}'::jsonb,
    'The renewed attention turns the EP into a sought-after piece of your catalogue.',
    'Keep it scarce and mysterious', '{"fans":1700,"fame":250,"release_hype":420}'::jsonb,
    'Scarcity adds to the mythology and listeners flock to stream the original EP.',
    true, 3000, null, 6000, null, true, 30, null, 'ep'
  ),
  (
    'Anniversary Rediscovery',
    'Fans have noticed the anniversary of one of your older releases and nostalgic posts are spreading across the community.',
    'career', false,
    'Celebrate it properly', '{"cash":-6500,"fans":1900,"fame":360,"release_hype":620}'::jsonb,
    'Archive photos, stories and promotion turn the anniversary into a substantial catalogue revival.',
    'Post a simple thank-you', '{"fans":2300,"fame":280,"release_hype":455}'::jsonb,
    'The understated response feels genuine and keeps the nostalgia wave moving.',
    true, 5000, null, 10000, null, true, 30, null, null
  ),
  (
    'Club Remix Revives Your Single',
    'An unofficial club remix of one of your older singles is filling dancefloors and DJs are asking for the original stems.',
    'industry', false,
    'Commission an official remix', '{"cash":-9000,"fans":2500,"fame":480,"release_hype":710}'::jsonb,
    'The official remix legitimises the craze and pushes huge numbers back to the original single.',
    'Let the bootleg scene run', '{"fans":3100,"fame":360,"release_hype":520}'::jsonb,
    'The underground remix keeps spreading and the original single benefits from every new DJ set.',
    true, 6000, null, 12000, null, true, 10, null, 'single'
  ),
  (
    'Famous Musician Covers Your Single',
    'A major artist has performed your older single live and publicly praised the songwriting.',
    'industry', false,
    'Arrange a joint performance', '{"cash":-12000,"fans":3400,"fame":650,"release_hype":800}'::jsonb,
    'The joint performance becomes a major music story and sends a huge audience to your original single.',
    'Thank them publicly', '{"fans":4100,"fame":500,"release_hype":610}'::jsonb,
    'Their endorsement keeps circulating and your original recording gains a powerful new audience.',
    true, 7000, null, 15000, null, true, 14, null, 'single'
  ),
  (
    'Video Game Trailer Uses Your Track',
    'A highly anticipated video game trailer has launched with one of your songs blasting over the reveal.',
    'industry', false,
    'Build a gaming crossover campaign', '{"cash":-15000,"fans":4200,"fame":760,"release_hype":870}'::jsonb,
    'The crossover campaign catches fire and the release becomes inseparable from the game''s launch hype.',
    'Take the sync and exposure', '{"cash":18000,"fans":3600,"fame":600,"release_hype":660}'::jsonb,
    'Millions watch the trailer repeatedly and a large share track down the full song.',
    true, 8000, null, 16000, null, true, 7, null, null
  ),
  (
    'Talent Show Contestant Covers Your Song',
    'A contestant on a major television talent show has performed one of your singles and the clip is everywhere.',
    'industry', false,
    'Join the conversation', '{"cash":-8000,"fans":4300,"fame":820,"release_hype":900}'::jsonb,
    'Your reaction and follow-up content amplify the broadcast and the original single rockets back into circulation.',
    'Let the performance speak', '{"fans":5000,"fame":650,"release_hype":690}'::jsonb,
    'The cover keeps being shared and viewers continue discovering your original version.',
    true, 9000, null, 18000, null, true, 14, null, 'single'
  ),
  (
    'Massive Creator Challenge Uses Your Song',
    'A huge online creator has built a challenge around one of your tracks and millions of users are copying it.',
    'social', false,
    'Launch an official challenge', '{"cash":-18000,"fans":5500,"fame":950,"release_hype":980}'::jsonb,
    'Your official involvement extends the trend and the release becomes one of the moment''s defining sounds.',
    'Keep it fan-led', '{"fans":6500,"fame":760,"release_hype":740}'::jsonb,
    'The challenge stays spontaneous and the endless user videos keep feeding listeners to the song.',
    true, 10000, null, 20000, null, true, 5, null, null
  ),
  (
    'Prestige Series Finale Sync',
    'A critically acclaimed streaming series has used your older single in its emotional final scene.',
    'industry', false,
    'Turn the finale into a campaign', '{"cash":-22000,"fans":7000,"fame":1250,"release_hype":1080}'::jsonb,
    'The scene dominates discussion online and your campaign turns the single into a worldwide rediscovery.',
    'Let viewers find it themselves', '{"fans":8200,"fame":1000,"release_hype":830}'::jsonb,
    'Viewers flood music services searching for the song and the single posts enormous catalogue numbers.',
    true, 14000, null, 30000, null, true, 14, null, 'single'
  ),
  (
    'Global Brand Campaign Licenses Your Single',
    'A global brand has licensed one of your older singles for a major advertising campaign running across multiple countries.',
    'industry', false,
    'Coordinate a worldwide push', '{"cash":30000,"fans":8500,"fame":1450,"release_hype":1150}'::jsonb,
    'The advert and your campaign reinforce each other until the single feels unavoidable worldwide.',
    'Take the licensing deal', '{"cash":60000,"fans":7000,"fame":1150,"release_hype":880}'::jsonb,
    'The campaign runs everywhere and the single experiences a huge international resurgence.',
    true, 18000, null, 35000, null, true, 14, null, 'single'
  ),
  (
    'Music Documentary Revisits Your Era',
    'A major music documentary has devoted a segment to your band''s rise and prominently featured one of your older recordings.',
    'industry', false,
    'Open the archives for promotion', '{"cash":-20000,"fans":9000,"fame":1600,"release_hype":1180}'::jsonb,
    'Extra archive material makes the documentary coverage even bigger and your catalogue surges across generations.',
    'Let the documentary tell the story', '{"fans":10500,"fame":1300,"release_hype":900}'::jsonb,
    'The documentary sends a broad new audience back through the band''s history and releases.',
    true, 20000, null, 45000, null, true, 45, null, null
  ),
  (
    'Award Show Tribute Performance',
    'A major award show has staged a tribute featuring one of your classic tracks in front of a global audience.',
    'career', false,
    'Appear in the tribute', '{"cash":-30000,"fans":12000,"fame":2000,"release_hype":1270}'::jsonb,
    'Your appearance becomes one of the night''s biggest moments and sends the classic release soaring again.',
    'Watch from the audience', '{"fans":14000,"fame":1650,"release_hype":980}'::jsonb,
    'The tribute stands on its own and millions of viewers rediscover the original recording.',
    true, 25000, null, 50000, null, true, 30, null, null
  ),
  (
    'Superstar Samples Your Old Track',
    'One of the world''s biggest artists has sampled your older release on a surprise new single and fans are hunting down the source.',
    'industry', false,
    'Promote the connection worldwide', '{"cash":50000,"fans":15000,"fame":2400,"release_hype":1350}'::jsonb,
    'The sample becomes a major talking point and your original release explodes with a completely new generation.',
    'Let the credits lead listeners back', '{"cash":90000,"fans":13000,"fame":1900,"release_hype":1050}'::jsonb,
    'Curious listeners trace the sample to its source and your catalogue receives a massive global boost.',
    true, 30000, null, 60000, null, true, 30, null, null
  ),
  (
    'Stadium Crowd Adopts Your Single as a Chant',
    'Tens of thousands of sports fans have started singing the hook from one of your older singles as a stadium chant.',
    'career', false,
    'Release a stadium-themed video', '{"cash":-35000,"fans":17000,"fame":2500,"release_hype":1400}'::jsonb,
    'The video captures the moment perfectly and the single becomes a cross-cultural anthem with enormous new numbers.',
    'Let the terraces own it', '{"fans":20000,"fame":2050,"release_hype":1100}'::jsonb,
    'Fans make the song their own and every match sends another wave of listeners to the original single.',
    true, 35000, null, 75000, null, true, 20, null, 'single'
  ),
  (
    'Generational Rediscovery Wave',
    'A younger generation has collectively discovered one of your older releases and is treating it like a brand-new record.',
    'social', false,
    'Reintroduce the release', '{"cash":-45000,"fans":22000,"fame":3000,"release_hype":1450}'::jsonb,
    'A polished reintroduction campaign bridges both generations and produces one of the biggest catalogue revivals of your career.',
    'Let the new generation claim it', '{"fans":26000,"fame":2400,"release_hype":1150}'::jsonb,
    'The younger audience keeps the discovery feeling fresh and the old release suddenly behaves like a new hit.',
    true, 45000, null, 100000, null, true, 60, null, null
  )
) as v(
  title, description, category, is_common,
  option_a_text, option_a_effects, option_a_outcome_text,
  option_b_text, option_b_effects, option_b_outcome_text,
  is_active, band_fame_min, band_fame_max, band_fans_min, band_fans_max,
  requires_released_music, release_age_min_days, release_age_max_days, target_release_type
)
where not exists (
  select 1 from public.random_events existing where existing.title = v.title
);
