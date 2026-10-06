create or replace function public.check_twaat_content()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  hit record;
  max_length integer := 500;
  media_enabled boolean := true;
begin
  select coalesce(value, 500)::integer into max_length
  from public.game_balance_config
  where key = 'twaater_max_length'
  limit 1;

  select coalesce(value, 1) <> 0 into media_enabled
  from public.game_balance_config
  where key = 'twaater_media_enabled'
  limit 1;

  max_length := greatest(1, coalesce(max_length, 500));
  media_enabled := coalesce(media_enabled, true);

  if char_length(new.body) > max_length then
    raise exception 'twaat_exceeds_max_length';
  end if;

  if not media_enabled and new.media_url is not null then
    raise exception 'twaater_media_disabled';
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

create or replace function public.enforce_twaater_poll_feature()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  polls_enabled boolean := true;
begin
  select coalesce(value, 1) <> 0 into polls_enabled
  from public.game_balance_config
  where key = 'twaater_polls_enabled'
  limit 1;

  if not coalesce(polls_enabled, true) then
    raise exception 'twaater_polls_disabled';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_twaater_poll_feature_trigger on public.twaater_polls;
create trigger enforce_twaater_poll_feature_trigger
before insert on public.twaater_polls
for each row execute function public.enforce_twaater_poll_feature();
