# Nightclub NPC staffing authority — 19 October 2026

## Live production migrations
- `20261019075710_nightclub_staff_server_authoritative_roster_20261019`
- `20261019080046_nightclub_existing_staff_count_reconcile_20261019`

Both are already applied directly to Supabase project `yztogmdixmchsmimtent`. GitHub's corresponding migration files copy the **exact SQL** recorded by the Supabase migration ledger.

## What changed
Before cutover, the game sent `salary_weekly` with a browser INSERT and permitted the current club owner's browser to update or delete staff rows. This allowed invented wages/levels and unbounded rosters. That is not safe for clubs that will eventually host owner-sponsored DJ bookings.

`nightclub_staff_action_atomic` is now the **only** authenticated NPC hire/fire path. The server checks the caller's current active character and club ownership, locks the owned-club record, validates one of five NPC roles plus skill 1–5 and name 2–64 characters, enforces `min(20,max(5,ceil(capacity/100)+4))` headcount, and computes weekly salary from role base rates (bouncer 200, bartender 250, DJ 400, promoter 350, manager 500), with a 25% increment per extra skill level.

Every hire or dismissal creates a durable `nightclub_staff_action_receipts` row with an immutable request intent; retries of the same request return the existing action and never create or remove another employee. Changed-intent reuse is rejected. Active player ownership is independently checked by the RPC. Direct staff DML is revoked from browser roles; owner-scoped SELECT remains.

**Important:** This is NPC club staffing only. An NPC DJ employee is not a booked player performer, and their salary is not a concert payout. This does *not* establish a real weekly club wage debit or DJ residency fee escrow. It does not grant any rights to approve DJ performance bookings.

Legacy owners are allowed to manage their existing NPC staff through this bounded RPC but remain unverified for owner-funded DJ booking/residency authorization pending #4399. The old `staff_count` was incorrect for all four historical clubs; the follow-up migration reconciles it to the real 19 staff rows without modifying a staff record, salary, cash balance, or fee.

## Verified acceptance
- Live rollback-only contract: canonical level-2 promoter salary $438, one hire on exact request retry, no altered-intent reuse, rejects invalid skill, false staff ID and foreign club owner, enforces staff capacity, fires specified employee, checks no direct browser DML, and leaves zero action receipts.
- Live real `authenticated` role RLS/ACL contract: owner reads roster, cannot directly insert staff with arbitrary salary, can hire a $400 NPC DJ through the RPC, and then dismiss that employee through the RPC. Test uses `BEGIN/ROLLBACK`.
- Final live counts: **19 staff, 0 action receipts, 0 stale owner staff counts**.

The Phase 5 database gate includes both SQL tests. A fresh empty database can skip fixture-dependent assertions until seed/users are present; permission assertions still run. CI results must still be reviewed; this is not a claim that the comprehensive release gate is green.

## Security & follow-up
RPC is an intentional `SECURITY DEFINER` boundary because ordinary browsers cannot write staff. Anonymous execution is revoked, and the function validates owner UUID against `auth.uid()` and the active character. Supabase's generic authenticated-SECURITY-DEFINER advisory is expected for this design; verify manually against [Supabase's warning](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable).

Keep #4264 and #4265 open for actual resident DJ contracts, approval, owner-funded payouts, city-fans/attendance and end-to-end production certification. Historical duplicate ownership #4399 still requires financial proof rather than automatic verification.
