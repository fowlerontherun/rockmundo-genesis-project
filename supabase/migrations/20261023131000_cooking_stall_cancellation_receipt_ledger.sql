-- Explicit cancellation receipts make every fresh-food escrow return auditable.
-- Existing cron expirations remain in cooking_food_stall_expiry_events.
-- All writes are server-owned; sales_enabled remains false.
create table if not exists public.cooking_food_stall_cancellation_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.cooking_food_stall_listings(id) on delete restrict,
  seller_profile_id uuid not null references public.profiles(id) on delete restrict,
  returned_portions integer not null check (returned_portions between 1 and 1000),
  recipe_slug text not null,
  quality integer not null check (quality between 0 and 100),
  food_expires_at timestamptz not null,
  cancelled_at timestamptz not null default clock_timestamp()
);
alter table public.cooking_food_stall_cancellation_events enable row level security;
revoke all on public.cooking_food_stall_cancellation_events from public,anon,authenticated;
grant select on public.cooking_food_stall_cancellation_events to authenticated;
create policy "Players view own cancelled food stall listings"
  on public.cooking_food_stall_cancellation_events for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id=seller_profile_id and p.user_id=(select auth.uid())
  ));
create index if not exists cooking_stall_cancellations_seller_time
  on public.cooking_food_stall_cancellation_events(seller_profile_id,cancelled_at desc);

-- Reject tampering with source data and prevent later changes to receipts.
create or replace function public.guard_cooking_stall_cancellation_event()
returns trigger language plpgsql security definer set search_path=''
as $guard$
declare
  v_listing public.cooking_food_stall_listings%rowtype;
  v_batch public.cooking_food_batches%rowtype;
begin
  if TG_OP <> 'INSERT' then
    raise exception 'COOKING_STALL_CANCELLATION_IMMUTABLE' using errcode='42501';
  end if;
  select * into v_listing from public.cooking_food_stall_listings
    where id=new.listing_id and seller_profile_id=new.seller_profile_id;
  if not found or v_listing.status<>'cancelled' then
    raise exception 'COOKING_STALL_CANCELLATION_INVALID_LISTING'
      using errcode='23514';
  end if;
  select * into v_batch from public.cooking_food_batches
    where id=v_listing.food_batch_id and profile_id=v_listing.seller_profile_id;
  if not found or v_batch.expires_at<=new.cancelled_at
    or new.returned_portions>v_listing.portions_reserved then
    raise exception 'COOKING_STALL_CANCELLATION_INVALID_RETURN'
      using errcode='23514';
  end if;
  new.recipe_slug:=v_batch.recipe_slug;
  new.quality:=v_batch.quality;
  new.food_expires_at:=v_batch.expires_at;
  return new;
end;
$guard$;
drop trigger if exists cooking_stall_cancellation_receipt_guard
 on public.cooking_food_stall_cancellation_events;
create trigger cooking_stall_cancellation_receipt_guard
before insert or update or delete on public.cooking_food_stall_cancellation_events
for each row execute function public.guard_cooking_stall_cancellation_event();
revoke all on function public.guard_cooking_stall_cancellation_event()
 from public,anon,authenticated;

-- Keep the existing authenticated invoker-wrapper; change only the private
-- settlement implementation. Cancellation is available during a release pause.
create or replace function cooking_internal.cancel_cooking_food_stall_listing(
 p_profile_id uuid,p_listing_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $cancel$
declare
 v_profile public.profiles%rowtype;
 v_listing public.cooking_food_stall_listings%rowtype;
 v_batch public.cooking_food_batches%rowtype;
 v_now timestamptz;
 v_returned integer := 0;
 v_status text;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or p_profile_id is null or p_listing_id is null then
   raise exception 'COOKING_STALL_AUTH_REQUIRED' using errcode='42501';
 end if;
 select * into v_profile from public.profiles where id=p_profile_id
   and user_id=auth.uid() and is_active=true and deleted_at is null and died_at is null
 for update;
 if not found then raise exception 'COOKING_STALL_NOT_OWNED' using errcode='42501'; end if;
 select * into v_listing from public.cooking_food_stall_listings
   where id=p_listing_id and seller_profile_id=p_profile_id for update;
 if not found then raise exception 'COOKING_STALL_NOT_OWNED' using errcode='42501'; end if;
 if v_listing.status <> 'open' then
   return pg_catalog.jsonb_build_object('status','already_closed',
     'listingId',v_listing.id,'listingStatus',v_listing.status);
 end if;
 v_now:=clock_timestamp();
 select * into v_batch from public.cooking_food_batches
   where id=v_listing.food_batch_id and profile_id=p_profile_id for update;
 if not found then raise exception 'COOKING_STALL_SOURCE_BATCH_MISSING'; end if;
 if v_now<v_batch.expires_at and v_now<v_listing.expires_at then
   update public.cooking_food_batches set portions=portions+v_listing.portions_remaining
   where id=v_batch.id and portions+v_listing.portions_remaining<=1000;
   if not found then raise exception 'COOKING_STALL_ESCROW_RETURN_FAILED'; end if;
   v_returned:=v_listing.portions_remaining;
   v_status:='cancelled';
 else
   -- If listing timed out but the food has not spoiled, unsold food can
   -- still be recovered; listing expiry itself does not spoil a batch.
   if v_now<v_batch.expires_at then
     update public.cooking_food_batches set portions=portions+v_listing.portions_remaining
     where id=v_batch.id and portions+v_listing.portions_remaining<=1000;
     if not found then raise exception 'COOKING_STALL_ESCROW_RETURN_FAILED'; end if;
     v_returned:=v_listing.portions_remaining;
   end if;
   v_status:='expired';
 end if;
 update public.cooking_food_stall_listings
 set status=v_status,portions_remaining=0,closed_at=v_now
 where id=v_listing.id;
 -- Persist the inventory return in the same transaction as the status change.
 -- Manual recovery of an expired listing must be visible in the expiry ledger.
 if v_status='cancelled' then
   insert into public.cooking_food_stall_cancellation_events(
     listing_id,seller_profile_id,returned_portions,recipe_slug,
     quality,food_expires_at,cancelled_at)
   values(v_listing.id,p_profile_id,v_returned,v_batch.recipe_slug,
     v_batch.quality,v_batch.expires_at,v_now);
 else
   insert into public.cooking_food_stall_expiry_events(
     listing_id,seller_profile_id,returned_portions,spoiled_portions,processed_at)
   values(v_listing.id,p_profile_id,v_returned,
     v_listing.portions_remaining-v_returned,v_now);
 end if;
 return pg_catalog.jsonb_build_object('status','closed','listingId',v_listing.id,
  'listingStatus',v_status,'returnedPortions',v_returned);
end;
$cancel$;


revoke all on function cooking_internal.cancel_cooking_food_stall_listing(uuid,uuid)
 from public,anon,authenticated;
grant execute on function cooking_internal.cancel_cooking_food_stall_listing(uuid,uuid)
 to authenticated;
notify pgrst,'reload schema';
