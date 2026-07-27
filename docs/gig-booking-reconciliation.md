# Legacy gig-booking balance reconciliation

Before `20260727120000_atomic_gig_booking.sql`, the browser reduced `bands.band_balance`
before inserting a gig. An RLS or constraint failure could therefore charge a band without
creating a booking. The migration adds the service-role-only view
`public.gig_booking_reconciliation_candidates`; it is an evidence report, not an automatic refund.

## Safe administrator procedure

1. Export the candidate view and preserve the export as the audit input:
   `select * from public.gig_booking_reconciliation_candidates order by created_at;`
2. For each candidate, identify the band from contemporaneous activity metadata and verify the
   actor controlled that band at that time. Compare the reported fee with balance/financial
   transaction history immediately before and after the activity.
3. Confirm there is no gig at the intended venue/time under another request and no later retry
   that received the expected booking. Activity-feed evidence alone is **not** sufficient.
4. Credit only cases with an unambiguous debit and no corresponding gig. Record the candidate
   activity ID, evidence queried, administrator, amount, reason, and compensating transaction ID
   in the normal finance audit trail.
5. Leave ambiguous rows unchanged and escalate them for manual player-support review.

Never bulk-update `band_balance` from the candidate view. The old activity feed is not a canonical
financial ledger and may contain successfully booked gigs or duplicated informational entries.
