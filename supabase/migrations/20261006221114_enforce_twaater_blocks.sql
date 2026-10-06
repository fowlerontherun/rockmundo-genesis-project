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
    where b.blocked_account_id = _account_id
      and public.twaater_account_is_mine(b.blocker_account_id)
  );
$function$;

drop policy if exists "Blocked accounts hidden from twaats" on public.twaats;
create policy "Blocked accounts hidden from twaats"
on public.twaats
as restrictive
for select
to authenticated
using (not public.twaater_account_blocked_for_me(account_id));

drop policy if exists "Blocked accounts hidden from twaat replies" on public.twaat_replies;
create policy "Blocked accounts hidden from twaat replies"
on public.twaat_replies
as restrictive
for select
to authenticated
using (not public.twaater_account_blocked_for_me(account_id));

drop policy if exists "Blocked sources hidden from twaater notifications" on public.twaater_notifications;
create policy "Blocked sources hidden from twaater notifications"
on public.twaater_notifications
as restrictive
for select
to authenticated
using (
  source_account_id is null
  or not public.twaater_account_blocked_for_me(source_account_id)
);

drop policy if exists "Blocked senders hidden from twaater messages" on public.twaater_messages;
create policy "Blocked senders hidden from twaater messages"
on public.twaater_messages
as restrictive
for select
to authenticated
using (not public.twaater_account_blocked_for_me(sender_id));
