-- Derive Gettit vote/comment/member counters from source rows so clients cannot spoof fame-impact scores.

create or replace function public.sync_gettit_post_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.vote_type = 'up' then
      update public.gettit_posts set upvotes = coalesce(upvotes, 0) + 1 where id = new.post_id;
    else
      update public.gettit_posts set downvotes = coalesce(downvotes, 0) + 1 where id = new.post_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.vote_type = 'up' then
      update public.gettit_posts set upvotes = greatest(0, coalesce(upvotes, 0) - 1) where id = old.post_id;
    else
      update public.gettit_posts set downvotes = greatest(0, coalesce(downvotes, 0) - 1) where id = old.post_id;
    end if;
    return old;
  end if;

  if old.post_id <> new.post_id then
    if old.vote_type = 'up' then
      update public.gettit_posts set upvotes = greatest(0, coalesce(upvotes, 0) - 1) where id = old.post_id;
    else
      update public.gettit_posts set downvotes = greatest(0, coalesce(downvotes, 0) - 1) where id = old.post_id;
    end if;

    if new.vote_type = 'up' then
      update public.gettit_posts set upvotes = coalesce(upvotes, 0) + 1 where id = new.post_id;
    else
      update public.gettit_posts set downvotes = coalesce(downvotes, 0) + 1 where id = new.post_id;
    end if;
  elsif old.vote_type is distinct from new.vote_type then
    if old.vote_type = 'up' then
      update public.gettit_posts
         set upvotes = greatest(0, coalesce(upvotes, 0) - 1),
             downvotes = coalesce(downvotes, 0) + 1
       where id = new.post_id;
    else
      update public.gettit_posts
         set downvotes = greatest(0, coalesce(downvotes, 0) - 1),
             upvotes = coalesce(upvotes, 0) + 1
       where id = new.post_id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_gettit_post_vote_counts() from public, anon, authenticated;

drop trigger if exists trg_sync_gettit_post_vote_counts on public.gettit_post_votes;
create trigger trg_sync_gettit_post_vote_counts
  after insert or update or delete on public.gettit_post_votes
  for each row execute function public.sync_gettit_post_vote_counts();

create or replace function public.sync_gettit_comment_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.vote_type = 'up' then
      update public.gettit_comments set upvotes = coalesce(upvotes, 0) + 1 where id = new.comment_id;
    else
      update public.gettit_comments set downvotes = coalesce(downvotes, 0) + 1 where id = new.comment_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.vote_type = 'up' then
      update public.gettit_comments set upvotes = greatest(0, coalesce(upvotes, 0) - 1) where id = old.comment_id;
    else
      update public.gettit_comments set downvotes = greatest(0, coalesce(downvotes, 0) - 1) where id = old.comment_id;
    end if;
    return old;
  end if;

  if old.comment_id <> new.comment_id then
    if old.vote_type = 'up' then
      update public.gettit_comments set upvotes = greatest(0, coalesce(upvotes, 0) - 1) where id = old.comment_id;
    else
      update public.gettit_comments set downvotes = greatest(0, coalesce(downvotes, 0) - 1) where id = old.comment_id;
    end if;

    if new.vote_type = 'up' then
      update public.gettit_comments set upvotes = coalesce(upvotes, 0) + 1 where id = new.comment_id;
    else
      update public.gettit_comments set downvotes = coalesce(downvotes, 0) + 1 where id = new.comment_id;
    end if;
  elsif old.vote_type is distinct from new.vote_type then
    if old.vote_type = 'up' then
      update public.gettit_comments
         set upvotes = greatest(0, coalesce(upvotes, 0) - 1),
             downvotes = coalesce(downvotes, 0) + 1
       where id = new.comment_id;
    else
      update public.gettit_comments
         set downvotes = greatest(0, coalesce(downvotes, 0) - 1),
             upvotes = coalesce(upvotes, 0) + 1
       where id = new.comment_id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_gettit_comment_vote_counts() from public, anon, authenticated;

drop trigger if exists trg_sync_gettit_comment_vote_counts on public.gettit_comment_votes;
create trigger trg_sync_gettit_comment_vote_counts
  after insert or update or delete on public.gettit_comment_votes
  for each row execute function public.sync_gettit_comment_vote_counts();

