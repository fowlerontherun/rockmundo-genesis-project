# ADR 0003 — Server-authoritative booking and performance

Date: 2026-07-23
Status: Accepted

## Context

Parts of the current festival system compute settlement and performance
outcomes client-side. VIP entitlement checks are UI-only in some flows.
This is unsafe and blocks trust in leaderboards, finance and history.

## Decision

All money movement, VIP eligibility, contract creation, activity blocking
and performance result calculation happens in Postgres RPCs (SECURITY
DEFINER where appropriate). The client:

- Never mutates balances.
- Never writes contract acceptance without an RPC call.
- Never computes final performance rewards.
- Never trusts a UI-only VIP flag; every founding + upgrade RPC re-checks
  `has_active_vip(profile_id)`.

## Consequences

- Slightly more RPC surface area.
- Client can be simpler and safer.
- Idempotency keys required on all state-changing RPCs.
