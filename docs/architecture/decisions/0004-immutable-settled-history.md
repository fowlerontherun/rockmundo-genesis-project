# ADR 0004 — Immutable settled history and versioned scoring

Date: 2026-07-23
Status: Accepted

## Context

Balancing changes over time. If history rows are recomputed on read,
historical results silently change when formulas change, breaking
achievements, awards and player trust.

## Decision

On settlement, an edition writes a snapshot into
`festival_company_edition_history` that includes:

- All raw inputs used for scoring.
- The computed category and overall scores.
- `formula_version` and `scoring_version` identifiers.
- `settled_at` and `settled_by`.

Read paths for history render from the snapshot only. Formula changes
apply only to future editions.

## Consequences

- Slightly larger storage per edition.
- Full auditability of past results.
- Balancing team can iterate without fear of retroactive changes.
