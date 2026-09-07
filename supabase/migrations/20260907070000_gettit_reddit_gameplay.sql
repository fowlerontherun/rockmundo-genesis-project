-- Make Gettit a seeded Reddit-style community with in-game fame consequences.

insert into public.gettit_subreddits (name, display_name, description, icon, is_official)
values
  ('rockmundo', 'RockMundo', 'The front page of RockMundo: news, questions, discoveries and community discussion.', '🎸', true),
  ('bands', 'Bands', 'Band life, chemistry, line-ups, recruitment and everything that happens between rehearsals.', '🎤', true),
  ('songwriting', 'Songwriting', 'Share works in progress, talk songwriting craft and swap writing ideas.', '✍️', true),
  ('gigstories', 'Gig Stories', 'The brilliant, disastrous and completely unbelievable stories from live shows.', '🎟️', true),
  ('touring', 'Touring', 'Routes, transport, crew, hotels and surviving life on the road.', '🚌', true),
  ('gear', 'Gear', 'Guitars, drums, amps, pedals, studio kit and stage equipment.', '🎛️', true),
  ('festivals', 'Festivals', 'Festival line-ups, applications, reviews, rumours and organiser discussion.', '🎪', true),
  ('industry', 'Music Industry', 'Labels, PR, studios, managers, contracts, charts and career strategy.', '💿', true),
  ('newbies', 'New to RockMundo', 'No stupid questions. Get help with the first steps of your music career.', '🌱', true),
  ('memes', 'RockMundo Memes', 'Low-effort posts, tour memes, cursed screenshots and scene jokes.', '😂', false),
  ('hottakes', 'Hot Takes', 'Unpopular opinions, scene arguments and takes you are prepared to defend.', '🔥', false),
  ('lookingforband', 'Looking for Band', 'Find musicians, advertise vacancies and meet potential collaborators.', '🔎', true)
on conflict (name) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  icon = excluded.icon,
  is_official = excluded.is_official,
  updated_at = now();

create table if not exists public.gettit_seed_topics (
  id uuid primary key default gen_random_uuid(),
  subreddit_id uuid not null references public.gettit_subreddits(id) on delete cascade,
  title text not null,
  body text,
  flair text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (subreddit_id, title)
);

alter table public.gettit_seed_topics enable row level security;

drop policy if exists "Gettit starter topics are viewable by everyone" on public.gettit_seed_topics;
create policy "Gettit starter topics are viewable by everyone"
  on public.gettit_seed_topics for select using (true);

grant select on public.gettit_seed_topics to anon, authenticated;

insert into public.gettit_seed_topics (subreddit_id, title, body, flair, sort_order)
select s.id, v.title, v.body, v.flair, v.sort_order
from (values
  ('rockmundo', 'What are you working on in RockMundo today?', 'Share your current goal, grind or problem and see what the community is doing.', 'Daily Discussion', 10),
  ('rockmundo', 'Small things you wish you knew when you started', 'Drop one useful tip that would have saved your first character time or money.', 'Discussion', 20),
  ('bands', 'What makes a band actually stay together?', 'Talk chemistry, roles, activity levels and the things that make a line-up work.', 'Discussion', 10),
  ('songwriting', 'Post your latest songwriting breakthrough', 'What finally improved a song you had been stuck on?', 'Songwriting', 10),
  ('gigstories', 'Tell us about your biggest gig disaster', 'Bad travel, broken gear, awful setlists, no crowd — what went wrong?', 'Story', 10),
  ('touring', 'What is your best touring lesson?', 'Routes, transport choices, scheduling mistakes or crew advice.', 'Advice', 10),
  ('gear', 'Which piece of gear made the biggest difference?', 'Not necessarily the most expensive — what changed your performances the most?', 'Gear', 10),
  ('festivals', 'Which festival would you most like to play this season?', 'Share your target and why your band fits it.', 'Festival Talk', 10),
  ('industry', 'Are PR offers worth it at your current career level?', 'Compare results, costs and when you think promotion starts paying off.', 'Career', 10),
  ('newbies', 'New player questions thread', 'Ask anything about getting started. Experienced players: help someone out.', 'Help', 10),
  ('memes', 'Post your most cursed RockMundo moment', 'Screenshots, bad luck and decisions you immediately regretted.', 'Meme', 10),
  ('hottakes', 'What RockMundo opinion would get you downvoted?', 'Keep it about the game and music scene. Make your case.', 'Hot Take', 10),
  ('lookingforband', 'Musicians wanted megathread', 'Post your city, genre, instrument and what sort of band you are looking for.', 'Recruitment', 10)
) as v(subreddit_name, title, body, flair, sort_order)
join public.gettit_subreddits s on s.name = v.subreddit_name
on conflict (subreddit_id, title) do update set
  body = excluded.body,
  flair = excluded.flair,
  sort_order = excluded.sort_order,
  is_active = true;

