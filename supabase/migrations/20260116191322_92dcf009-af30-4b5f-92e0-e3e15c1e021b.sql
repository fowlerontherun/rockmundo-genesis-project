-- Gettit Forum System: Complete Schema

-- Create gettit_subreddits table
CREATE TABLE IF NOT EXISTS public.gettit_subreddits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🎸',
  banner_url TEXT,
  member_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_official BOOLEAN DEFAULT false,
  is_nsfw BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gettit_subreddits_name_idx ON public.gettit_subreddits (name);

ALTER TABLE public.gettit_subreddits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subreddits are viewable by everyone" ON public.gettit_subreddits
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create subreddits" ON public.gettit_subreddits
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create gettit_posts table
CREATE TABLE IF NOT EXISTS public.gettit_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit_id UUID REFERENCES public.gettit_subreddits(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  flair TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gettit_posts_subreddit_idx ON public.gettit_posts (subreddit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gettit_posts_author_idx ON public.gettit_posts (author_id);

ALTER TABLE public.gettit_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts are viewable by everyone" ON public.gettit_posts
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create posts" ON public.gettit_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts" ON public.gettit_posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts" ON public.gettit_posts
  FOR DELETE USING (auth.uid() = author_id);

-- Create gettit_post_votes table
CREATE TABLE IF NOT EXISTS public.gettit_post_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.gettit_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.gettit_post_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are viewable by everyone" ON public.gettit_post_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own votes" ON public.gettit_post_votes
  FOR ALL USING (auth.uid() = user_id);

-- Create gettit_comments table
CREATE TABLE IF NOT EXISTS public.gettit_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.gettit_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.gettit_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gettit_comments_post_idx ON public.gettit_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS gettit_comments_parent_idx ON public.gettit_comments (parent_id);

ALTER TABLE public.gettit_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone" ON public.gettit_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON public.gettit_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own comments" ON public.gettit_comments
  FOR UPDATE USING (auth.uid() = author_id);

-- Create gettit_comment_votes table
CREATE TABLE IF NOT EXISTS public.gettit_comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.gettit_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.gettit_comment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comment votes are viewable by everyone" ON public.gettit_comment_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own comment votes" ON public.gettit_comment_votes
  FOR ALL USING (auth.uid() = user_id);

-- Create gettit_subreddit_members table
CREATE TABLE IF NOT EXISTS public.gettit_subreddit_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subreddit_id UUID NOT NULL REFERENCES public.gettit_subreddits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subreddit_id, user_id)
);

ALTER TABLE public.gettit_subreddit_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subreddit members are viewable by everyone" ON public.gettit_subreddit_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join subreddits" ON public.gettit_subreddit_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave subreddits" ON public.gettit_subreddit_members
  FOR DELETE USING (auth.uid() = user_id);

-- Seed default subreddits
INSERT INTO public.gettit_subreddits (name, display_name, description, icon, is_official) VALUES
  ('rockmundo', 'Rockmundo', 'The main hub for all Rockmundo players', '🎸', true),
  ('bands', 'Bands', 'Find bandmates, share your band stories, and discuss band dynamics', '🎤', true),
  ('gigstories', 'Gig Stories', 'Share your best (and worst) gig experiences', '🎵', true),
  ('songwriting', 'Songwriting', 'Tips, tricks, and feedback for songwriters', '✍️', true),
  ('newbies', 'Newbies', 'Questions and help for new players', '🌱', true),
  ('memes', 'Memes', 'Rock and music memes only', '😂', false),
  ('trading', 'Trading', 'Trade gear, find collaborators, make deals', '💰', false),
  ('festivals', 'Festivals', 'Festival discussions, lineups, and experiences', '🎪', true)
ON CONFLICT (name) DO NOTHING;