create unique index if not exists twaater_polls_twaat_id_key
on public.twaater_polls (twaat_id);

drop index if exists public.idx_twaater_polls_twaat_id;

create or replace function public.create_twaater_poll_with_options(
  p_twaat_id uuid,
  p_question text,
  p_expires_at timestamptz,
  p_options text[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_poll_id uuid;
  v_option_count integer;
begin
  if p_question is null or length(trim(p_question)) = 0 then
    raise exception 'poll_question_required';
  end if;

  if length(trim(p_question)) > 200 then
    raise exception 'poll_question_too_long';
  end if;

  v_option_count := coalesce(array_length(p_options, 1), 0);
  if v_option_count < 2 or v_option_count > 4 then
    raise exception 'poll_options_must_be_2_to_4';
  end if;

  if exists (
    select 1
    from unnest(p_options) as option_text
    where option_text is null
       or length(trim(option_text)) = 0
       or length(trim(option_text)) > 50
  ) then
    raise exception 'invalid_poll_option';
  end if;

  insert into public.twaater_polls (twaat_id, question, expires_at)
  values (p_twaat_id, trim(p_question), p_expires_at)
  returning id into v_poll_id;

  insert into public.twaater_poll_options (poll_id, option_text, display_order)
  select
    v_poll_id,
    trim(option_text),
    ordinality::integer - 1
  from unnest(p_options) with ordinality as option_row(option_text, ordinality);

  return v_poll_id;
end;
$$;

revoke all on function public.create_twaater_poll_with_options(uuid,text,timestamptz,text[]) from public;
revoke all on function public.create_twaater_poll_with_options(uuid,text,timestamptz,text[]) from anon;
grant execute on function public.create_twaater_poll_with_options(uuid,text,timestamptz,text[]) to authenticated;
