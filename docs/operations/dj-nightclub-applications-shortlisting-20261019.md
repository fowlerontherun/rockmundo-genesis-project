# Receipt-verified nightclub DJ applications and owner shortlisting — 19 October 2026

## Production migration

Applied directly in Supabase project `yztogmdixmchsmimtent`: **`20261019091128_dj_verified_club_applications_and_shortlisting_20261019`**. The exact SQL from `supabase_migrations.schema_migrations` has been committed under `supabase/migrations/`.

This is a **pre-contract interest pipeline**, not an attempt to bypass the existing disabled scheduled DJ booking rollout.

## Workflow

1. An active DJ character visits a nightclub with an **open and receipt-verified owner**, chooses a rights-checked saved DJ set and proposes a set start between 15 minutes and 14 days in the future.
2. The server checks actor, selected active profile, DJ's club city, saved set owner, valid track count, club quality/duration, verified ownership, request-id replay, max 5 outstanding DJ applications per character, and overlaps with active applications and already booked DJ slots.
3. The owner views pending applications in **Nightclub Management → DJ applications**, alongside the existing read-only booked DJ roster and recurring genre-night settings. Only the selected active profile backed by matching purchase receipt can shortlist or decline.
4. The DJ sees `pending`, `shortlisted`, `declined` and `withdrawn` status on the nightclub page; they can withdraw pending or shortlisted applications.
5. A shortlist means **interest only**. It does not turn into a DJ booking, does not block a venue slot or add to Schedule, does not offer pay/escrow, and **does not credit fame, experience, energy or cash**. Bookings and payouts are still governed by the disabled `DJ_SCHEDULED_BOOKINGS_ENABLED` server flag and require a separate funded offer contract.

## Security and replay

- `dj_club_applications` has RLS enabled, authenticated owner/applicant **SELECT** only, and no public/anon/authenticated direct table writes. Owner SELECT requires the precise receipt-backed club/profile/user match.
- Application create validates the account, selected active DJ character, open verified club, city, set ownership and future proposed slot, with a per-actor and per-club advisory lock to prevent racing duplicate/overlapping requests.
- `(user_id,request_id)` is unique; exact retry returns the original application ID while a changed request fails.
- Owner decision requires the current active owner's verified receipt and is a **one-time** `shortlist` or `decline`. `(reviewer_user_id,review_request_id)` ensures replay idempotency, and a second different review fails.
- Applicant withdrawal is idempotent and refuses an unrelated account.
- The actual reservation service still performs song rights/consent checks again when booking and playing; an old setlist never creates a right to perform licensed content.

## Verification

Rollback-only live production SQL:

- `supabase/tests/dj_club_application_shortlist_authority.sql` passed for synthetic receipt-backed club purchase, synthetic rights-confirmed DJ audio, new saved set, exact replay, changed-intent refusal, overlapping application refusal, foreign actor denial, owner shortlist, identical review replay, no second review, DJ withdrawal and no generated `dj_bookings`.
- `supabase/tests/dj_club_application_real_authenticated_role.sql` passed under the **actual Postgres `authenticated` role**. It confirmed reading a submitted application and owner review through the RPC while rejecting direct `UPDATE` from a player session.

Both tests use `BEGIN/ROLLBACK`, leave no synthetic clubs, audio tracks, setlists, applications, bookings or cash changes behind, and are included in the Phase 5 DB gate.

## Remaining work

The owner-funded performer contract, DJ residency repeat schedule, reliable held slot/calendar event, cancellation/refund, and settlement of nightclub owner funds versus performer earnings require a dedicated server ledger before a shortlist may become a confirmed gig. #4264, #4246 and #4265 should remain open. Historical duplicate/unreceipted club owners (#4399) cannot use the verified-owner shortlisting controls until purchase history is reconciled.

## Multiple applicants for one proposed slot

Follow-up production migration **`20261019092152_dj_multiple_applicants_same_club_time_20261019`** refines the pending proposal conflict predicate: multiple **different** DJs may apply for the same club/time so the owner can choose whom to shortlist, while any one DJ cannot submit overlapping proposals. Existing actual `dj_bookings` still prevent conflicting proposals. The live rollback-only two-player test `supabase/tests/dj_club_multiple_applicants_same_slot.sql` passed and is part of the Phase 5 gate.

## Durable review replay after withdrawal

Production follow-up migration **`20261019092559_dj_owner_review_decision_durable_replay_20261019`** stores the original owner `review_decision` alongside its immutable review request ID. A lost acknowledgement can be replayed using that same request ID even if the DJ has since withdrawn the application. Changed decisions still fail. The live rollback-only authority test was extended and passed for this sequence, and is included in the existing DB gate.
