insert into public.game_balance_config (category, key, value, description, min_value, max_value, unit)
values
  ('twaater_engagement', 'twaater_xp_per_rewarded_post', 5, 'XP awarded for each rewarded Twaat', 0, 50, 'XP'),
  ('twaater_engagement', 'twaater_daily_reward_limit', 3, 'Number of Twaats per day that earn posting XP', 1, 20, 'posts')
on conflict (key) do nothing;

create or replace function public.award_daily_twaat_xp()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  today_date date;
  current_twaats integer;
  current_xp integer;
  xp_to_award integer;
  xp_per_post integer := 5;
  reward_limit integer := 3;
begin
  if new.scheduled_for is not null then
    return new;
  end if;

  select coalesce(value, 5)::integer into xp_per_post
  from public.game_balance_config
  where key = 'twaater_xp_per_rewarded_post'
  limit 1;

  select coalesce(value, 3)::integer into reward_limit
  from public.game_balance_config
  where key = 'twaater_daily_reward_limit'
  limit 1;

  xp_per_post := coalesce(xp_per_post, 5);
  reward_limit := greatest(1, coalesce(reward_limit, 3));
  today_date := current_date;

  insert into public.twaater_daily_awards (account_id, date, twaats_awarded, xp_awarded)
  values (new.account_id, today_date, 0, 0)
  on conflict (account_id, date) do nothing;

  select twaats_awarded, xp_awarded into current_twaats, current_xp
  from public.twaater_daily_awards
  where account_id = new.account_id and date = today_date;

  if current_twaats < reward_limit then
    xp_to_award := xp_per_post;

    if new.linked_type is not null then
      xp_to_award := xp_to_award + 2;
    end if;

    update public.twaater_daily_awards
    set twaats_awarded = current_twaats + 1,
        xp_awarded = current_xp + xp_to_award
    where account_id = new.account_id and date = today_date;

    if new.account_id in (select id from public.twaater_accounts where owner_type = 'persona') then
      update public.profiles
      set experience = coalesce(experience, 0) + xp_to_award
      where id = (select owner_id from public.twaater_accounts where id = new.account_id);
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.check_twaat_content()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  hit record;
  max_length integer := 500;
begin
  select coalesce(value, 500)::integer into max_length
  from public.game_balance_config
  where key = 'twaater_max_length'
  limit 1;

  max_length := greatest(1, coalesce(max_length, 500));

  if char_length(new.body) > max_length then
    raise exception 'twaat_exceeds_max_length';
  end if;

  select w.word, w.auto_action into hit
  from public.twaater_filter_words w
  where new.body ilike '%' || w.word || '%'
  order by case w.auto_action when 'reject' then 1 when 'hide' then 2 else 3 end
  limit 1;

  if hit.word is null then
    return new;
  end if;

  if hit.auto_action = 'reject' then
    raise exception 'twaat_rejected_by_content_filter';
  elsif hit.auto_action = 'hide' then
    new.moderation_status := 'hidden';
    new.is_flagged := true;
    new.flag_reason := 'Automatic filter: ' || hit.word;
  else
    new.is_flagged := true;
    new.flag_reason := 'Automatic filter: ' || hit.word;
  end if;

  return new;
end;
$function$;
