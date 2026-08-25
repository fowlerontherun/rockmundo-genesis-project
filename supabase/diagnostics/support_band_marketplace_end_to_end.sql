-- Support Band Marketplace end-to-end deployment/integrity diagnostics.
-- Read-only. Safe to run in production.

WITH required_relations(name) AS (
  VALUES
    ('band_support_preferences'),
    ('band_support_availability'),
    ('gig_support_slots'),
    ('support_band_gig_settlements'),
    ('band_support_history'),
    ('band_support_reputation'),
    ('band_support_relationships'),
    ('support_band_cancellations')
), relation_checks AS (
  SELECT
    rr.name,
    to_regclass('public.' || rr.name) IS NOT NULL AS present
  FROM required_relations rr
), required_functions(name, signature) AS (
  VALUES
    ('find_available_support_bands','public.find_available_support_bands(uuid,uuid,timestamp with time zone,timestamp with time zone,boolean,integer)'),
    ('create_gig_support_offer','public.create_gig_support_offer(uuid,uuid,uuid)'),
    ('respond_to_gig_support_offer','public.respond_to_gig_support_offer(uuid,text,text)'),
    ('find_tour_support_candidates','public.find_tour_support_candidates(uuid,uuid)'),
    ('find_tour_support_show_candidates','public.find_tour_support_show_candidates(uuid,uuid)'),
    ('cancel_confirmed_support_slot','public.cancel_confirmed_support_slot(uuid,text)'),
    ('preview_support_band_cancellation','public.preview_support_band_cancellation(uuid)'),
    ('get_support_gig_contribution','public.get_support_gig_contribution(uuid)'),
    ('get_band_support_summary','public.get_band_support_summary(uuid)')
), function_checks AS (
  SELECT
    rf.name,
    to_regprocedure(rf.signature) IS NOT NULL AS present
  FROM required_functions rf
)
SELECT 'relation' AS check_type, name, present::text AS result
FROM relation_checks
UNION ALL
SELECT 'function', name, present::text
FROM function_checks
ORDER BY check_type, name;

-- There must never be more than one accepted/completed support act for a show.
SELECT
  gig_id,
  count(*) AS confirmed_support_rows
FROM public.gig_support_slots
WHERE status IN ('accepted','completed')
GROUP BY gig_id
HAVING count(*) > 1;

-- A band must not be confirmed as support on overlapping shows.
WITH confirmed AS (
  SELECT
    gs.id AS support_slot_id,
    gs.support_band_id,
    g.id AS gig_id,
    g.scheduled_date AS starts_at,
    COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') AS ends_at
  FROM public.gig_support_slots gs
  JOIN public.gigs g ON g.id = gs.gig_id
  WHERE gs.status = 'accepted'
)
SELECT
  a.support_band_id,
  a.support_slot_id AS slot_a,
  b.support_slot_id AS slot_b,
  a.gig_id AS gig_a,
  b.gig_id AS gig_b
FROM confirmed a
JOIN confirmed b
  ON b.support_band_id = a.support_band_id
 AND b.support_slot_id > a.support_slot_id
 AND b.starts_at < a.ends_at
 AND b.ends_at > a.starts_at;

-- Accepted support slots should have member calendar blocks until cancellation/completion.
SELECT
  gs.id AS support_slot_id,
  gs.gig_id,
  gs.support_band_id,
  count(psa.id) AS support_calendar_blocks
FROM public.gig_support_slots gs
LEFT JOIN public.player_scheduled_activities psa
  ON psa.linked_gig_id = gs.gig_id
 AND psa.status <> 'cancelled'
 AND psa.metadata->>'gig_role' = 'support'
 AND psa.metadata->>'support_slot_id' = gs.id::text
WHERE gs.status = 'accepted'
GROUP BY gs.id, gs.gig_id, gs.support_band_id
HAVING count(psa.id) = 0;

-- Completed support slots should have exactly one settlement/history trail once progression is ready.
SELECT
  gs.id AS support_slot_id,
  gs.gig_id,
  s.id AS settlement_id,
  s.progression_applied_at,
  h.id AS history_id
FROM public.gig_support_slots gs
LEFT JOIN public.support_band_gig_settlements s ON s.support_slot_id = gs.id
LEFT JOIN public.band_support_history h ON h.support_slot_id = gs.id
WHERE gs.status = 'completed'
  AND (
    s.id IS NULL
    OR (s.progression_applied_at IS NOT NULL AND h.id IS NULL)
  );

-- History and finance should not contain duplicate support-show records.
SELECT gig_id, count(*) AS history_rows
FROM public.band_support_history
GROUP BY gig_id
HAVING count(*) > 1;

SELECT support_slot_id, count(*) AS settlement_rows
FROM public.support_band_gig_settlements
GROUP BY support_slot_id
HAVING count(*) > 1;

-- Cancelled accepted slots must no longer retain active support calendar blocks.
SELECT
  c.support_slot_id,
  c.gig_id,
  count(psa.id) AS active_blocks_after_cancel
FROM public.support_band_cancellations c
JOIN public.player_scheduled_activities psa
  ON psa.linked_gig_id = c.gig_id
 AND psa.status <> 'cancelled'
 AND psa.metadata->>'support_slot_id' = c.support_slot_id::text
GROUP BY c.support_slot_id, c.gig_id
HAVING count(psa.id) > 0;

-- Summary counts for balancing/operational review.
SELECT
  (SELECT count(*) FROM public.band_support_preferences WHERE enabled) AS bands_opted_in,
  (SELECT count(*) FROM public.band_support_availability WHERE status='active' AND available_until >= now()) AS active_availability_windows,
  (SELECT count(*) FROM public.gig_support_slots WHERE status='pending') AS pending_offers,
  (SELECT count(*) FROM public.gig_support_slots WHERE status='accepted') AS confirmed_future_slots,
  (SELECT count(*) FROM public.gig_support_slots WHERE status='completed') AS completed_support_slots,
  (SELECT count(*) FROM public.support_band_cancellations) AS cancellations,
  (SELECT COALESCE(sum(support_payment),0) FROM public.band_support_history) AS support_income_paid,
  (SELECT COALESCE(avg(ticket_demand_multiplier),1) FROM public.band_support_history) AS avg_ticket_demand_multiplier;
