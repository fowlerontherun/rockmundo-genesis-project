# Festival settlement readiness

`festival_edition_settlement_readiness(p_edition_id uuid)` prepares the settlement PR without applying fame, fan, streaming, skill, relationship or money effects.

The projection reports lifecycle state, completed sessions, missing outcomes, invalidated outcomes, unsettled contracts, pending effects, warnings and blockers. It returns `ready_for_settlement` only when the edition is in `settling` or `completed` and no outcome blockers remain.

The next PR should consume this projection to apply PR #1200 pending effects exactly once and settle guarantees, deposits, bonuses, cancellation obligations and edition ledger entries.
