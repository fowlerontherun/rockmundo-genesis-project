create unique index if not exists player_inbox_collaboration_invite_unique
  on public.player_inbox ((action_data->>'collaborationId'))
  where action_type = 'collaboration_invite'
    and action_data ? 'collaborationId';

create or replace function private.songwriting_collaboration_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitee_user_id uuid;
  v_inviter_profile_id uuid;
  v_inviter_name text;
  v_project_title text;
  v_compensation text;
begin
  select p.user_id
    into v_invitee_user_id
  from public.profiles p
  where p.id = new.invitee_profile_id;

  if v_invitee_user_id is null then
    raise exception 'Invitee profile has no owning user';
  end if;

  select sp.profile_id, sp.title
    into v_inviter_profile_id, v_project_title
  from public.songwriting_projects sp
  where sp.id = new.project_id;

  if v_inviter_profile_id is null
     or not exists (
       select 1
       from public.profiles owner_profile
       where owner_profile.id = v_inviter_profile_id
         and owner_profile.user_id = new.inviter_user_id
     ) then
    select p.id
      into v_inviter_profile_id
    from public.profiles p
    where p.user_id = new.inviter_user_id
      and coalesce(p.is_active, false)
      and p.died_at is null
    order by p.created_at desc
    limit 1;
  end if;

  select p.username
    into v_inviter_name
  from public.profiles p
  where p.id = v_inviter_profile_id;

  v_compensation := case new.compensation_type::text
    when 'flat_fee' then format('for $%s', trim(to_char(coalesce(new.flat_fee_amount, 0), 'FM9999999990')))
    when 'royalty' then format('for a %s%% royalty split', trim(to_char(coalesce(new.royalty_percentage, 0), 'FM999999990.##')))
    else 'as a co-writer'
  end;

  insert into public.player_inbox (
    user_id,
    category,
    priority,
    title,
    message,
    metadata,
    action_type,
    action_data,
    related_entity_type,
    related_entity_id
  ) values (
    v_invitee_user_id,
    'social'::public.inbox_category,
    'high'::public.inbox_priority,
    'Songwriting collaboration invite',
    format(
      '%s invited you to co-write "%s" %s.',
      coalesce(v_inviter_name, 'A player'),
      coalesce(v_project_title, 'Untitled'),
      v_compensation
    ),
    jsonb_build_object(
      'source', 'songwriting_collaboration',
      'profile_id', new.invitee_profile_id
    ),
    'collaboration_invite',
    jsonb_build_object(
      'collaborationId', new.id,
      'projectId', new.project_id
    ),
    'songwriting_collaboration',
    new.id
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function private.songwriting_collaboration_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_invitee_user_id uuid;
  v_payer_profile_id uuid;
  v_payer_cash bigint;
  v_invitee_cash bigint;
  v_fee bigint;
begin
  select p.user_id
    into v_invitee_user_id
  from public.profiles p
  where p.id = old.invitee_profile_id;

  if new.project_id is distinct from old.project_id
     or new.inviter_user_id is distinct from old.inviter_user_id
     or new.invitee_profile_id is distinct from old.invitee_profile_id
     or new.is_band_member is distinct from old.is_band_member
     or new.compensation_type is distinct from old.compensation_type
     or new.flat_fee_amount is distinct from old.flat_fee_amount
     or new.royalty_percentage is distinct from old.royalty_percentage then
    if v_actor = v_invitee_user_id then
      raise exception 'Invite terms cannot be changed by the invited player';
    end if;
  end if;

  new.fee_paid := old.fee_paid;

  if new.status is distinct from old.status then
    if old.status::text <> 'pending' then
      raise exception 'This collaboration invitation has already been resolved';
    end if;

    if new.status::text in ('accepted', 'declined') then
      if v_actor is null or v_actor is distinct from v_invitee_user_id then
        raise exception 'Only the invited player can accept or decline this collaboration';
      end if;

      new.responded_at := coalesce(new.responded_at, timezone('utc', now()));

      if new.status::text = 'accepted'
         and old.compensation_type::text = 'flat_fee'
         and coalesce(old.flat_fee_amount, 0) > 0 then

        v_fee := round(old.flat_fee_amount)::bigint;

        select sp.profile_id
          into v_payer_profile_id
        from public.songwriting_projects sp
        where sp.id = old.project_id;

        if v_payer_profile_id is null
           or not exists (
             select 1
             from public.profiles owner_profile
             where owner_profile.id = v_payer_profile_id
               and owner_profile.user_id = old.inviter_user_id
           ) then
          select p.id
            into v_payer_profile_id
          from public.profiles p
          where p.user_id = old.inviter_user_id
            and coalesce(p.is_active, false)
            and p.died_at is null
          order by p.created_at desc
          limit 1;
        end if;

        if v_payer_profile_id is null then
          raise exception 'Inviter profile could not be resolved';
        end if;

        select p.cash
          into v_payer_cash
        from public.profiles p
        where p.id = v_payer_profile_id
        for update;

        select p.cash
          into v_invitee_cash
        from public.profiles p
        where p.id = old.invitee_profile_id
        for update;

        if v_payer_cash is null or v_invitee_cash is null then
          raise exception 'Collaboration payment profile could not be resolved';
        end if;

        if v_payer_cash < v_fee then
          raise exception 'Inviter has insufficient funds for this collaboration offer';
        end if;

        update public.profiles
        set cash = cash - v_fee
        where id = v_payer_profile_id;

        update public.profiles
        set cash = cash + v_fee
        where id = old.invitee_profile_id;

        insert into public.collaboration_payments (
          collaboration_id,
          payer_user_id,
          payee_profile_id,
          amount,
          payment_type
        )
        select
          old.id,
          old.inviter_user_id,
          old.invitee_profile_id,
          old.flat_fee_amount,
          'flat_fee'
        where not exists (
          select 1
          from public.collaboration_payments cp
          where cp.collaboration_id = old.id
            and cp.payment_type = 'flat_fee'
        );

        new.fee_paid := true;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.songwriting_collaboration_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitee_user_id uuid;
  v_invitee_name text;
  v_inviter_profile_id uuid;
  v_project_title text;
begin
  if old.status::text = 'pending'
     and new.status::text in ('accepted', 'declined')
     and new.status is distinct from old.status then

    select p.user_id, p.username
      into v_invitee_user_id, v_invitee_name
    from public.profiles p
    where p.id = new.invitee_profile_id;

    select sp.profile_id, sp.title
      into v_inviter_profile_id, v_project_title
    from public.songwriting_projects sp
    where sp.id = new.project_id;

    if v_inviter_profile_id is null
       or not exists (
         select 1
         from public.profiles owner_profile
         where owner_profile.id = v_inviter_profile_id
           and owner_profile.user_id = new.inviter_user_id
       ) then
      select p.id
        into v_inviter_profile_id
      from public.profiles p
      where p.user_id = new.inviter_user_id
        and coalesce(p.is_active, false)
        and p.died_at is null
      order by p.created_at desc
      limit 1;
    end if;

    update public.player_inbox
    set is_read = true,
        is_archived = true
    where user_id = v_invitee_user_id
      and action_type = 'collaboration_invite'
      and action_data->>'collaborationId' = new.id::text;

    if v_inviter_profile_id is not null then
      insert into public.player_inbox (
        user_id,
        category,
        priority,
        title,
        message,
        metadata,
        action_type,
        action_data,
        related_entity_type,
        related_entity_id
      ) values (
        new.inviter_user_id,
        'social'::public.inbox_category,
        'normal'::public.inbox_priority,
        format('Collaboration invite %s', new.status::text),
        format(
          '%s %s your co-writing invitation for "%s".',
          coalesce(v_invitee_name, 'A player'),
          new.status::text,
          coalesce(v_project_title, 'Untitled')
        ),
        jsonb_build_object(
          'source', 'songwriting_collaboration',
          'profile_id', v_inviter_profile_id
        ),
        'navigate',
        jsonb_build_object('route', '/songwriting'),
        'songwriting_collaboration',
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists songwriting_collaboration_notify_insert
  on public.songwriting_collaborations;
create trigger songwriting_collaboration_notify_insert
after insert on public.songwriting_collaborations
for each row
execute function private.songwriting_collaboration_after_insert();

drop trigger if exists songwriting_collaboration_validate_response
  on public.songwriting_collaborations;
create trigger songwriting_collaboration_validate_response
before update on public.songwriting_collaborations
for each row
execute function private.songwriting_collaboration_before_update();

drop trigger if exists songwriting_collaboration_notify_response
  on public.songwriting_collaborations;
create trigger songwriting_collaboration_notify_response
after update on public.songwriting_collaborations
for each row
execute function private.songwriting_collaboration_after_update();

revoke all on function private.songwriting_collaboration_after_insert() from public, anon, authenticated;
revoke all on function private.songwriting_collaboration_before_update() from public, anon, authenticated;
revoke all on function private.songwriting_collaboration_after_update() from public, anon, authenticated;

update public.player_inbox i
set metadata = coalesce(i.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'source', 'songwriting_collaboration',
    'profile_id', c.invitee_profile_id
  ),
    related_entity_type = coalesce(i.related_entity_type, 'songwriting_collaboration'),
    related_entity_id = coalesce(i.related_entity_id, c.id)
from public.songwriting_collaborations c
where i.action_type = 'collaboration_invite'
  and i.action_data->>'collaborationId' = c.id::text
  and (
    i.metadata->>'profile_id' is distinct from c.invitee_profile_id::text
    or i.related_entity_id is null
  );

insert into public.player_inbox (
  user_id,
  category,
  priority,
  title,
  message,
  metadata,
  action_type,
  action_data,
  related_entity_type,
  related_entity_id
)
select
  invitee.user_id,
  'social'::public.inbox_category,
  'high'::public.inbox_priority,
  'Songwriting collaboration invite',
  format(
    '%s invited you to co-write "%s" %s.',
    coalesce(inviter.username, 'A player'),
    coalesce(sp.title, 'Untitled'),
    case c.compensation_type::text
      when 'flat_fee' then format('for $%s', trim(to_char(coalesce(c.flat_fee_amount, 0), 'FM9999999990')))
      when 'royalty' then format('for a %s%% royalty split', trim(to_char(coalesce(c.royalty_percentage, 0), 'FM999999990.##')))
      else 'as a co-writer'
    end
  ),
  jsonb_build_object(
    'source', 'songwriting_collaboration',
    'profile_id', c.invitee_profile_id
  ),
  'collaboration_invite',
  jsonb_build_object(
    'collaborationId', c.id,
    'projectId', c.project_id
  ),
  'songwriting_collaboration',
  c.id
from public.songwriting_collaborations c
join public.profiles invitee
  on invitee.id = c.invitee_profile_id
join public.songwriting_projects sp
  on sp.id = c.project_id
left join lateral (
  select p.username
  from public.profiles p
  where p.user_id = c.inviter_user_id
    and (
      p.id = sp.profile_id
      or (coalesce(p.is_active, false) and p.died_at is null)
    )
  order by (p.id = sp.profile_id) desc, p.created_at desc
  limit 1
) inviter on true
where c.status::text = 'pending'
  and not exists (
    select 1
    from public.player_inbox i
    where i.action_type = 'collaboration_invite'
      and i.action_data->>'collaborationId' = c.id::text
  );

notify pgrst, 'reload schema';
