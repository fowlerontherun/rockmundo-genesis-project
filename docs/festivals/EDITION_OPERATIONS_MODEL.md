# Canonical festival edition operations model

Canonical operations now flow through edition-scoped server RPCs rather than direct client writes. Stages, slots, system acts, staff assignments, permits, insurance policies, budget changes, and ledger obligations all require an edition ID and an authorised owner, delegate, or platform administrator.

## Stage and slot lifecycle

Stages are created with `create_festival_edition_stage`, updated with `update_festival_edition_stage`, and archived with `archive_festival_edition_stage`. Slots are generated from timestamped templates by `generate_festival_stage_slots`, edited by `update_festival_stage_slot`, and archived by `archive_festival_stage_slot`. Contracted, live, or completed resources cannot be moved or removed without a future contract-amendment workflow.

## System acts

System acts are persisted in `festival_system_acts` with deterministic keys, display names, reliability, equipment requirements, public metadata, and an internal seed. Assignment, removal, and movement are audited and never assign a player band directly.

## Staff

Staff candidates are materialised in `festival_staff_candidates_persistent` so identities, skills, reliability, wages, and commitments remain stable. Hiring creates a `festival_staff` assignment and a committed wage obligation in the edition ledger.

## Permits

`festival_edition_permit_requirements` derives permit requirements from edition facts. `apply_for_festival_edition_permit` creates a pending application and ledger obligation. Only admin permit RPCs may approve, reject, request information, revoke, or expire permits.

## Insurance

Insurance quotes are stored and versioned in `festival_edition_insurance_quotes` using an input hash and model version. Purchases validate quote freshness and unchanged edition facts, create a policy, and post a ledger obligation.

## Ledger and budget

`post_festival_edition_ledger_entry` is the canonical posting service. It enforces edition currency, controlled categories, source/idempotency keys, and audit. Budget changes are tracked in `festival_edition_budget_changes` with actor and reason.

## Deferred settlement

The model creates obligations and readiness evidence only. It does not apply career effects, pay guarantees, distribute revenue, calculate final taxes, or close settlement.
