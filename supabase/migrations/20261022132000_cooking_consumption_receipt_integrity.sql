-- A food consumption is an immutable economic/action receipt. Removing a
-- leftover food batch must not erase the historical portion-consumption record.
-- Prevent accidental deletion instead of cascading historical receipts.
alter table public.cooking_food_consumptions
  drop constraint if exists cooking_food_consumptions_food_batch_id_fkey;
alter table public.cooking_food_consumptions
  add constraint cooking_food_consumptions_food_batch_id_fkey
  foreign key(food_batch_id) references public.cooking_food_batches(id)
  on delete restrict;

-- The receipt's effect snapshot must be complete for genuinely applied buffs.
alter table public.cooking_food_consumptions
  drop constraint if exists cooking_food_effect_receipt_consistency;
alter table public.cooking_food_consumptions
  add constraint cooking_food_effect_receipt_consistency check (
    not effect_applied or (
      effect_slug is not null and effect_percent between 1 and 5
      and effect_expires_at is not null and effect_expires_at>consumed_at
    )
  );
