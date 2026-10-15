# Production inbox and daily stipend repair — 15 October 2026

Production Supabase project: `yztogmdixmchsmimtent`.
These repairs were applied directly to production **after schema and data preflights**;
the SQL under `supabase/production-repairs/` is an audit copy, not a pending automatic
migration to replay indiscriminately.

## Daily stipend

- Live `progression` Edge Function referenced `claim_daily_stipend_atomic(uuid)`
  but the RPC was absent.
- Source: `supabase/migrations/20261013113000_atomic_daily_stipend.sql`.
- Preflight: zero duplicate `(profile_id, grant_date)` pairs for the
  `daily_stipend` source. The live wallet and VIP subscription columns were present.
- Applied with history name
  `rockmundo_20261013113000_atomic_daily_stipend_safe` at
  `20261015095730`. The partial unique index and function now exist, and the
  function is executable by `authenticated`, not `anon`.
- A no-JWT call returned the expected ownership/authorization denial. This
  **does not** constitute a live player claim test.
- No historical XP/AP was backfilled or paid during the repair.

## Inbox

- Live inbox had 3,121 records; 257 lacked the `metadata.profile_id` or
  `metadata.scope='account'` required by the frontend. 48 of these were from
  the preceding seven days.
- RLS SELECT, UPDATE, DELETE policies based on `user_id=auth.uid()` were
  present. The problem was missing scope metadata, not missing inbox read RLS.
- Applied audit SQL:
  `supabase/production-repairs/20261015_player_inbox_scope_repair.sql`;
  Supabase history name `rockmundo_20261015_player_inbox_scope_repair`,
  version `20261015100314`.
- Before/after: unscoped `257 -> 31`; recent unscoped `48 -> 4`;
  character-scoped `2864 -> 3031`; explicit account-wide `0 -> 59`.
- Valid sources are `player_events`, recording session owners, existing travel
  sources and account-level bug-report notices. The historical single-character
  fallback applies only when the account has **exactly one** profile.
- No `player_inbox` rows deleted. No orphaned or cross-user
  `metadata.profile_id` references were detected in the verification query.

## Remaining work and safety boundary

31 old inbox messages remain unscoped because their intended character is
ambiguous: player/random events (15), recording-booking/system notifications
(7), gig outcomes (6), record-label contracts (3). Four are from the last seven
days. Resolve them at the originating write paths or from an independently
authoritative character link. **Do not** infer the active profile or broadcast
character-specific notices across all of a user's characters.

The legacy inbox INSERT policy is broadly permissive and deserves a separate
end-to-end producer/permissions audit before changing it; this repair did not
change RLS grants or policies.

This was not a blanket database migration rollout. The existing migration
history has naming/timestamp collisions and other unapplied files. Do not run a
bulk `db push` without reconciling those files and checking backup/PITR.

**Follow-up validation:** authenticated player claim (one per UTC date),
concurrent duplicate-claim rejection, inbox read/archive/delete under real
accounts, multi-character isolation, and full build/test CI. 
