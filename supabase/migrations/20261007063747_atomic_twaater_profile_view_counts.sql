create or replace function public.increment_twaater_profile_view_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.twaater_accounts
  set profile_views = coalesce(profile_views, 0) + 1
  where id = new.viewed_account_id;

  return new;
end;
$$;

revoke all on function public.increment_twaater_profile_view_count() from public;
revoke all on function public.increment_twaater_profile_view_count() from anon;
revoke all on function public.increment_twaater_profile_view_count() from authenticated;

drop trigger if exists increment_twaater_profile_view_count_trigger
on public.twaater_profile_views;

create trigger increment_twaater_profile_view_count_trigger
after insert on public.twaater_profile_views
for each row
execute function public.increment_twaater_profile_view_count();
