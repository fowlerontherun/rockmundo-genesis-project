-- Authoritative, perishable cooked-food consumption and capped, non-stacking
-- food effect windows. This does NOT modify experience/health/gameplay equations:
-- effect consumers must call get_active_cooking_food_percent() at settlement.
-- All recipes and market offers remain deliberately inactive during integration.
create table if not exists public.cooking_recipe_effects (
 recipe_slug text primary key references public.cooking_recipes(slug) on delete cascade,
 effect_slug text not null check (effect_slug in (
  'recovery','practice_xp','rehearsal','songwriting_polish','focus')),
 max_percent integer not null default 5 check (max_percent between 1 and 5),
 duration_hours integer not null check (duration_hours between 1 and 6)
);
create table if not exists public.cooking_food_consumptions (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 food_batch_id uuid not null references public.cooking_food_batches(id) on delete cascade,
 recipe_slug text not null,
 quality integer not null check (quality between 0 and 100),
 remaining_portions integer not null check (remaining_portions between 0 and 1000),
 effect_slug text,
 effect_percent integer not null default 0 check (effect_percent between 0 and 5),
 effect_applied boolean not null default false,
 effect_expires_at timestamptz,
 consumed_at timestamptz not null default clock_timestamp(),
 constraint cooking_food_effect_receipt_consistency check (
  (effect_applied is false or (effect_slug is not null
    and effect_percent>0 and effect_expires_at>consumed_at))
 )
);
create index if not exists cooking_food_consumptions_profile
 on public.cooking_food_consumptions(profile_id,consumed_at desc);
create table if not exists public.cooking_active_food_effects (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 effect_slug text not null check (effect_slug in (
  'recovery','practice_xp','rehearsal','songwriting_polish','focus')),
 effect_percent integer not null check (effect_percent between 1 and 5),
 started_at timestamptz not null,
 expires_at timestamptz not null,
 source_consumption_id uuid not null references public.cooking_food_consumptions(id),
 primary key(profile_id,effect_slug),
 constraint cooking_active_food_window check(expires_at>started_at)
);
create index if not exists cooking_active_food_effects_expiry
 on public.cooking_active_food_effects(expires_at);

alter table public.cooking_recipe_effects enable row level security;
alter table public.cooking_food_consumptions enable row level security;
alter table public.cooking_active_food_effects enable row level security;
do $policies$
begin
 if not exists(select 1 from pg_policies where schemaname='public'
   and tablename='cooking_recipe_effects' and policyname='View active cooking recipe effects') then
  create policy "View active cooking recipe effects"
   on public.cooking_recipe_effects for select to authenticated
   using(exists(select 1 from public.cooking_recipes r
     where r.slug=recipe_slug and r.is_active));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public'
   and tablename='cooking_food_consumptions' and policyname='View own food consumptions') then
  create policy "View own food consumptions"
   on public.cooking_food_consumptions for select to authenticated
   using(exists(select 1 from public.profiles p where p.id=profile_id
     and p.user_id=(select auth.uid())));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public'
   and tablename='cooking_active_food_effects' and policyname='View own food effects') then
  create policy "View own food effects" on public.cooking_active_food_effects
   for select to authenticated using(exists(select 1 from public.profiles p
     where p.id=profile_id and p.user_id=(select auth.uid())));
 end if;
end $policies$;
revoke all on public.cooking_recipe_effects,public.cooking_food_consumptions,
 public.cooking_active_food_effects from public,anon,authenticated;
grant select on public.cooking_recipe_effects,public.cooking_food_consumptions,
 public.cooking_active_food_effects to authenticated;

insert into public.cooking_recipe_effects(recipe_slug,effect_slug,duration_hours) values
 ('vegetable-soup','recovery',3),
 ('onion-soup','recovery',3),
 ('tomato-soup','recovery',3),
 ('lentil-stew','practice_xp',3),
 ('apple-pie','rehearsal',3),
 ('fruit-tart','songwriting_polish',2),
 ('citrus-cake','songwriting_polish',2),
 ('tea-cakes','songwriting_polish',2),
 ('rice-bowl','rehearsal',3),
 ('bean-stew','practice_xp',3),
 ('spiced-tea','focus',2),
 ('fruit-drink','recovery',2)
on conflict(recipe_slug) do nothing;

