# Festival issue review — 31 October 2026

Repository: `fowlerontherun/rockmundo-genesis-project`.

Reviewed the 46 open issue search results for `festival`, prioritising foundation
reliability over new visual/social features. Issue checklists are not evidence
that a change is absent: compare them with current code and deployed contracts.

## First implementation batch

- **#4623 / FEST-005:** remount scheduler state per edition. Day/stage selections,
  an open slot inspector, running-order previews and manual creation state cannot
  carry into another edition, including while its data loads.
- **#4733 / #4624:** retain manual-slot request keys for identical uncertain
  submissions during the mounted workspace lifetime, block simultaneous submits,
  show save failures inline, and disable creation without a draft/day/stage.
  Give form controls accessible names and label the festival timezone.
- **#4734:** correct a scheduler test that expected no warning for a 15-minute
  gap despite a required 20-minute changeover. Test the exact boundary as well.

These are partial issue contributions, not grounds to close the parent issues.
The timezone conversion described in #4733 is already implemented in
`festivalScheduleLocalTime.ts` and covered by the existing UTC/DST tests.

## Remaining priorities

1. **Server retry guarantees (#4733, #4624):** inspect the live definition of
   `festival_schedule_upsert_item`. The August compatibility migration accepts
   `p_idempotency_key` but never reads it; the future-dated scheduling migration
   uses it but has a different JSON contract. Preserving a client key does not
   establish server deduplication. Keys here are memory-only, so reloads also
   require a server-backed recovery design. Verify permissions, revision locks,
   concurrency and lost-response retries before claiming end-to-end completion.
2. **Canonical live runtime (#4742, #4696):** resumable edition-v2 ticks and
   authoritative stage snapshots precede reliable artist/crowd presentation.
3. **Public projection (#4687):** verify deployed privacy, grants, freshness and
   edition isolation before expanding visitor data. Do not install the separate
   launch runtime to fill gaps in the canonical edition runtime.
4. **Foundation release gates (#4620–#4624, #4651):** validate cache refresh,
   public/wallet failure recovery, invitation deadlines, ticket expiry and
   settlement against real contracts. Existing helper tests alone do not certify
   the player journeys.
5. Build the hub, timetable, visitor guide and visual/social additions on those
   verified contracts; keep unknown live data explicitly unavailable.

## Validation and limits

`npx vitest run src/features/festivals/scheduling --maxWorkers=1`: **26 tests
passed across six files**, including edition switching, concurrent submits,
uncertain retries, successful-save key rotation and missing-draft handling.

`NODE_OPTIONS=--max-old-space-size=6144 npm run typecheck`: **passed**. The first
attempt exhausted Node's default heap. Changed tests pass ESLint; the scheduler
component passes with its existing `no-explicit-any` violations excluded.
`git diff --check` also passed.

No database migrations or production writes were performed. Live database and
browser end-to-end verification remain outstanding. The existing scheduler file
has legacy `no-explicit-any` lint violations; this batch adds no new ones.
