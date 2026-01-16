-- Create RPC functions for Gettit voting
CREATE OR REPLACE FUNCTION increment_gettit_vote(post_id uuid, vote_field text)
RETURNS void AS $$
BEGIN
  IF vote_field = 'upvotes' THEN
    UPDATE gettit_posts SET upvotes = upvotes + 1 WHERE id = post_id;
  ELSIF vote_field = 'downvotes' THEN
    UPDATE gettit_posts SET downvotes = downvotes + 1 WHERE id = post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_gettit_vote(post_id uuid, vote_field text)
RETURNS void AS $$
BEGIN
  IF vote_field = 'upvotes' THEN
    UPDATE gettit_posts SET upvotes = GREATEST(0, upvotes - 1) WHERE id = post_id;
  ELSIF vote_field = 'downvotes' THEN
    UPDATE gettit_posts SET downvotes = GREATEST(0, downvotes - 1) WHERE id = post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION swap_gettit_vote(post_id uuid, old_field text, new_field text)
RETURNS void AS $$
BEGIN
  -- Decrement old field
  IF old_field = 'upvotes' THEN
    UPDATE gettit_posts SET upvotes = GREATEST(0, upvotes - 1) WHERE id = post_id;
  ELSIF old_field = 'downvotes' THEN
    UPDATE gettit_posts SET downvotes = GREATEST(0, downvotes - 1) WHERE id = post_id;
  END IF;
  
  -- Increment new field
  IF new_field = 'upvotes' THEN
    UPDATE gettit_posts SET upvotes = upvotes + 1 WHERE id = post_id;
  ELSIF new_field = 'downvotes' THEN
    UPDATE gettit_posts SET downvotes = downvotes + 1 WHERE id = post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment vote functions
CREATE OR REPLACE FUNCTION increment_gettit_comment_vote(comment_id uuid, vote_field text)
RETURNS void AS $$
BEGIN
  IF vote_field = 'upvotes' THEN
    UPDATE gettit_comments SET upvotes = upvotes + 1 WHERE id = comment_id;
  ELSIF vote_field = 'downvotes' THEN
    UPDATE gettit_comments SET downvotes = downvotes + 1 WHERE id = comment_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_gettit_comment_vote(comment_id uuid, vote_field text)
RETURNS void AS $$
BEGIN
  IF vote_field = 'upvotes' THEN
    UPDATE gettit_comments SET upvotes = GREATEST(0, upvotes - 1) WHERE id = comment_id;
  ELSIF vote_field = 'downvotes' THEN
    UPDATE gettit_comments SET downvotes = GREATEST(0, downvotes - 1) WHERE id = comment_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION swap_gettit_comment_vote(comment_id uuid, old_field text, new_field text)
RETURNS void AS $$
BEGIN
  IF old_field = 'upvotes' THEN
    UPDATE gettit_comments SET upvotes = GREATEST(0, upvotes - 1) WHERE id = comment_id;
  ELSIF old_field = 'downvotes' THEN
    UPDATE gettit_comments SET downvotes = GREATEST(0, downvotes - 1) WHERE id = comment_id;
  END IF;
  
  IF new_field = 'upvotes' THEN
    UPDATE gettit_comments SET upvotes = upvotes + 1 WHERE id = comment_id;
  ELSIF new_field = 'downvotes' THEN
    UPDATE gettit_comments SET downvotes = downvotes + 1 WHERE id = comment_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;