create table if not exists public.gettit_post_impact_log (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.gettit_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  threshold_key text not null,
  score_at_event integer not null,
  fame_delta integer not null default 0,
  happiness_delta integer not null default 0,
  created_at timestamptz not null default now(),
  unique (post_id, threshold_key)
);

create index if not exists gettit_post_impact_author_created_idx
  on public.gettit_post_impact_log(author_id, created_at desc);

alter table public.gettit_post_impact_log enable row level security;

drop policy if exists "Players can view their Gettit impact" on public.gettit_post_impact_log;
create policy "Players can view their Gettit impact"
  on public.gettit_post_impact_log for select
  to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = author_id and p.user_id = (select auth.uid())
  ));

grant select on public.gettit_post_impact_log to authenticated;

create or replace function public.apply_gettit_post_impact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_score integer := coalesce(new.upvotes, 0) - coalesce(new.downvotes, 0);
  rule record;
  inserted_id uuid;
  used_positive integer;
  used_negative integer;
  actual_fame integer;
  actual_happiness integer;
  profile_user_id uuid;
begin
  if new.author_id is null then
    return new;
  end if;

  select p.user_id into profile_user_id from public.profiles p where p.id = new.author_id;

  for rule in
    select * from (values
      ('positive_5',   5,   1,  0, true),
      ('positive_15', 15,   2,  0, true),
      ('positive_40', 40,   4,  0, true),
      ('negative_5',  -5,  -1,  0, false),
      ('negative_15', -15, -2, -1, false),
      ('negative_40', -40, -4, -2, false)
    ) as r(threshold_key, threshold_score, fame_delta, happiness_delta, positive)
  loop
    if (rule.positive and post_score >= rule.threshold_score)
       or (not rule.positive and post_score <= rule.threshold_score) then

      inserted_id := null;
      insert into public.gettit_post_impact_log (
        post_id, author_id, threshold_key, score_at_event, fame_delta, happiness_delta
      ) values (
        new.id, new.author_id, rule.threshold_key, post_score, 0, 0
      )
      on conflict (post_id, threshold_key) do nothing
      returning id into inserted_id;

      if inserted_id is not null then
        select coalesce(sum(greatest(fame_delta, 0)), 0)
          into used_positive
          from public.gettit_post_impact_log
         where author_id = new.author_id
           and created_at >= date_trunc('day', now())
           and id <> inserted_id;

        select coalesce(sum(abs(least(fame_delta, 0))), 0)
          into used_negative
          from public.gettit_post_impact_log
         where author_id = new.author_id
           and created_at >= date_trunc('day', now())
           and id <> inserted_id;

        if rule.fame_delta > 0 then
          actual_fame := least(rule.fame_delta, greatest(0, 10 - used_positive));
        else
          actual_fame := -least(abs(rule.fame_delta), greatest(0, 10 - used_negative));
        end if;

        actual_happiness := rule.happiness_delta;

        update public.gettit_post_impact_log
           set fame_delta = actual_fame,
               happiness_delta = actual_happiness
         where id = inserted_id;

        if actual_fame <> 0 or actual_happiness <> 0 then
          update public.profiles
             set fame = greatest(0, coalesce(fame, 0) + actual_fame),
                 happiness = greatest(0, least(100, coalesce(happiness, 50) + actual_happiness))
           where id = new.author_id;

          if profile_user_id is not null then
            insert into public.notifications (
              user_id, profile_id, category, type, title, message, action_path, metadata
            ) values (
              profile_user_id,
              new.author_id,
              'social',
              'gettit_impact',
              case when actual_fame > 0 then 'Your Gettit post is taking off' else 'Your Gettit post is getting buried' end,
              case
                when actual_fame > 0 then 'Community attention earned you +' || actual_fame || ' fame.'
                else 'The backlash cost you ' || abs(actual_fame) || ' fame' || case when actual_happiness < 0 then ' and ' || abs(actual_happiness) || ' happiness.' else '.' end
              end,
              '/gettit',
              jsonb_build_object('post_id', new.id, 'score', post_score, 'fame_delta', actual_fame, 'happiness_delta', actual_happiness, 'threshold', rule.threshold_key)
            );
          end if;
        end if;
      end if;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.apply_gettit_post_impact() from public, anon, authenticated;

drop trigger if exists trg_apply_gettit_post_impact on public.gettit_posts;
create trigger trg_apply_gettit_post_impact
  after update of upvotes, downvotes on public.gettit_posts
  for each row
  when (old.upvotes is distinct from new.upvotes or old.downvotes is distinct from new.downvotes)
  execute function public.apply_gettit_post_impact();

create or replace function public.prevent_gettit_self_vote()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1 from public.gettit_posts p
    where p.id = new.post_id and p.author_id = new.user_id
  ) then
    raise exception 'You cannot vote on your own Gettit post';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_gettit_self_vote on public.gettit_post_votes;
create trigger trg_prevent_gettit_self_vote
  before insert or update of post_id, user_id on public.gettit_post_votes
  for each row execute function public.prevent_gettit_self_vote();
