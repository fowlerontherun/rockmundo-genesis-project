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

## Retry queue and authenticated client checks (19 October)

The settlement cycle now waits **at least 30 minutes** before retrying a failed event and prioritizes events with no previous failed attempts. Healthy battles are no longer at risk of being crowded out by a backlog of repeatedly failing old events. The maximum batch size remains 500, and the settlement function remains service-only.

- Run `verify-fair-retry-rollback.sql` to inject a duplicate payout into one registered battle, let another battle complete, verify the immediate retry is deferred and a retry resumes after aging the failure timestamp. Every simulated payout, date change and failure record rolls back.
- Run `verify-authenticated-rpcs-rollback.sql` to exercise actual `authenticated` database-role registration and withdrawal RPCs with an eligible player's JWT subject. This verifies the recent table-privilege lockdown did not accidentally break gameplay. Both changes roll back.
- Both scripts have been executed **verbatim against the production database** and returned PASS.

The production migration `20261019145000_botb_fair_retry_queue.sql` was applied directly and its recorded version was reconciled to the filename after verifying identical stored SQL and no version collision.

**Legacy withdrawal:** The current Lovable source uses `withdraw_battle_of_the_bands_entry`; nevertheless, the exact published client revision and users' cached older clients have not been verified. Leave the temporary authenticated `DELETE` grant on `botb_entries` until the release transition is confirmed. Its row-level security limits it to active band members and events before the scheduled cutoff.
