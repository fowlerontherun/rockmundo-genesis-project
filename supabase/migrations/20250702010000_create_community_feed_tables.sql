create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  media_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists community_posts_created_at_idx on public.community_posts (created_at desc);

create table if not exists public.community_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('like', 'love', 'fire', 'wow', 'laugh')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (post_id, profile_id)
);

alter table public.community_posts enable row level security;
alter table public.community_post_reactions enable row level security;

create policy "Community posts are viewable by everyone" on public.community_posts
  for select using (true);

create policy "Authenticated users can create community posts" on public.community_posts
  for insert with check (auth.uid() = author_id);

create policy "Authors can update their community posts" on public.community_posts
  for update using (auth.uid() = author_id);

create policy "Authors can delete their community posts" on public.community_posts
  for delete using (auth.uid() = author_id);

create policy "Community reactions are viewable by everyone" on public.community_post_reactions
  for select using (true);

create policy "Players can react to community posts" on public.community_post_reactions
  for insert with check (auth.uid() = profile_id);

create policy "Players can update their community reactions" on public.community_post_reactions
  for update using (auth.uid() = profile_id);

create policy "Players can remove their community reactions" on public.community_post_reactions
  for delete using (auth.uid() = profile_id);

create trigger community_posts_set_updated_at
  before update on public.community_posts
  for each row
  execute function public.set_updated_at();

create trigger community_post_reactions_set_updated_at
  before update on public.community_post_reactions
  for each row
  execute function public.set_updated_at();
