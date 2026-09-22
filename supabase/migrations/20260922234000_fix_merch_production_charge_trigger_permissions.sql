-- Allow the merchandise production trigger to debit the band's finance account.
-- The trigger runs from authenticated client inserts, but finance_debit_owner is
-- intentionally not executable by authenticated users directly. Run the trigger
-- function as its owner instead.

alter function public.charge_merch_production_order()
  security definer;

alter function public.charge_merch_production_order()
  set search_path = public;