create or replace function public.sync_gettit_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.gettit_posts set comment_count = coalesce(comment_count, 0) + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.gettit_posts set comment_count = greatest(0, coalesce(comment_count, 0) - 1) where id = old.post_id;
    return old;
  elsif old.post_id is distinct from new.post_id then
    update public.gettit_posts set comment_count = greatest(0, coalesce(comment_count, 0) - 1) where id = old.post_id;
    update public.gettit_posts set comment_count = coalesce(comment_count, 0) + 1 where id = new.post_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_gettit_comment_count() from public, anon, authenticated;

drop trigger if exists trg_sync_gettit_comment_count on public.gettit_comments;
create trigger trg_sync_gettit_comment_count
  after insert or update of post_id or delete on public.gettit_comments
  for each row execute function public.sync_gettit_comment_count();

create or replace function public.sync_gettit_subreddit_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.gettit_subreddits set member_count = coalesce(member_count, 0) + 1 where id = new.subreddit_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.gettit_subreddits set member_count = greatest(0, coalesce(member_count, 0) - 1) where id = old.subreddit_id;
    return old;
  elsif old.subreddit_id is distinct from new.subreddit_id then
    update public.gettit_subreddits set member_count = greatest(0, coalesce(member_count, 0) - 1) where id = old.subreddit_id;
    update public.gettit_subreddits set member_count = coalesce(member_count, 0) + 1 where id = new.subreddit_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_gettit_subreddit_member_count() from public, anon, authenticated;

drop trigger if exists trg_sync_gettit_subreddit_member_count on public.gettit_subreddit_members;
create trigger trg_sync_gettit_subreddit_member_count
  after insert or update of subreddit_id or delete on public.gettit_subreddit_members
  for each row execute function public.sync_gettit_subreddit_member_count();

-- Backfill counters from the underlying rows.
update public.gettit_posts p
set upvotes = (select count(*)::integer from public.gettit_post_votes v where v.post_id = p.id and v.vote_type = 'up'),
    downvotes = (select count(*)::integer from public.gettit_post_votes v where v.post_id = p.id and v.vote_type = 'down'),
    comment_count = (select count(*)::integer from public.gettit_comments c where c.post_id = p.id and coalesce(c.is_deleted, false) = false);

update public.gettit_subreddits s
set member_count = (select count(*)::integer from public.gettit_subreddit_members m where m.subreddit_id = s.id);

-- Keep legacy RPC signatures for already-deployed clients. Counting now happens only from vote rows.
create or replace function public.increment_gettit_vote(post_id uuid, vote_field text)
returns void language plpgsql security invoker set search_path = public as $$ begin return; end; $$;
create or replace function public.decrement_gettit_vote(post_id uuid, vote_field text)
returns void language plpgsql security invoker set search_path = public as $$ begin return; end; $$;
create or replace function public.swap_gettit_vote(post_id uuid, old_field text, new_field text)
returns void language plpgsql security invoker set search_path = public as $$ begin return; end; $$;
create or replace function public.increment_gettit_comment_vote(comment_id uuid, vote_field text)
returns void language plpgsql security invoker set search_path = public as $$ begin return; end; $$;
create or replace function public.decrement_gettit_comment_vote(comment_id uuid, vote_field text)
returns void language plpgsql security invoker set search_path = public as $$ begin return; end; $$;
create or replace function public.swap_gettit_comment_vote(comment_id uuid, old_field text, new_field text)
returns void language plpgsql security invoker set search_path = public as $$ begin return; end; $$;

grant execute on function public.increment_gettit_vote(uuid, text) to authenticated;
grant execute on function public.decrement_gettit_vote(uuid, text) to authenticated;
grant execute on function public.swap_gettit_vote(uuid, text, text) to authenticated;
grant execute on function public.increment_gettit_comment_vote(uuid, text) to authenticated;
grant execute on function public.decrement_gettit_comment_vote(uuid, text) to authenticated;
grant execute on function public.swap_gettit_comment_vote(uuid, text, text) to authenticated;
revoke execute on function public.increment_gettit_vote(uuid, text) from anon;
revoke execute on function public.decrement_gettit_vote(uuid, text) from anon;
revoke execute on function public.swap_gettit_vote(uuid, text, text) from anon;
revoke execute on function public.increment_gettit_comment_vote(uuid, text) from anon;
revoke execute on function public.decrement_gettit_comment_vote(uuid, text) from anon;
revoke execute on function public.swap_gettit_comment_vote(uuid, text, text) from anon;
