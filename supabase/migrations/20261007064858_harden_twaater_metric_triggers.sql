create or replace function public.update_twaat_metrics_from_reaction()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.reaction_type = 'like' then
      insert into public.twaat_metrics (twaat_id, likes, updated_at)
      values (new.twaat_id, 1, now())
      on conflict (twaat_id) do update
      set likes = coalesce(public.twaat_metrics.likes, 0) + 1,
          updated_at = now();
    elsif new.reaction_type = 'retwaat' then
      insert into public.twaat_metrics (twaat_id, retwaats, updated_at)
      values (new.twaat_id, 1, now())
      on conflict (twaat_id) do update
      set retwaats = coalesce(public.twaat_metrics.retwaats, 0) + 1,
          updated_at = now();
    end if;
  elsif tg_op = 'DELETE' then
    if old.reaction_type = 'like' then
      update public.twaat_metrics
      set likes = greatest(0, coalesce(likes, 0) - 1),
          updated_at = now()
      where twaat_id = old.twaat_id;
    elsif old.reaction_type = 'retwaat' then
      update public.twaat_metrics
      set retwaats = greatest(0, coalesce(retwaats, 0) - 1),
          updated_at = now()
      where twaat_id = old.twaat_id;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.update_twaat_reply_count()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      insert into public.twaat_metrics (twaat_id, replies, updated_at)
      values (new.parent_twaat_id, 1, now())
      on conflict (twaat_id) do update
      set replies = coalesce(public.twaat_metrics.replies, 0) + 1,
          updated_at = now();
    end if;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.twaat_metrics
      set replies = greatest(0, coalesce(replies, 0) - 1),
          updated_at = now()
      where twaat_id = old.parent_twaat_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      insert into public.twaat_metrics (twaat_id, replies, updated_at)
      values (new.parent_twaat_id, 1, now())
      on conflict (twaat_id) do update
      set replies = coalesce(public.twaat_metrics.replies, 0) + 1,
          updated_at = now();
    end if;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      update public.twaat_metrics
      set replies = greatest(0, coalesce(replies, 0) - 1),
          updated_at = now()
      where twaat_id = old.parent_twaat_id;
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trigger_update_reply_count on public.twaat_replies;
create trigger trigger_update_reply_count
after insert or delete or update of deleted_at on public.twaat_replies
for each row
execute function public.update_twaat_reply_count();

with reaction_counts as (
  select
    twaat_id,
    count(*) filter (where reaction_type = 'like')::integer as likes,
    count(*) filter (where reaction_type = 'retwaat')::integer as retwaats
  from public.twaater_reactions
  group by twaat_id
),
reply_counts as (
  select
    parent_twaat_id as twaat_id,
    count(*) filter (where deleted_at is null)::integer as replies
  from public.twaat_replies
  group by parent_twaat_id
),
actual as (
  select
    t.id as twaat_id,
    coalesce(r.likes, 0) as likes,
    coalesce(r.retwaats, 0) as retwaats,
    coalesce(p.replies, 0) as replies
  from public.twaats t
  left join reaction_counts r on r.twaat_id = t.id
  left join reply_counts p on p.twaat_id = t.id
  where t.outcome_code is null
)
update public.twaat_metrics m
set
  likes = a.likes,
  retwaats = a.retwaats,
  replies = a.replies,
  updated_at = now()
from actual a
where m.twaat_id = a.twaat_id
  and (
    coalesce(m.likes, 0) <> a.likes
    or coalesce(m.retwaats, 0) <> a.retwaats
    or coalesce(m.replies, 0) <> a.replies
  );
