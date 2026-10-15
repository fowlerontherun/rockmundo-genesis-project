# Production compatibility repairs — 15 October 2026

These SQL files are **exact copies of statements already executed on the live Supabase database** `yztogmdixmchsmimtent`. They are retained **outside** `supabase/migrations` deliberately. **Do not reapply automatically or add them to a blanket db push**. Each was applied directly, with a unique live migration identity, and verified in production.

| Recorded live version | Migration identity | SQL |
| --- | --- | --- |
| `20261015152936` | `rockmundo_20261015_music_notifications_durable_reconcile_compat` | `20261015152936_music_notifications_durable_reconcile_compat.sql` |
| `20261015153229` | `rockmundo_20261015_ap_to_sxp_conversion_live_ledger_compat` | `20261015153229_ap_to_sxp_conversion_live_ledger_compat.sql` |
| `20261015153459` | `rockmundo_20261015_durable_invite_release_gig_offer_notifications` | `20261015153459_durable_invite_release_gig_offer_notifications.sql` |

## Outcomes

- Future recording completion and AI audio status changes persist character-scoped notifications even without a connected browser. `reconcile_my_game_notifications(uuid)` is now callable by an authenticated owner and reconciles a bounded 72-hour window for these event types. Existing SQL notification de-duplication now uses event identity/character rather than collapsing distinct events sharing a title.
- The deployed progression Edge Function's missing `convert_ap_to_sxp_atomic` RPC is restored against the **existing** `experience_ledger` instead of the nonexistent legacy `xp_ledger`. AP deduction, wallet SXP/XP credit, and audit ledger insert are atomic. A real eligible profile was tested with a 1-AP conversion inside a rolled-back database transaction; delta and ledger checks passed, and no conversion was persisted.
- Future pending band invitations, gig offers, and manufacturing-to-released transitions now persist recipient-scoped notifications. Existing past rows were not replayed.

## Verification

- All five trigger definitions are enabled on `public.recording_sessions`, `public.songs`, `public.band_invitations`, `public.gig_offers`, and `public.releases`.
- Anonymous roles cannot call the reconciliation or conversion functions. Internal trigger functions are not executable by `anon` or `authenticated`.
- The production history recorded 1,452 migrations after these three repairs; existing player wallets and game-event rows were not bulk-updated.
- No live end-to-end gameplay/browsing session was performed. The new triggers need player-observed verification on future real events.

## Outstanding non-deployable items

- The deployed `complete-recording-sessions` Edge Function still needs integration with the recording claim/finalization RPCs installed in the separate recorded migration `20261015151606`.
- Deployed AI audio Edge Functions still need their atomic generation-attempt integration. The SQL migration alone does not update deployed worker code.
- The original broad `20261014113000_durable_deduped_game_notifications.sql` contains overlapping/incompatible privileged function replacements; do not replay it.
- The original AP conversion migration references an absent `xp_ledger`; do not replay it.
- Financial/payroll/sponsorship, other social and progression migrations require their own reconciliations before direct application.
