create or replace function public.twaater_accounts_blocked(_account_a uuid, _account_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.twaater_blocks b
    where (b.blocker_account_id = _account_a and b.blocked_account_id = _account_b)
       or (b.blocker_account_id = _account_b and b.blocked_account_id = _account_a)
  );
$function$;

create or replace function public.twaater_account_blocked_for_me(_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select auth.uid() is not null and exists (
    select 1
    from public.twaater_blocks b
    where (
      public.twaater_account_is_mine(b.blocker_account_id)
      and b.blocked_account_id = _account_id
    ) or (
      public.twaater_account_is_mine(b.blocked_account_id)
      and b.blocker_account_id = _account_id
    )
  );
$function$;

drop policy if exists "Twaater blocks prevent follows" on public.twaater_follows;
create policy "Twaater blocks prevent follows"
on public.twaater_follows
as restrictive
for insert
to authenticated
with check (
  not public.twaater_accounts_blocked(follower_account_id, followed_account_id)
);

drop policy if exists "Twaater blocks prevent conversations" on public.twaater_conversations;
create policy "Twaater blocks prevent conversations"
on public.twaater_conversations
as restrictive
for insert
to authenticated
with check (
  not public.twaater_accounts_blocked(participant_1_id, participant_2_id)
);

drop policy if exists "Twaater blocks prevent messages" on public.twaater_messages;
create policy "Twaater blocks prevent messages"
on public.twaater_messages
as restrictive
for insert
to authenticated
with check (
  exists (
    select 1
    from public.twaater_conversations c
    where c.id = conversation_id
      and not public.twaater_accounts_blocked(c.participant_1_id, c.participant_2_id)
  )
);

create or replace function public.cleanup_twaater_block_relationships()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from public.twaater_follows
  where (follower_account_id = new.blocker_account_id and followed_account_id = new.blocked_account_id)
     or (follower_account_id = new.blocked_account_id and followed_account_id = new.blocker_account_id);

  return new;
end;
$function$;

drop trigger if exists cleanup_twaater_block_relationships_trigger on public.twaater_blocks;
create trigger cleanup_twaater_block_relationships_trigger
after insert on public.twaater_blocks
for each row execute function public.cleanup_twaater_block_relationships();
