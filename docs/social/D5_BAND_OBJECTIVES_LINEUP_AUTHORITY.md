# D5 — Band objectives, contribution and lineup authority

## Status

Implemented on the D5 branch with the database changes applied directly to the live Supabase project. No D5 migration file is included in this branch.

## Delivered

### Shared band objectives

- Leaders, founders, co-leaders and managers can create or cancel shared objectives.
- Objectives cover completed rehearsals, completed recording sessions and performed gigs.
- Progress is server-owned and advances from verified contribution source entities, not client-submitted counters.
- Each source activity can progress an objective only once, even when several members contributed to the same activity.

### Verified contribution foundation

Production was missing several database objects from the older Phase 4 contribution/rehearsal work even though the associated code and migration files had previously been merged. The live-compatible contribution foundation was restored directly:

- `band_contribution_events`
- `band_rehearsal_participants`
- authoritative recording/rehearsal/gig contribution capture
- rehearsal invitation response, finalisation and correction RPCs used by the existing client

The historic migration chain was not replayed blindly because it depends on obsolete enum/audit structures that are not present in the current production schema.

### Authoritative rehearsal attendance

- Rehearsal participants explicitly respond to invitations.
- Final attendance is manager-authorised after the rehearsal has ended/completed.
- Completion no longer assumes every invited member attended.
- A member can request a correction to their own final attendance during the correction window.
- Corrections are resolved through a conflict-aware manager workflow, including the existing sole-resolver exception.
- Verified rehearsal contribution is created only for final `attended` rows.

### Authoritative gig lineups

- A manager can maintain a draft lineup before a gig starts.
- Every selected performer must be a current active band member.
- A lineup can be explicitly finalised and versioned.
- A finalised lineup cannot be silently rewritten through the normal edit path.
- Members can request add/remove corrections and an authorised manager must approve or reject them.
- Completed gig contribution comes from the authoritative final performer rows.

### Chemistry and cohesion

Verified activities create one explainable band-level chemistry/cohesion event per source activity:

- rehearsal: chemistry +1, cohesion +2
- recording session: chemistry +1, cohesion +1
- gig performance: chemistry +1, cohesion +1

Band values are clamped to 0–100 and the explanation/history is visible in band management.

### Role and permission matrix

The server-owned `get_band_operation_permissions` RPC exposes the effective authority used by the client. Leaders/founders/co-leaders/managers can manage objectives and lineups and resolve corrections; active members can request correction review.

## Production drift audit

During D5 implementation the recent D1–D4 database foundations were checked against production rather than inferred from merged migration files. D1–D4 objects were present. The older Phase 4 band contribution/rehearsal foundation was only partially deployed and was repaired directly.

The audit also found `gig_performers` had a SELECT policy but row-level security itself was disabled. RLS was enabled directly and the legacy policy was replaced with the current `is_active_band_member` authority check.

## Verification

- New D5 and restored rehearsal tables have RLS enabled.
- Authenticated clients receive read access only to the new authority tables; high-value mutations go through server RPCs.
- A rollback-only production verification inserted a temporary verified rehearsal contribution and confirmed that it advanced an objective once and produced exactly one cohesion event; the transaction was rolled back.
- Existing rehearsal client RPC names/signatures were restored so the current participation UI can use the live database without a parallel implementation.
- The branch contains client/hooks/tests/docs changes only and deliberately contains no new Supabase migration file.
