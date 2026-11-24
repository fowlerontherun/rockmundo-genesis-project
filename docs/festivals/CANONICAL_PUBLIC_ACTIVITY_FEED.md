# Canonical festival activity feed — staged rollout

## Scope

The visitor grounds page uses the **same** React Query cache entry as the
canonical public live-status view. A new additive RPC,
`get_public_festival_edition_live_experience(text)`, wraps the existing
`get_public_festival_edition_live_status(text)` and returns up to 30 immutable
stage transitions for that **exact published launch, edition, latest runtime
and local festival day**. No new simulator, reward operation or client write
path is added.

The payload is a fixed allowlist: `id`, `kind=stage`, `status`, `stageId`,
`stageName`, `scheduleItemId`, `observedAt`. It does not return raw evidence,
staff actions, confidential incident notes or audience numbers. The browser
validates event identity, published stage, local-day timing and stable IDs;
it only resolves an artist name when the schedule item is also present in the
published lineup. Re-fetch/reconnect replaces the snapshot instead of
appending duplicate announcements. On errors or stale snapshots the page hides
the previously cached feed and keeps the timetable available.

## Deployment dependencies and verification gate

The migration `20261119120000_canonical_festival_public_event_feed.sql`
requires both the canonical annual-edition public-status projection and
`private.festival_edition_stage_events` from the earlier canonical stage
evidence migration. The **19 November 2026 read-only production preflight**
found the status RPC deployed but the private stage-event ledger absent;
`festival_runtime_evidence` contained only completion evidence. Therefore
**this feed migration has not been applied to production**. Applying it alone
now would fail. Do not create fake stage events or deploy the separate
launch-scoped runtime to make a demonstration work.

Before rollout:

1. Review/reconcile and deploy the earlier canonical stage-event migrations
   through the approved pipeline, confirming their trigger, table permissions
   and real runtime evidence writer in a disposable database.
2. Apply the additive feed migration there, then run
   `supabase/tests/festival_canonical_public_event_feed_harness.sql`.
3. With a seeded **real** annual-edition runtime, verify published, cancelled,
   paused, multi-day and other-edition views, and authenticated/anonymous
   permissions. Confirm reconnect shows each official event once and never
   reveals unpublished names or private operations. Test on mobile and desktop.
4. Review the production migration/backup/rollback plan, then deploy with
   monitoring. The frontend automatically falls back to the previous status
   RPC when the additive feed function is not yet deployed.

Rollback for the additive function (after confirming no newer dependency):

```sql
DROP FUNCTION IF EXISTS public.get_public_festival_edition_live_experience(text);
```

The prior status RPC and all canonical runtime/reward tables remain unchanged.

## Deliberately outstanding

The feed currently renders canonical stage transitions (including completion
highlights) and the separate canonical weather snapshot. Artist arrivals and
public-safe incident notices require approved, *actual* canonical event sources
and permission checks; private check-in and security/medical records must not
be exposed or synthesized. Those parts of #4638 and production reconnect
acceptance for #4639 remain open until the verification gate above passes.
