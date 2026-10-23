-- Expire abandoned local-food listings with trusted row-lock ordering.
-- No purchases, refunds of cash, food minting, or policy activation.
create table if not exists public.cooking_food_stall_expiry_events (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null unique references public.cooking_food_stall_listings(id) on delete restrict,
 seller_profile_id uuid not null references public.profiles(id) on delete restrict,
 returned_portions integer not null check (returned_portions between 0 and 1000),
 spoiled_portions integer not null check (spoiled_portions between 0 and 1000),
 processed_at timestamptz not null default clock_timestamp(),
 constraint cooking_stall_expiry_quantity_exclusive check (
  returned_portions=0 or spoiled_portions=0
 )
);
alter table public.cooking_food_stall_expiry_events enable row level security;
revoke all on public.cooking_food_stall_expiry_events from public,anon,authenticated;
grant select on public.cooking_food_stall_expiry_events to authenticated;
create policy "Players read own food stall expiry events"
 on public.cooking_food_stall_expiry_events for select to authenticated
 using (exists (select 1 from public.profiles p
   where p.id=seller_profile_id and p.user_id=(select auth.uid())));

create or replace function public.expire_cooking_food_stall_listings(p_limit integer default 100)
returns integer language plpgsql security definer set search_path=''
as $cleanup$
declare
 v_row record;
 v_profile public.profiles%rowtype;
 v_listing public.cooking_food_stall_listings%rowtype;
 v_batch public.cooking_food_batches%rowtype;
 v_now timestamptz;
 v_returned integer;
 v_spoiled integer;
 v_closed integer:=0;
begin
 if p_limit is null or p_limit not between 1 and 500 then
   raise exception 'COOKING_STALL_EXPIRY_INVALID_LIMIT' using errcode='22023';
 end if;
 -- Candidate rows are read without locking. Order is profile -> listing ->
 -- source batch, matching existing cancellation and purchase lock ordering.
 for v_row in
   select l.id,l.seller_profile_id from public.cooking_food_stall_listings l
    join public.cooking_food_batches b on b.id=l.food_batch_id
   where l.status='open' and (
     l.expires_at<=clock_timestamp() or b.expires_at<=clock_timestamp())
   order by l.expires_at,l.id
   limit p_limit*4
 loop
   exit when v_closed>=p_limit;
   select * into v_profile from public.profiles p
     where p.id=v_row.seller_profile_id for update skip locked;
   if not found then continue; end if;
   select * into v_listing from public.cooking_food_stall_listings l
     where l.id=v_row.id for update skip locked;
   if not found or v_listing.status<>'open'
     or v_listing.seller_profile_id<>v_profile.id then continue; end if;
   select * into v_batch from public.cooking_food_batches b
     where b.id=v_listing.food_batch_id and b.profile_id=v_profile.id
     for update skip locked;
   if not found then continue; end if;
   v_now:=clock_timestamp();
   if v_listing.expires_at>v_now and v_batch.expires_at>v_now then continue; end if;
   if v_batch.expires_at>v_now then
     update public.cooking_food_batches set portions=portions+v_listing.portions_remaining
      where id=v_batch.id and portions+v_listing.portions_remaining<=1000;
     if not found then raise exception 'COOKING_STALL_EXPIRY_ESCROW_RETURN_FAILED'; end if;
     v_returned:=v_listing.portions_remaining;
     v_spoiled:=0;
   else
     -- Never revive food once the original batch is spoiled.
     v_returned:=0;
     v_spoiled:=v_listing.portions_remaining;
   end if;
   update public.cooking_food_stall_listings
    set status='expired',portions_remaining=0,closed_at=v_now
    where id=v_listing.id;
   insert into public.cooking_food_stall_expiry_events
     (listing_id,seller_profile_id,returned_portions,spoiled_portions,processed_at)
    values(v_listing.id,v_profile.id,v_returned,v_spoiled,v_now);
   v_closed:=v_closed+1;
 end loop;
 return v_closed;
end;
$cleanup$;
revoke all on function public.expire_cooking_food_stall_listings(integer)
 from public,anon,authenticated;
grant execute on function public.expire_cooking_food_stall_listings(integer) to service_role;

-- A scheduler runs as the trusted cron database role, never a browser.
do $schedule$
declare v_existing record;
begin
 if not has_function_privilege('service_role',
    'public.expire_cooking_food_stall_listings(integer)','EXECUTE')
   or has_function_privilege('authenticated',
    'public.expire_cooking_food_stall_listings(integer)','EXECUTE')
   or has_function_privilege('anon',
    'public.expire_cooking_food_stall_listings(integer)','EXECUTE') then
   raise exception 'COOKING_STALL_EXPIRY_FUNCTION_PRIVILEGE_DRIFT';
 end if;
 select jobid,schedule,command,active into v_existing from cron.job
   where jobname='rockmundo_cooking_food_stall_expiry' limit 1;
 if found then
   if v_existing.schedule is distinct from '* * * * *'
      or v_existing.command is distinct from
        'select public.expire_cooking_food_stall_listings(100);'
      or v_existing.active is distinct from true then
     raise exception 'COOKING_STALL_EXPIRY_CRON_DRIFT';
   end if;
 else
   perform cron.schedule('rockmundo_cooking_food_stall_expiry',
    '* * * * *','select public.expire_cooking_food_stall_listings(100);');
 end if;
end;
$schedule$;
