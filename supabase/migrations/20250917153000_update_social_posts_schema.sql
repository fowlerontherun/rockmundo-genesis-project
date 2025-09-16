-- Ensure social_posts table supports social media metrics and defaults
CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform varchar(50) DEFAULT 'general',
  content text NOT NULL,
  likes integer DEFAULT 0,
  shares integer DEFAULT 0,
  comments integer DEFAULT 0,
  fan_growth integer DEFAULT 0,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  reposts integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS "timestamp" timestamptz;

UPDATE public.social_posts
SET "timestamp" = COALESCE("timestamp", created_at, now())
WHERE "timestamp" IS NULL;

ALTER TABLE public.social_posts
  ALTER COLUMN "timestamp" SET DEFAULT now(),
  ALTER COLUMN "timestamp" SET NOT NULL;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS reposts integer;

UPDATE public.social_posts
SET reposts = COALESCE(reposts, shares, 0)
WHERE reposts IS NULL;

ALTER TABLE public.social_posts
  ALTER COLUMN reposts SET DEFAULT 0,
  ALTER COLUMN reposts SET NOT NULL;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS views integer;

UPDATE public.social_posts
SET views = CASE
  WHEN views IS NULL OR views = 0 THEN GREATEST((COALESCE(likes, 0) + COALESCE(comments, 0) + COALESCE(shares, 0)) * 12, 0)
  ELSE views
END;

ALTER TABLE public.social_posts
  ALTER COLUMN views SET DEFAULT 0,
  ALTER COLUMN views SET NOT NULL;

ALTER TABLE public.social_posts
  ALTER COLUMN likes SET DEFAULT 0;

ALTER TABLE public.social_posts
  ALTER COLUMN comments SET DEFAULT 0;

ALTER TABLE public.social_posts
  ALTER COLUMN shares SET DEFAULT 0;

ALTER TABLE public.social_posts
  ALTER COLUMN fan_growth SET DEFAULT 0;

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own posts" ON public.social_posts;
CREATE POLICY "Users can manage their own posts"
  ON public.social_posts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Social posts are viewable by everyone" ON public.social_posts;
CREATE POLICY "Social posts are viewable by everyone"
  ON public.social_posts
  FOR SELECT
  USING (true);
