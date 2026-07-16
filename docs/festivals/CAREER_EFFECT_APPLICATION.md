# CAREER EFFECT APPLICATION

This document describes the canonical festival settlement phase introduced by `20291213090000_festival_effects_and_settlement.sql`.

## Scope

Settlement starts from finalised performance outcomes and locked contract/operations evidence. It does not run audience simulation, recalculate performance outcomes, mutate completed histories in place, or settle legacy-only records without canonical mapping.

## Server authority

The server prepares a settlement through `prepare_festival_edition_settlement`, records a readiness snapshot, freezes contracts, signatures, sessions, outcomes, effects, fan conversions and ledger entries, then hashes the input snapshot. `apply_festival_settlement_batch` advances idempotent phases for effects, contract instructions, revenue/expense reconciliation and final completion. `reconcile_festival_edition_settlement` returns structured discrepancies.

## Safety rules

Every effect or money-facing result has a stable source key. Completed settlements are immutable. Corrections require invalidation, reasoned supersession, reversal or compensating records, and a replacement settlement version.
