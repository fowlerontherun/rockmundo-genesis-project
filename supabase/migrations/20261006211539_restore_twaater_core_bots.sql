insert into public.twaater_accounts
  (id, owner_type, owner_id, handle, display_name, verified, bio, follower_count, following_count, fame_score)
values
  ('11111111-1111-1111-1111-111111111001'::uuid, 'bot', '11111111-0000-0000-0000-000000000001'::uuid, 'MusicWeeklyReview', 'Music Weekly', true, 'Music reviews, new releases and hidden gems.', 0, 0, 8500),
  ('11111111-1111-1111-1111-111111111004'::uuid, 'bot', '11111111-0000-0000-0000-000000000004'::uuid, 'TheSoundRoom', 'The Sound Room', true, 'Live music venue news, bookings and gig chatter.', 0, 0, 4500),
  ('11111111-1111-1111-1111-111111111007'::uuid, 'bot', '11111111-0000-0000-0000-000000000007'::uuid, 'LabelScout', 'Label Scout', true, 'A&R insights and emerging artist discovery.', 0, 0, 6800),
  ('11111111-1111-1111-1111-111111111010'::uuid, 'bot', '11111111-0000-0000-0000-000000000010'::uuid, 'MusicFanatic99', 'Music Fanatic', false, 'Here for the music, gigs and new discoveries.', 0, 0, 1200),
  ('11111111-1111-1111-1111-111111111015'::uuid, 'bot', '11111111-0000-0000-0000-000000000015'::uuid, 'TwaaterNews', 'Twaater News', true, 'News from the Rockmundo music community.', 0, 0, 15000)
on conflict (handle) do nothing;

insert into public.twaater_bot_accounts
  (account_id, bot_type, is_active, posting_frequency, personality_traits)
select
  ta.id,
  case ta.handle
    when 'MusicWeeklyReview' then 'critic'
    when 'TheSoundRoom' then 'venue_owner'
    when 'LabelScout' then 'industry_insider'
    when 'MusicFanatic99' then 'music_fan'
    when 'TwaaterNews' then 'industry_insider'
  end,
  true,
  'low',
  case ta.handle
    when 'MusicWeeklyReview' then '["analytical","professional","knowledgeable"]'::jsonb
    when 'TheSoundRoom' then '["welcoming","local","community-focused"]'::jsonb
    when 'LabelScout' then '["professional","encouraging","talent-focused"]'::jsonb
    when 'MusicFanatic99' then '["passionate","casual","reactive"]'::jsonb
    when 'TwaaterNews' then '["official","neutral","informative"]'::jsonb
  end
from public.twaater_accounts ta
where ta.owner_type = 'bot'
  and ta.handle in ('MusicWeeklyReview','TheSoundRoom','LabelScout','MusicFanatic99','TwaaterNews')
on conflict (account_id) do update
set
  bot_type = excluded.bot_type,
  is_active = true,
  posting_frequency = excluded.posting_frequency,
  personality_traits = excluded.personality_traits,
  updated_at = now();
