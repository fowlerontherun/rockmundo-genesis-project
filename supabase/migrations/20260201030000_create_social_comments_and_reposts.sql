-- Create social_comments and social_reposts tables to support engagement features
CREATE TABLE IF NOT EXISTS public.social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.social_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_comments_post_id_idx ON public.social_comments (post_id);
CREATE INDEX IF NOT EXISTS social_comments_parent_comment_id_idx ON public.social_comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS social_comments_user_id_idx ON public.social_comments (user_id);

CREATE TABLE IF NOT EXISTS public.social_reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_reposts_post_id_idx ON public.social_reposts (post_id);
CREATE INDEX IF NOT EXISTS social_reposts_user_id_idx ON public.social_reposts (user_id);

ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comments" ON public.social_comments;
CREATE POLICY "Anyone can view comments"
  ON public.social_comments
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create comments" ON public.social_comments;
CREATE POLICY "Users can create comments"
  ON public.social_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their comments" ON public.social_comments;
CREATE POLICY "Users can update their comments"
  ON public.social_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their comments" ON public.social_comments;
CREATE POLICY "Users can delete their comments"
  ON public.social_comments
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view reposts" ON public.social_reposts;
CREATE POLICY "Anyone can view reposts"
  ON public.social_reposts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create reposts" ON public.social_reposts;
CREATE POLICY "Users can create reposts"
  ON public.social_reposts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their reposts" ON public.social_reposts;
CREATE POLICY "Users can delete their reposts"
  ON public.social_reposts
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_social_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_social_comments_updated_at ON public.social_comments;
CREATE TRIGGER update_social_comments_updated_at
  BEFORE UPDATE ON public.social_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_social_comments_updated_at();

CREATE OR REPLACE FUNCTION public.sync_social_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_posts
    SET comments = COALESCE(comments, 0) + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_posts
    SET comments = GREATEST(COALESCE(comments, 0) - 1, 0)
    WHERE id = OLD.post_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_social_post_comment_count_insert ON public.social_comments;
CREATE TRIGGER sync_social_post_comment_count_insert
  AFTER INSERT ON public.social_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_social_post_comment_count();

DROP TRIGGER IF EXISTS sync_social_post_comment_count_delete ON public.social_comments;
CREATE TRIGGER sync_social_post_comment_count_delete
  AFTER DELETE ON public.social_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_social_post_comment_count();

CREATE OR REPLACE FUNCTION public.sync_social_post_repost_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_posts
    SET reposts = COALESCE(reposts, 0) + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_posts
    SET reposts = GREATEST(COALESCE(reposts, 0) - 1, 0)
    WHERE id = OLD.post_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_social_post_repost_count_insert ON public.social_reposts;
CREATE TRIGGER sync_social_post_repost_count_insert
  AFTER INSERT ON public.social_reposts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_social_post_repost_count();

DROP TRIGGER IF EXISTS sync_social_post_repost_count_delete ON public.social_reposts;
CREATE TRIGGER sync_social_post_repost_count_delete
  AFTER DELETE ON public.social_reposts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_social_post_repost_count();

UPDATE public.social_posts
SET comments = COALESCE((SELECT COUNT(*) FROM public.social_comments WHERE post_id = social_posts.id), 0),
    reposts = COALESCE((SELECT COUNT(*) FROM public.social_reposts WHERE post_id = social_posts.id), 0);
