-- #4233: read-only release audit. Never auto-complete or pay these records.
-- Run after code/SQL deployment to inspect legacy acceptance without receipts.
SELECT
  m.status,
  COUNT(*) FILTER (WHERE m.booking_activity_id IS NULL) AS missing_authoritative_booking,
  COUNT(*) FILTER (WHERE m.booking_activity_id IS NOT NULL AND a.id IS NULL) AS missing_calendar_entry,
  COUNT(*) FILTER (WHERE m.status='completed' AND s.contract_id IS NULL) AS completed_without_receipt,
  COUNT(*) FILTER (WHERE m.status IN ('accepted','shooting') AND m.scheduled_end<now()
    AND s.contract_id IS NULL) AS past_due_unsettled
FROM public.player_modeling_contracts m
LEFT JOIN public.player_scheduled_activities a ON a.id=m.booking_activity_id
LEFT JOIN public.modeling_contract_settlements s ON s.contract_id=m.id
GROUP BY m.status ORDER BY m.status;
