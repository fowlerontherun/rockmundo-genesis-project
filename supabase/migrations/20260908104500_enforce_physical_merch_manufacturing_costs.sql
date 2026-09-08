-- Ensure every physical merchandise catalogue item has a real manufacturing setup.
-- Digital products and experiences are intentionally exempt from physical manufacturing rules.

alter table public.merch_item_requirements
  drop constraint if exists merch_physical_positive_base_cost,
  add constraint merch_physical_positive_base_cost
    check (coalesce(product_kind, 'physical') <> 'physical' or base_cost > 0),
  drop constraint if exists merch_physical_positive_moq,
  add constraint merch_physical_positive_moq
    check (coalesce(product_kind, 'physical') <> 'physical' or min_order_qty > 0),
  drop constraint if exists merch_physical_positive_lead_time,
  add constraint merch_physical_positive_lead_time
    check (coalesce(product_kind, 'physical') <> 'physical' or lead_time_days > 0);
