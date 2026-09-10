-- Repair schema drift between settle_gig_commerce() and gig_commerce_settlements.
-- The commerce RPC expects the authoritative v2/v3 columns, while production
-- still had the earlier compact settlement shape. This mismatch prevented gigs
-- from completing and exhausted the automatic retry workflow.

alter table public.gig_commerce_settlements
  add column if not exists gig_outcome_id uuid,
  add column if not exists formula_version text,
  add column if not exists merchandise_items integer,
  add column if not exists merchandise_gross integer,
  add column if not exists merchandise_cost integer,
  add column if not exists bar_drinks_served integer,
  add column if not exists bar_gross integer,
  add column if not exists venue_bar_revenue integer,
  add column if not exists band_bar_revenue integer,
  add column if not exists booking_id uuid,
  add column if not exists venue_transaction_id uuid;

update public.gig_commerce_settlements s
set gig_outcome_id = o.id
from public.gig_outcomes o
where o.gig_id = s.gig_id
  and s.gig_outcome_id is null;

update public.gig_commerce_settlements
set merchandise_items = coalesce(merchandise_items, merch_items_sold),
    merchandise_gross = coalesce(merchandise_gross, merch_gross_revenue),
    merchandise_cost = coalesce(merchandise_cost, merch_cost),
    band_bar_revenue = coalesce(band_bar_revenue, bar_band_entitlement),
    formula_version = coalesce(formula_version, 'legacy');

create unique index if not exists gig_commerce_settlements_gig_id_uidx
  on public.gig_commerce_settlements(gig_id);

create index if not exists gig_commerce_settlements_outcome_idx
  on public.gig_commerce_settlements(gig_outcome_id);
