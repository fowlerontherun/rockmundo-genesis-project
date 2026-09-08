create or replace function public.validate_merch_retail_price()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  requirement record;
begin
  select r.id, r.minimum_retail_price, r.recommended_retail_price
    into requirement
  from public.merch_item_requirements r
  where r.id = new.product_requirement_id
     or (new.product_requirement_id is null and r.item_type = new.item_type)
  order by (r.id = new.product_requirement_id) desc
  limit 1;

  if not found then
    raise exception 'No merchandise catalogue configuration exists for %', new.item_type;
  end if;

  new.product_requirement_id := coalesce(new.product_requirement_id, requirement.id);

  if coalesce(new.selling_price, 0) < requirement.minimum_retail_price then
    raise exception 'Selling price for % must be at least $% (recommended $%)',
      new.item_type, requirement.minimum_retail_price, requirement.recommended_retail_price;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_merch_retail_price on public.player_merchandise;
create trigger trg_validate_merch_retail_price
before insert or update of selling_price, item_type, product_requirement_id
on public.player_merchandise
for each row execute function public.validate_merch_retail_price();