-- Consuming already-paid/crafted food is allowed only for the logged-in,
-- living, active player character; browser-supplied quality, time, boost,
-- percentages and recipe identities are never trusted.
create or replace function cooking_internal.consume_cooking_food_atomic(
 p_profile_id uuid,p_food_batch_id uuid,p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $consume$
declare
 v_owner uuid:=auth.uid();
 v_profile public.profiles%rowtype;
 v_receipt public.cooking_food_consumptions%rowtype;
 v_batch public.cooking_food_batches%rowtype;
 v_spec public.cooking_recipe_effects%rowtype;
 v_existing public.cooking_active_food_effects%rowtype;
 v_now timestamptz;
 v_remaining integer;
 v_effect_percent integer:=0;
 v_effect_applied boolean:=false;
 v_expires timestamptz;
 v_receipt_id uuid;
begin
 if v_owner is null or p_profile_id is null or p_food_batch_id is null
    or p_request_id is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   raise exception 'COOKING_FOOD_AUTH_REQUIRED' using errcode='42501';
 end if;
 -- A profile lock serializes multiple attempts and unknown-outcome retries.
 select * into v_profile from public.profiles
 where id=p_profile_id and user_id=v_owner
   and is_active is true and deleted_at is null and died_at is null
 for update;
 if not found then
   raise exception 'COOKING_FOOD_PROFILE_NOT_OWNED' using errcode='42501';
 end if;
 select * into v_receipt from public.cooking_food_consumptions
 where request_id=p_request_id;
 if found then
   if v_receipt.profile_id is distinct from p_profile_id
     or v_receipt.food_batch_id is distinct from p_food_batch_id then
     raise exception 'COOKING_FOOD_REQUEST_CONFLICT' using errcode='22023';
   end if;
   return pg_catalog.jsonb_build_object('status','already_completed',
     'consumptionId',v_receipt.id,'remainingPortions',v_receipt.remaining_portions,
     'effectSlug',v_receipt.effect_slug,'effectPercent',v_receipt.effect_percent,
     'effectApplied',v_receipt.effect_applied,
     'effectExpiresAt',v_receipt.effect_expires_at);
 end if;
 select * into v_batch from public.cooking_food_batches
 where id=p_food_batch_id and profile_id=p_profile_id for update;
 v_now:=clock_timestamp();
 if not found or v_batch.portions<1 or v_batch.expires_at<=v_now
   or v_batch.prepared_at>v_now then
   raise exception 'COOKING_FOOD_EXPIRED_OR_UNAVAILABLE' using errcode='22023';
 end if;

 select * into v_spec from public.cooking_recipe_effects
   where recipe_slug=v_batch.recipe_slug;
 -- A missing effect definition cannot mint an arbitrary buff.
 if not found then raise exception 'COOKING_FOOD_RECIPE_EFFECT_MISSING'; end if;
 -- Only clean, sufficiently high quality food grants effects.
 v_effect_percent:=case when v_batch.quality<40 then 0
    else least(v_spec.max_percent,
      greatest(1,round(v_spec.max_percent*v_batch.quality::numeric/100)::integer))
   end;

 if v_effect_percent>0 then
   select * into v_existing from public.cooking_active_food_effects
      where profile_id=p_profile_id and effect_slug=v_spec.effect_slug for update;
   if not found or v_existing.expires_at<=v_now then
     v_effect_applied:=true;
     v_expires:=v_now+make_interval(hours=>v_spec.duration_hours);
   end if;
 end if;

 update public.cooking_food_batches set portions=portions-1
 where id=v_batch.id and profile_id=p_profile_id
   and portions>0 and expires_at>v_now
 returning portions into v_remaining;
 if not found then raise exception 'COOKING_FOOD_CONCURRENT_DEBIT'; end if;

 insert into public.cooking_food_consumptions(
   request_id,profile_id,food_batch_id,recipe_slug,quality,remaining_portions,
   effect_slug,effect_percent,effect_applied,effect_expires_at,consumed_at
 ) values(
   p_request_id,p_profile_id,v_batch.id,v_batch.recipe_slug,v_batch.quality,
   v_remaining,v_spec.effect_slug,v_effect_percent,v_effect_applied,v_expires,v_now
 ) returning id into v_receipt_id;

 -- Non-stacking: an already active same-type benefit is neither replaced
 -- nor extended. Food is still consumed, explicitly reflected in receipt.
 if v_effect_applied then
   insert into public.cooking_active_food_effects(
     profile_id,effect_slug,effect_percent,started_at,expires_at,source_consumption_id)
   values(p_profile_id,v_spec.effect_slug,v_effect_percent,v_now,v_expires,v_receipt_id)
   on conflict(profile_id,effect_slug) do update
     set effect_percent=excluded.effect_percent,
         started_at=excluded.started_at,expires_at=excluded.expires_at,
         source_consumption_id=excluded.source_consumption_id
     where cooking_active_food_effects.expires_at<=excluded.started_at;
 end if;

 return pg_catalog.jsonb_build_object('status','completed',
   'consumptionId',v_receipt_id,'remainingPortions',v_remaining,
   'effectSlug',v_spec.effect_slug,'effectPercent',v_effect_percent,
   'effectApplied',v_effect_applied,'effectExpiresAt',v_expires);
end
$consume$;
revoke all on function cooking_internal.consume_cooking_food_atomic(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function cooking_internal.consume_cooking_food_atomic(uuid,uuid,uuid)
 to authenticated;
create or replace function public.consume_cooking_food_atomic(
 p_profile_id uuid,p_food_batch_id uuid,p_request_id uuid
) returns jsonb language sql security invoker set search_path=''
as $wrapper$
 select cooking_internal.consume_cooking_food_atomic(
   p_profile_id,p_food_batch_id,p_request_id);
$wrapper$;
revoke all on function public.consume_cooking_food_atomic(uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.consume_cooking_food_atomic(uuid,uuid,uuid)
 to authenticated;

-- The canonical time-window lookup for future server-side XP and healing
-- settlement paths. This does not itself apply a gameplay modifier.
create or replace function public.get_active_cooking_food_percent(
 p_profile_id uuid,p_effect_slug text
) returns integer language sql stable security invoker set search_path=''
as $lookup$
 select coalesce((select b.effect_percent
 from public.cooking_active_food_effects b
 where b.profile_id=p_profile_id and b.effect_slug=p_effect_slug
 and b.started_at<=now() and b.expires_at>now()),0);
$lookup$;
revoke all on function public.get_active_cooking_food_percent(uuid,text)
 from public,anon,authenticated;
grant execute on function public.get_active_cooking_food_percent(uuid,text)
 to authenticated,service_role;
notify pgrst,'reload schema';
