create or replace function public.update_follower_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.twaater_accounts
    set following_count = coalesce(following_count, 0) + 1
    where id = new.follower_account_id;

    update public.twaater_accounts
    set follower_count = coalesce(follower_count, 0) + 1
    where id = new.followed_account_id;
  elsif tg_op = 'DELETE' then
    update public.twaater_accounts
    set following_count = greatest(0, coalesce(following_count, 0) - 1)
    where id = old.follower_account_id;

    update public.twaater_accounts
    set follower_count = greatest(0, coalesce(follower_count, 0) - 1)
    where id = old.followed_account_id;
  end if;

  return null;
end;
$$;

update public.twaater_accounts a
set
  follower_count = (
    select count(*)::integer
    from public.twaater_follows f
    where f.followed_account_id = a.id
  ),
  following_count = (
    select count(*)::integer
    from public.twaater_follows f
    where f.follower_account_id = a.id
  );
