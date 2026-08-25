-- Read-only diagnostics for Support Band Marketplace Phase 5.
SELECT
  to_regclass('public.support_band_gig_settlements') IS NOT NULL AS settlement_table_present,
  to_regprocedure('public.support_gig_demand_multiplier(uuid)') IS NOT NULL AS demand_function_present,
  to_regprocedure('public.settle_support_band_gig(uuid)') IS NOT NULL AS settlement_function_present,
  to_regprocedure('public.retry_pending_support_band_settlements()') IS NOT NULL AS retry_function_present;

SELECT
  status,
  count(*) AS settlements,
  COALESCE(sum(ticket_revenue),0) AS ticket_revenue,
  COALESCE(sum(support_share),0) AS support_share
FROM public.support_band_gig_settlements
GROUP BY status
ORDER BY status;

SELECT
  s.gig_id,
  s.headliner_band_id,
  s.support_band_id,
  s.ticket_revenue,
  s.support_share,
  s.headliner_share,
  s.demand_multiplier,
  s.status,
  s.progression_applied_at,
  s.failure_reason
FROM public.support_band_gig_settlements s
WHERE s.status = 'pending_finance'
ORDER BY s.updated_at;

SELECT
  g.id AS gig_id,
  g.tickets_sold,
  g.predicted_tickets,
  public.support_gig_demand_multiplier(g.id) AS support_multiplier,
  v.capacity
FROM public.gigs g
JOIN public.venues v ON v.id = g.venue_id
WHERE g.status IN ('scheduled','confirmed')
  AND EXISTS (
    SELECT 1 FROM public.gig_support_slots gs
    WHERE gs.gig_id = g.id AND gs.status IN ('accepted','completed')
  )
ORDER BY g.scheduled_date;
