-- Fix Gettit RLS policies to use profile.id instead of auth.uid()
-- The frontend inserts profile.id as author_id, not auth.uid()

-- Drop existing policies on gettit_posts
DROP POLICY IF EXISTS "Authenticated users can create posts" ON gettit_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON gettit_posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON gettit_posts;

-- Create corrected policies for gettit_posts
CREATE POLICY "Authenticated users can create posts" ON gettit_posts
  FOR INSERT WITH CHECK (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own posts" ON gettit_posts
  FOR UPDATE USING (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own posts" ON gettit_posts
  FOR DELETE USING (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Drop existing policies on gettit_post_votes
DROP POLICY IF EXISTS "Authenticated users can vote" ON gettit_post_votes;
DROP POLICY IF EXISTS "Users can update own votes" ON gettit_post_votes;
DROP POLICY IF EXISTS "Users can delete own votes" ON gettit_post_votes;

-- Create corrected policies for gettit_post_votes
CREATE POLICY "Authenticated users can vote" ON gettit_post_votes
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own votes" ON gettit_post_votes
  FOR UPDATE USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own votes" ON gettit_post_votes
  FOR DELETE USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Drop existing policies on gettit_comments
DROP POLICY IF EXISTS "Authenticated users can comment" ON gettit_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON gettit_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON gettit_comments;

-- Create corrected policies for gettit_comments
CREATE POLICY "Authenticated users can comment" ON gettit_comments
  FOR INSERT WITH CHECK (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own comments" ON gettit_comments
  FOR UPDATE USING (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own comments" ON gettit_comments
  FOR DELETE USING (
    author_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Drop existing policies on gettit_comment_votes
DROP POLICY IF EXISTS "Authenticated users can vote on comments" ON gettit_comment_votes;
DROP POLICY IF EXISTS "Users can update own comment votes" ON gettit_comment_votes;
DROP POLICY IF EXISTS "Users can delete own comment votes" ON gettit_comment_votes;

-- Create corrected policies for gettit_comment_votes
CREATE POLICY "Authenticated users can vote on comments" ON gettit_comment_votes
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own comment votes" ON gettit_comment_votes
  FOR UPDATE USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own comment votes" ON gettit_comment_votes
  FOR DELETE USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );