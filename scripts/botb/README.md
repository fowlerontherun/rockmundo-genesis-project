# Battle of the Bands: live settlement verification

Use `verify-live-settlement-rollback.sql` in the Supabase SQL Editor as a trusted database administrator after changes to the Battle of the Bands settlement, rewards, scheduling, or treasury logic.

## What it verifies

1. For **three future registered battles with exactly one entrant apiece**, temporarily make the event due, invoke the **actual** `resolve_botb_event` code, and verify completed status, audience, one correct winner-prize ledger entry, band cash, city net, player XP (+1,000), attribute points (+6), XP ledger, and activity feed.
2. Deliberately trigger a prize-uniqueness failure in one due battle alongside a successful due battle. Verify `run_botb_cycle()` isolates the failure, completes the healthy event and records the retryable failure.
3. Roll back every temporary change using an intentional caught exception, then verify event statuses, winner balances and prize/error records are restored.

**No real event starts, winner payments, city balances or player rewards are permanently modified.** The script raises a named exception if a required invariant fails; it does not swallow unexpected errors.

Requirements: a trusted SQL connection and at least three future Battle of the Bands events, each with a single entry. Do **not** run the script when genuine events are already due: the batch fault test refuses to do so. Re-run after new registrations become available in a new environment.

## Applied migration history, 19 October 2026

Twelve live BOTB migrations were initially applied through the Supabase MCP as one-off timestamped versions based on their execution time, while GitHub contained migration files with different planned timestamp prefixes. On 19 October they were reconciled **in one guarded transaction** to match the repository's existing migration filenames.

Before reconciling, each deployed migration's stored SQL text was compared against its GitHub source file: **all twelve matched byte-for-byte** and none of the target versions was already occupied. Only the `supabase_migrations.schema_migrations.version` and `name` fields were updated. The applied SQL, business tables, scheduled events, and balances were not changed by this identity repair.

Run `verify-migration-history.sql` to confirm those twelve identities still align. The history repair itself is intentionally **not** a replayable schema migration: a migration must not mutate history this way on fresh deployments.

The first genuine post-upgrade battles are currently scheduled for 23 October 2026. The rollback-only smoke tests prove the deployed settlement path works against registered player data; the first natural settlement still needs operational review.
