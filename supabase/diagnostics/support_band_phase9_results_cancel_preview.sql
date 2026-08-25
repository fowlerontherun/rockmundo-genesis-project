-- Read-only deployment checks for Support Band Marketplace Phase 9.
SELECT to_regprocedure('public.preview_support_band_cancellation(uuid)') AS preview_cancel_rpc,
       to_regprocedure('public.get_support_gig_contribution(uuid)') AS contribution_rpc;

SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('band_support_history','support_band_cancellations','band_support_reputation')
ORDER BY table_name;

SELECT status, count(*)
FROM public.gig_support_slots
GROUP BY status
ORDER BY status;
