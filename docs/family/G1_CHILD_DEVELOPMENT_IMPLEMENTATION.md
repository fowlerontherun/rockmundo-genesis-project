# G1 — Child development, inheritance and parenting decisions

_Implemented: 2026-08-26_

## Status

**COMPLETE** for the consolidated G1 scope.

The existing family system already supplied child records, parent bonds, traits, school/life events, interactions, child planning, age-gated conversion and a family daily tick. G1 closes the remaining authority and co-parent gaps rather than replacing that system.

## What was incomplete

1. Child inherited potential was generated in the browser with mutable randomness and a placeholder second-parent skill profile.
2. Age/stage progression trusted a browser-derived game clock and directly updated authoritative child fields.
3. A ready birth could dead-end because the Family Dashboard set birth-dialog state without rendering the naming dialog.
4. Shared upbringing/schooling/mentor/life-event choices had no mutual co-parent decision queue or traceable conflict resolution.
5. UI playability wording was inconsistent with the existing age-18 conversion authority.

## Delivered

### Deterministic two-parent inheritance

Birth completion is now handled by `complete_child_birth_authoritative(uuid,text)` in Postgres.

For each of nine potential domains (`vocals`, `guitar`, `bass`, `drums`, `songwriting`, `performance`, `creativity`, `technical`, `composition`) the server reads both parents' real `player_skills` rows and derives a bounded 1–20 potential from:

- 45% parent A skill;
- 45% parent B skill;
- 10% deterministic request/domain variance;
- the agreed upbringing focus modifier.

The hash-based variance is stable for a child request and domain, so retrying or refreshing cannot reroll a better child. A `BEFORE INSERT` trigger on `player_children` independently overwrites browser-supplied potential for request-backed births as a defence-in-depth authority boundary.

Inherited potential remains future-oriented rather than immediate skill. Existing coming-of-age conversion may provide a bounded starting SXP allowance from potential, but the child does not receive adult skill levels at birth.

### Authoritative birth completion

`useAuthoritativeChildBirth` replaces the Family Dashboard's old browser multi-write flow. The server:

- checks authentication and that the caller is a parent;
- locks the child request;
- verifies accepted status and completed gestation/adoption wait;
- makes completion idempotent through one child per request;
- resolves surname policy server-side;
- creates the child;
- completes the request and records metadata;
- appends the child-arrival request event.

The Family Dashboard now renders the naming dialog for ready births, so the previously dead-end `Name Your Child` action completes the real journey.

### Database-clock age progression

`sync_child_progression(uuid)` derives age from canonical birth data and PostgreSQL `now()`. The browser no longer writes `current_age`, `school_stage` or `playability_state` from its local clock.

The existing stages remain:

- 0–5: NPC development;
- 6–17: guided development;
- 18+: eligible for explicit conversion into a playable character.

Becoming old enough does not silently create a player character. Existing explicit conversion authority remains responsible for that transition.

### Mutual co-parent decisions

`child_parenting_decisions` now records shared decisions for:

- upbringing focus;
- schooling focus;
- mentor focus;
- life-event approach.

A parent proposes one of the server-validated choices. When parents are controlled by different user accounts, the other parent must accept before the choice is copied into the child's applied guidance preferences. They may decline it instead. Newer pending proposals supersede older ones of the same type rather than creating contradictory active choices.

When both parent profiles legitimately map to the same user account, or the second parent has no controllable user account, the proposal can apply immediately.

Every proposal/response remains queryable to both parents. Direct browser INSERT/UPDATE/DELETE on the decision ledger is denied; writes go through permission-checked RPCs.

### Co-parent harmony

`player_children.co_parent_harmony` is a bounded 0–100 family-state signal:

- mutual acceptance improves harmony;
- declined shared decisions reduce it slightly;
- it never exceeds its bounds.

The child card now displays this alongside emotional stability and both parent-child bonds.

## Database delivery

Per RockMundo's delivery rule, the G1 database changes were applied **directly to the live Supabase database**. No migration file was added.

Live additions include:

- `child_requests.metadata` compatibility column required by the existing daily family tick;
- one-child-per-request unique index;
- `player_children.co_parent_harmony`;
- `child_parenting_decisions` with RLS and one-pending-decision-per-type protection;
- `sync_child_progression`;
- `complete_child_birth_authoritative`;
- `propose_child_parenting_decision`;
- `respond_child_parenting_decision`;
- authoritative inherited-potential insert trigger.

## Security and authority

- Server write RPCs are `SECURITY DEFINER` with explicit `search_path = pg_catalog, public`.
- `anon` cannot execute the new family mutation RPCs.
- Decision-table direct writes are revoked from authenticated clients.
- Decision reads are limited by RLS to either recorded parent.
- Child progression/birth RPCs validate parent/controller ownership.
- Birth retries converge on the existing child rather than creating siblings or rerolling potential.

## Frontend changes

- `src/hooks/useChildAgeProgression.ts`
- `src/hooks/useAuthoritativeChildBirth.ts`
- `src/hooks/useChildParentingDecisions.ts`
- `src/components/family/FamilyDashboard.tsx`
- `src/components/family/BirthCompletionDialog.tsx`
- `src/components/family/ChildCard.tsx`
- `src/components/family/ParentingDecisionDialog.tsx`

Regression contract coverage lives in `src/components/family/__tests__/g1Authority.contract.test.ts`.

## G1 acceptance mapping

| Requirement | Status |
| --- | --- |
| Bounded child skill potential / inheritance | Complete — deterministic real two-parent potential, 1–20 |
| Child traits and upbringing focus | Complete — existing trait system retained; upbringing feeds inheritance and guidance |
| Age-bracket development events | Complete — existing school/life event framework retained with server-clock age authority |
| Schooling / mentor / life-event choices | Complete — mutual decision queue and applied guidance preferences |
| Co-parent decision queue and conflict resolution | Complete — accept/decline/supersede ledger |
| Parent-child bond effects | Complete — existing `bond_parent_a` / `bond_parent_b` retained |
| Co-parent harmony effects | Complete — new bounded harmony signal |
| Age-gated playability | Complete — guided through 17, explicit playable conversion from 18 |
| Scheduled / idempotent progression | Complete — database-clock sync plus existing family daily tick; birth is replay-safe |
