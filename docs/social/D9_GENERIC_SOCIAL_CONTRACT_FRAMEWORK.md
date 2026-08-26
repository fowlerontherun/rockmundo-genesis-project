# D9 — Generic social contract, escrow and trust framework

## Purpose

D9 provides one reusable server-authoritative contract envelope for later collaboration, hiring, mentoring, production, sponsorship and other social systems. Existing domain-specific contracts remain untouched; new social flows can progressively adopt this foundation rather than creating another lifecycle.

## Live database authority

Database changes for this PR were applied directly to the live Supabase project. No migration file is included in this branch.

Canonical tables:

- `social_contracts`
- `social_contract_parties`
- `social_contract_events`
- `social_contract_escrow`
- `social_contract_disputes`
- `social_contract_reputation_events`
- `social_contract_endorsements`

All tables have RLS enabled. Authenticated clients have read-only table access and must use narrow RPCs for lifecycle mutations.

## Contract lifecycle

1. Creator creates an idempotent draft with terms, deliverables, deadline, visibility and invited profile parties.
2. Creator offers the contract.
3. Every invited party must explicitly accept the current contract version. A decline cancels the offer.
4. Once every party has accepted, the contract becomes active automatically.
5. Domain code verifies its real gameplay deliverables and calls the trusted settlement boundary.
6. Settlement releases each funded escrow exactly once, records completion evidence, and emits bounded verified reliability events.
7. Accepted parties may open a structured dispute. The evidence bundle is snapshotted from the server event stream rather than supplied by the reporter.
8. Completed contract parties may create one verified endorsement per dimension/counterparty/contract.

## Escrow

Player-funded escrow posts through the existing canonical Finance journal using `finance_transfer` and the existing system settlement account. The contract and escrow IDs are retained as related-entity/idempotency evidence. Funding, release and refund each have stable transaction keys.

Settlement is deliberately not callable by ordinary authenticated clients. Domain-specific systems such as D6 collaboration/session-musician contracts must validate their own completion evidence and call `_settle_social_contract` from trusted server/database code.

## Trust

Reputation cannot be directly written by the browser. D9 initially emits a small `reliability +1` signal after verified contract completion. The event model supports additional bounded dimensions (`professionalism`, `fairness`, `creative_quality`, `community`) when later domains have authoritative evidence for them.

The `get_social_contract_reputation` projection returns verified event counts and verified endorsement counts without allowing players to manufacture score events.

## Player surface

`/social/contracts` shows the current character's contracts and supports the safe player actions that belong at the generic layer: offer a draft, explicitly accept/decline an offer, cancel an active contract, and open a structured dispute. Contract creation remains domain-owned so later D6/D7/D8 flows can present terms appropriate to collaboration or employment rather than exposing an unsafe free-form money-contract builder.

## Verification

Rollback-only production verification confirmed:

- create → offer → explicit acceptance → automatic activation;
- trusted settlement is replay-safe;
- completion emits one completion event even when settlement is retried;
- verified reputation is emitted once per accepted party;
- funded escrow moves player → system → payee through exactly two Finance transactions;
- replayed settlement does not release escrow twice;
- all D9 tables have RLS enabled.
