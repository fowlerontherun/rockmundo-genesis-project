# ADR 0002 — Festival company vs annual edition

Date: 2026-07-23
Status: Accepted

## Context

Festivals recur annually. Bookings, tickets, financial results and
attendance belong to a specific year, while upgrades, reputation and
staff persist.

## Decision

Split the aggregate:

- **Festival company** — persistent: balance, upgrades, brand, owner,
  stage-manager invitations, reputation snapshots.
- **Annual edition** — per-year: dates, site, vibe, environmental
  policy, stages, slots, applications, offers, contracts, tickets,
  performance results, financial settlement, immutable history row.

An edition FKs back to the festival company. Completed editions become
read-only.

## Consequences

- Upgrades carry across editions automatically.
- Historical results are per-edition and never rewritten.
- New editions can copy configuration (not contracts, not results).
