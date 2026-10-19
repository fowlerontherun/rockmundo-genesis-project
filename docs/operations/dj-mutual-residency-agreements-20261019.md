# Resident DJ agreements — 19 October 2026

## Production database migrations (applied directly)
- `20261019110549_dj_nightclub_mutual_residency_agreements_20261019` — receipt-verified owner residency proposal, authenticated DJ acceptance/decline, either-party termination, and idempotent action records.
- `20261019110745_dj_residency_expiry_rollover_cron_20261019` — private hourly closure of expired proposals and plans whose last proposed slot has passed.

These migration files in `supabase/migrations` are copied from the **actual live** `supabase_migrations.schema_migrations` ledger of project `yztogmdixmchsmimtent`. They preserve the four unreceipted historical owner rows and existing DJ gig and finance tables.

## Player journey
A verified nightclub owner chooses a DJ who previously applied to and was **shortlisted for** that club, chooses **2, 3 or 4 weekly proposed sets** and a whole-dollar fee of $50 to the owner club's tier cap (at most $1,250). The first proposed show is the source application's existing time, between 3 hours and 14 days ahead.

The server computes each next occurrence using the club's own IANA timezone and **venue local wall clock** (`+ 7 days` to the local timestamp), not the player's device weekday or a naive `+168h` interval. Every occurrence must fit the actual DJ venue hours. A DST non-existent local time is rejected. The signed terms store the exact UTC starts as a PostgreSQL timestamp array, the venue timezone, fee and setlist ID. This is a real-calendar **weekly proposal cadence for canonical DJ bookings**; it is not the accelerated RockMundo *game-weekday* club theme-night calendar.

The DJ may accept or decline before 48 hours elapse (or one hour before the first proposed set, whichever is earlier). An agreed plan may be ended by either participant; the owner may withdraw a pending proposal. Ending does not cancel a show already booked separately.

## Security
- `nightclub_dj_residencies` and `nightclub_dj_residency_actions` expose only actor-scoped RLS `SELECT`; client DML/anonymous access is revoked.
- Owner proposal RPC requires the selected active owner character, authentic `auth.uid()` and immutable matching purchase receipt, an open club, a shortlisted DJ from another account, bounded fee and week count, valid local club hours and venue timezone.
- Response RPC verifies selected DJ character for accept/decline and verified active owner or selected DJ for termination.
- Unique owner request keys and action receipts enable exact retry without duplicate agreements; changed-intent replays fail.
- A partial unique index permits at most one live residency plan per club/DJ pair. The hourly private `pg_cron` task closes expired/finished plans, freeing future proposals.
- Historical ownership entries with missing purchase receipts **do not receive new rights**.

## Important finance and Schedule boundary
**An agreed residency is not a confirmed, paid DJ booking and cannot mint a stage hold or money.** These contracts involve no debit, payout, attendance, XP, fans or scheduling inserts. Every one of the proposed dates must still have its own verified, *fully escrow-backed* DJ offer and canonical booking, including licensing, travel, current city, club hours, conflict and payout conservation checks. A later implementation should make preparing and funding each agreed occurrence convenient and link it durably to its residency; that future capability is not falsely claimed here. Release flags remain disabled.

## Verification
`supabase/tests/dj_residency_mutual_consent_contract.sql` passed directly against live production inside `BEGIN/ROLLBACK`: temporary receipt-verified owner purchase, same-city DJ, licensed synthetic track, shortlist, agreement proposal, local weekly slot calculation, exact and changed-intent retry checks, unauthorised actor rejection, DJ acceptance/replay, owner termination, expiry worker first sweep closing one row and second sweep changing zero rows, **no cash, booked gigs or funded offers**.

`supabase/tests/dj_residency_authenticated_role_contract.sql` separately passed under actual Postgres `authenticated` role: the owner may propose through the RPC and SELECT the proposal, the named DJ may see and accept it, and the browser cannot UPDATE the proposed fee or directly INSERT a residency action.

Both are wired to `scripts/gigs/run-db-gate.sh`. Neither test leaves a permanent fixture. Full release certification remains in #4265; the historical duplicate owner title investigation is #4399.
