# Festival settlement readiness

`festival_edition_settlement_readiness(p_edition_id uuid)` prepares the settlement PR without applying fame, fan, streaming, skill, relationship or money effects.

The projection reports lifecycle state, completed sessions, missing outcomes, invalidated outcomes, unsettled contracts, pending effects, warnings and blockers. It returns `ready_for_settlement` only when the edition is in `settling` or `completed` and no outcome blockers remain.

The next PR should consume this projection to apply PR #1200 pending effects exactly once and settle guarantees, deposits, bonuses, cancellation obligations and edition ledger entries.

## 2029-12-12 operational completion update

The canonical edition operations PR completes the PR #1210 foundation by adding edition-scoped operational RPCs, deterministic operational backfill, migration issues, persistent system acts, persistent staff candidates, permit and insurance workflows, controlled ledger posting, data-health repairs, legacy migration apply, and expanded settlement readiness. Career effects and final financial settlement remain deferred to `feat(festivals): apply career effects and settle performance contracts`.

## Settlement application phase

The settlement PR adds `prepare_festival_edition_settlement`, which treats this readiness RPC as a gate and then performs stricter finalisation, invalidation, currency and snapshot checks before a locked settlement can exist.
