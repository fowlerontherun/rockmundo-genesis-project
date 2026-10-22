-- Preserve food-consumption receipts when a lone food batch is deleted.
-- Defer the FK check so account/profile deletion can cascade *both* related
-- records in one transaction without being blocked by trigger execution order.
alter table public.cooking_food_consumptions
 drop constraint if exists cooking_food_consumptions_food_batch_id_fkey;
alter table public.cooking_food_consumptions
 add constraint cooking_food_consumptions_food_batch_id_fkey
 foreign key(food_batch_id) references public.cooking_food_batches(id)
 on delete no action deferrable initially deferred;
