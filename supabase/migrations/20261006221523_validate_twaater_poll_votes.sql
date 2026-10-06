create or replace function public.validate_twaater_poll_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_expires_at timestamptz;
begin
  select p.expires_at
  into v_expires_at
  from public.twaater_polls p
  where p.id = new.poll_id;

  if v_expires_at is null then
    raise exception 'twaater_poll_not_found';
  end if;

  if v_expires_at <= now() then
    raise exception 'twaater_poll_closed';
  end if;

  if not exists (
    select 1
    from public.twaater_poll_options o
    where o.id = new.option_id
      and o.poll_id = new.poll_id
  ) then
    raise exception 'twaater_poll_option_mismatch';
  end if;

  return new;
end;
$function$;

drop trigger if exists validate_twaater_poll_vote_trigger on public.twaater_poll_votes;
create trigger validate_twaater_poll_vote_trigger
before insert on public.twaater_poll_votes
for each row execute function public.validate_twaater_poll_vote();
