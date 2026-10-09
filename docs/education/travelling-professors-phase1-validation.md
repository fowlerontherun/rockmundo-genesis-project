# Travelling Super Professors — Phase 1 validation checklist

This feature is **not live** until the migrations are applied and verified.

## Database checks
1. Apply migrations in timestamp order, including the existing atomic university attendance migration.
2. Verify `travelling_professors` contains one entry per distinct canonical university-course skill family.
3. Verify every skill with a university course has one `professor_skill_memberships` row.
4. Call `rotate_travelling_professors` using the service role for the current UTC month; confirm at most ten residencies.
5. Call it again; confirm no additional rows.
6. Attempt eleven overlapping residencies in a transaction; the eleventh must fail.
7. Attempt overlapping assignments for one professor; the exclusion constraint must fail.
8. Confirm `university_visiting_professor_bonus` returns 0.70 only for matching university, skill and time; otherwise 0.
9. Confirm unauthenticated users cannot insert or update professor assignments.
10. Confirm the rotation function cannot be called using an authenticated player's token.

## XP checks
- Automatic attendance: base award 200 XP with matching professor should record 340 XP in attendance, enrollment, profile and ledger.
- Non-matching course, university, or residency: remains 200 XP.
- Duplicate auto-attendance retry: no extra XP.
- Check UTC month rollover, maximum skill levels and already-completed enrollments.

## Known blockers
- Manual attendance still writes skill XP directly from the browser and does **not** use the authoritative attendance RPC.
- No production monthly cron invocation is configured.
- UI banners, notifications and world-map visibility are not yet implemented.
- Current rotation matches at most one professor per university, so if there are fewer than ten universities, fewer than ten professors can visit.
- No live database migration or end-to-end test has been run in this branch.
