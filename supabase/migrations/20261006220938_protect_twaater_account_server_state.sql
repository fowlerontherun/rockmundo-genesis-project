create or replace function public.protect_twaater_account_server_state()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_trusted boolean := current_user in ('postgres', 'service_role');
begin
  if v_trusted then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified := false;
    new.fame_score := 0;
    new.follower_count := 0;
    new.following_count := 0;
    new.profile_views := 0;
    new.posts_today := 0;
    new.last_post_at := null;
    new.followers_gained_today := 0;
    new.last_follower_reset := now();
    new.engagement_score := 0;
    new.quality_rating := 1.0;
    return new;
  end if;

  new.owner_type := old.owner_type;
  new.owner_id := old.owner_id;
  new.verified := old.verified;
  new.fame_score := old.fame_score;
  new.follower_count := old.follower_count;
  new.following_count := old.following_count;
  new.created_at := old.created_at;
  new.profile_views := old.profile_views;
  new.posts_today := old.posts_today;
  new.last_post_at := old.last_post_at;
  new.followers_gained_today := old.followers_gained_today;
  new.last_follower_reset := old.last_follower_reset;
  new.engagement_score := old.engagement_score;
  new.quality_rating := old.quality_rating;

  return new;
end;
$function$;

drop trigger if exists protect_twaater_account_server_state_trigger on public.twaater_accounts;
create trigger protect_twaater_account_server_state_trigger
before insert or update on public.twaater_accounts
for each row execute function public.protect_twaater_account_server_state();
