# Phase 4 PR 01 — Band Contribution Event Log MVP

## Recommendation source

Phase 3 closed with the recommendation to add a server-authoritative contribution event log for existing band activity before introducing shared goals, rewards, XP, chemistry, achievements, or leaderboards.

## Existing event/history foundations found

- `band_history` exists for band lifecycle/management history, but it is generic band history rather than member contribution history.
- `activity_feed` exists for broad player activity messages, but it is not band-scoped, immutable contribution accounting.
- `gig_outcomes` is an authoritative completion record for completed gigs.
- `recording_sessions.status = 'completed'` with `completed_at` is an authoritative completion record for a band recording session owner/participant.
- `band_rehearsals.status = 'completed'` is an authoritative completion record for a band rehearsal, but there is no separate rehearsal attendance table in this repository.
- `jam_session_outcomes` records participant-level jam results, but jam sessions are not reliably band-scoped, so they are not included in this PR.
- Rich songwriting collaborator tables exist in forward-dated migrations, but completed band co-author credit is not used in this MVP because the stable completion/source ownership path is less clear than rehearsal, recording, and gig completion.

## Selected contribution sources

This MVP captures only new events after the migration for:

1. `rehearsal_attendance` from completed `band_rehearsals`.
2. `recording_participation` from completed band `recording_sessions`.
3. `gig_performance` from inserted `gig_outcomes`.

No XP, money, chemistry, fame, achievements, reputation, rewards, penalties, contracts, votes, or leaderboards are added.

## Event model

A new `band_contribution_events` table stores:

- `id`
- `band_id`
- `profile_id`
- `contribution_type`
- `source_entity_type`
- `source_entity_id`
- `occurred_at`
- safe display `metadata`
- `created_at`

The supported MVP contribution types are constrained to `rehearsal_attendance`, `recording_participation`, and `gig_performance`.

## Server-authoritative creation method

Events are created only by database trigger paths calling the guarded `insert_band_contribution_event` helper:

- `band_rehearsals` after insert/update to `completed`.
- `recording_sessions` after insert/update to `completed` for band sessions.
- `gig_outcomes` after insert.

The helper verifies the target profile is an active member of the target band before inserting.

## Idempotency model

The table has a unique constraint on `(band_id, profile_id, contribution_type, source_entity_type, source_entity_id)`. The helper inserts with `ON CONFLICT DO NOTHING`, so retries or repeated completion processing do not duplicate events.

## Visibility and privacy model

Contribution events are read-only to normal clients. The only RLS policy allows authenticated current active members to read events for their band through `is_active_band_member`. Former/inactive members, unrelated users, and unauthenticated users do not receive contribution feed access by default.

Metadata is intentionally limited to safe labels such as `Completed band rehearsal`, `Completed band recording`, and `Completed band gig`. It does not expose private messages, internal audit metadata, schedules beyond event timestamps, health/energy values, hidden skills, auth data, service-role data, or rewards.

## UI/read model

The existing band management area now includes a read-only `Contributions` tab showing:

- recent contribution events, newest first, limited to 50;
- member public name/avatar;
- contribution label and safe source label;
- accessible timestamps;
- empty, loading, and error states;
- summary counts by member and by type.

The summary is deliberately neutral and not a leaderboard or reward calculation.

## Files changed

- `supabase/migrations/20260711010000_create_band_contribution_events.sql`
- `supabase/tests/band_contribution_events_harness.sql`
- `package.json`
- `src/lib/bandContributions.ts`
- `src/lib/bandContributions.test.ts`
- `src/hooks/useBandContributions.ts`
- `src/components/bands/BandContributionsTab.tsx`
- `src/components/bands/BandContributionsTab.test.tsx`
- `src/pages/bands/[bandId]/management.tsx`
- `docs/social/implementation/PHASE_4_PR_01.md`
- `docs/social/SOCIAL_SYSTEM_AUDIT.md`
- `docs/social/SOCIAL_MMO_EXPANSION_PLAN.md`

## Database changes

- Adds immutable `band_contribution_events` table.
- Adds foreign keys to `bands` and `profiles`.
- Adds check constraints for supported contribution and source types.
- Adds idempotency unique constraint.
- Adds band/time, profile/time, and type/time indexes.
- Enables RLS with current-active-member-only SELECT.
- Adds `is_active_band_member` and `insert_band_contribution_event` SECURITY DEFINER helpers with safe `search_path`.
- Adds triggers for completed rehearsals, completed recordings, and gig outcomes.

## Tests

- Unit tests cover display mapping, safe unsupported-type fallback, safe source labels, and summary aggregation.
- Component tests cover recent contribution rendering, member summary rendering, empty state, error state, loading state, and unsupported-type fallback.
- A local database harness stub documents the contribution RLS/idempotency cases and is wired as `npm run test:contributions:db`; a full data-seeding SQL harness remains a follow-up due to schema drift across local Supabase fixtures.

## Backfill decision

No historical backfill runs automatically. New events after the migration are sufficient for beta. A later optional backfill can derive conservative events from completed source rows in batches, but it should be reviewed separately because rehearsal and gig membership-at-time semantics are not fully represented.

## Known limitations

- Rehearsal and gig contribution capture currently uses active band membership at completion time because no participant-level attendance table was found for those systems.
- Jam sessions are excluded because participant records are reliable but not clearly band-scoped.
- Songwriting credit is excluded until completed band co-author credit can be tied to a stable authoritative source path.
- Recording participation currently credits the session profile/user for completed band sessions, not every possible studio collaborator.
- No rewards or progression calculations consume this log yet.

## Recommended Phase 4 PR 02

Add a stricter contribution-source adapter layer and expand participant-level sources only where repository data supports them, starting with band-scoped jam outcomes or explicit rehearsal/gig attendance rows. Keep rewards, XP, chemistry, achievements, and leaderboards out until event accuracy and privacy are proven.
