-- Correct PL/pgSQL branch semantics: boolean expressions are not
-- guaranteed to short circuit, so expiry rows must never dereference the
-- sale-only destination_batch_id or buyer_profile_id fields.
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

  if TG_TABLE_NAME='cooking_food_stall_sales' then
    if not exists(
      select 1 from public.cooking_food_batches d
      where d.id=new.destination_batch_id and d.profile_id=new.buyer_profile_id
        and d.recipe_slug=v_recipe and d.quality=v_quality
        and d.expires_at=v_food_expiry
    ) then
      raise exception 'COOKING_STALL_RECEIPT_DESTINATION_MISMATCH'
        using errcode='23514';
    end if;
  end if;

  new.recipe_slug:=v_recipe;
  new.quality:=v_quality;
  new.food_expires_at:=v_food_expiry;
  return new;
end;
$receipt$;
revoke all on function public.fill_cooking_stall_receipt_food_provenance()
  from public,anon,authenticated;
