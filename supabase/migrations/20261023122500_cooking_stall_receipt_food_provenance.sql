-- Immutable cooked-food provenance for owner-visible sale and spoilage receipts.
-- The existing service-only stall operations keep control of all writes.
-- All release controls, RLS rules, money movements and recipe statuses are unchanged.

alter table public.cooking_food_stall_sales
  add column if not exists recipe_slug text,
  add column if not exists quality integer,
  add column if not exists food_expires_at timestamptz;

alter table public.cooking_food_stall_expiry_events
  add column if not exists recipe_slug text,
  add column if not exists quality integer,
  add column if not exists food_expires_at timestamptz;

-- Restore any older records from the authoritative original batch, never from
-- an untrusted browser payload. Foreign keys on listing and batch prevent drift.
update public.cooking_food_stall_sales s
set recipe_slug=b.recipe_slug,quality=b.quality,food_expires_at=b.expires_at
from public.cooking_food_stall_listings l
join public.cooking_food_batches b on b.id=l.food_batch_id
where l.id=s.listing_id
  and (s.recipe_slug is distinct from b.recipe_slug
    or s.quality is distinct from b.quality
    or s.food_expires_at is distinct from b.expires_at);

update public.cooking_food_stall_expiry_events e
set recipe_slug=b.recipe_slug,quality=b.quality,food_expires_at=b.expires_at
from public.cooking_food_stall_listings l
join public.cooking_food_batches b on b.id=l.food_batch_id
where l.id=e.listing_id
  and (e.recipe_slug is distinct from b.recipe_slug
    or e.quality is distinct from b.quality
    or e.food_expires_at is distinct from b.expires_at);

alter table public.cooking_food_stall_sales
  alter column recipe_slug set not null,
  alter column quality set not null,
  alter column food_expires_at set not null;
alter table public.cooking_food_stall_expiry_events
  alter column recipe_slug set not null,
  alter column quality set not null,
  alter column food_expires_at set not null;

alter table public.cooking_food_stall_sales
  add constraint cooking_stall_sales_quality_valid check (quality between 0 and 100);
alter table public.cooking_food_stall_expiry_events
  add constraint cooking_stall_expiry_quality_valid check (quality between 0 and 100);

-- One trusted function derives the recipe from the original listed batch
-- on INSERT. For a sale, also verify the buyer's destination batch has the
-- same recipe, quality and unextended expiry as the seller's source batch.
create or replace function public.fill_cooking_stall_receipt_food_provenance()
returns trigger language plpgsql security definer set search_path = ''
as $receipt$
declare
  v_recipe text;
  v_quality integer;
  v_food_expiry timestamptz;
begin
  if TG_OP='UPDATE' then
    if (new.recipe_slug,new.quality,new.food_expires_at) is distinct from
       (old.recipe_slug,old.quality,old.food_expires_at) then
      raise exception 'COOKING_STALL_RECEIPT_PROVENANCE_IMMUTABLE'
        using errcode='42501';
    end if;
    return new;
  end if;

  select b.recipe_slug,b.quality,b.expires_at
    into v_recipe,v_quality,v_food_expiry
  from public.cooking_food_stall_listings l
  join public.cooking_food_batches b on b.id=l.food_batch_id
  where l.id=new.listing_id;
  if not found then
    raise exception 'COOKING_STALL_RECEIPT_SOURCE_MISSING'
      using errcode='23503';
  end if;

  if TG_TABLE_NAME='cooking_food_stall_sales' and not exists(
    select 1 from public.cooking_food_batches d
    where d.id=new.destination_batch_id and d.profile_id=new.buyer_profile_id
      and d.recipe_slug=v_recipe and d.quality=v_quality
      and d.expires_at=v_food_expiry
  ) then
    raise exception 'COOKING_STALL_RECEIPT_DESTINATION_MISMATCH'
      using errcode='23514';
  end if;

  new.recipe_slug:=v_recipe;
  new.quality:=v_quality;
  new.food_expires_at:=v_food_expiry;
  return new;
end;
$receipt$;

drop trigger if exists cooking_stall_receipt_sale_provenance
  on public.cooking_food_stall_sales;
create trigger cooking_stall_receipt_sale_provenance
before insert or update on public.cooking_food_stall_sales
for each row execute function public.fill_cooking_stall_receipt_food_provenance();

drop trigger if exists cooking_stall_receipt_expiry_provenance
  on public.cooking_food_stall_expiry_events;
create trigger cooking_stall_receipt_expiry_provenance
before insert or update on public.cooking_food_stall_expiry_events
for each row execute function public.fill_cooking_stall_receipt_food_provenance();

revoke all on function public.fill_cooking_stall_receipt_food_provenance()
  from public,anon,authenticated;

-- Read access is still explicitly limited to the existing per-character
-- row level security policies. No client UPDATE or INSERT grants are added.
notify pgrst,'reload schema';
