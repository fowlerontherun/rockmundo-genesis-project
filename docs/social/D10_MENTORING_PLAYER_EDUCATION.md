# D10 — Mentoring and player-led education

## Goal

D10 turns player-to-player learning into a server-authoritative progression system rather than a client-calculated teaching shortcut. It reuses the existing community mentorship data model, keeps the existing NPC Legendary Masters experience separate, and adds bounded player-led classes to Education.

## Mentorship lifecycle

Players may opt in as mentors only for skills they have reached level 5 in. Mentor discovery excludes the current player, blocked relationships, unavailable mentors and mentors who are already at capacity.

A mentee can request mentorship for an offered skill when the mentor is at least two verified skill levels ahead. The mentor can accept or decline. Either participant can leave an active or pending relationship without a gameplay penalty.

Limits include:

- maximum three active mentees per mentor;
- maximum two current mentorships per mentee;
- 14-day cooldown before repeating the same mentor / mentee / skill pairing;
- blocked players cannot discover, request or continue the relationship.

Mentee-wide request limits and mentor capacity decisions are serialized in the database, so simultaneous requests or accepts cannot bypass those limits. Mentor, relationship, class, and teacher views also reuse the common block/report actions rather than creating a separate safety path.

## Verified rewards

Mentorship rewards are derived from the canonical `skill_progress` row for the mentee. Accepting a mentorship snapshots the starting level. Progress checks award at most three milestones and each milestone has a unique ledger row, so repeatedly pressing the check button cannot duplicate rewards.

Mentor / mentee profile XP rewards are deliberately bounded:

- first verified level gained: 50 / 25 XP;
- second verified level gained: 75 / 40 XP;
- third verified level gained: 100 / 60 XP.

No reward is granted merely for creating or retaining a mentorship.

## Player-led classes

Education now exposes a separate **Player Learning** tab alongside the existing NPC mentor tab.

A player can teach a class only when:

- the subject skill is level 5 or above;
- the teacher has unlocked a teaching competency;
- the class is scheduled 1 hour to 30 days ahead;
- duration is 1–4 hours;
- capacity is 1–8 students;
- price is $0–$500;
- the teacher has fewer than four upcoming player classes.

Students must already have the subject skill unlocked and the teacher must be at least two levels ahead at enrolment. Students can hold at most three upcoming player classes and can receive rewards from the same teacher / skill pairing at most twice in seven days. The weekly cap counts both recent completions and active reservations under a per-student transaction lock, preventing parallel pre-booking from bypassing it.

Class settlement requires a server-timed check-in window and cannot occur until the configured duration has elapsed. Completion revalidates the relationship, weekly reward cap, and skill gap. Skill XP is calculated and applied server-side. Paid classes settle through the canonical Finance journal only after verified attendance; free classes use the same attendance/reward path without a transfer. A future teacher cancellation releases enrolled and already checked-in reservations because no payment has settled yet.

Per-student settlement failures remain visible on the enrolment and teacher read model. The teacher can retry them after the class closes, while a unique reward ledger and Finance idempotency key prevent duplicate XP or payment.

## Database authority

Per RockMundo project convention, all D10 database work was applied directly to the live Supabase database. No migration file is part of the D10 branch.

D10 reuses and hardens:

- `community_mentorship_profiles`
- `community_mentorship_matches`
- `community_mentorship_goals`

D10 adds live database structures for:

- mentorship reward evidence;
- player education classes;
- class enrolments / attendance;
- player-class reward settlement evidence.

All seven canonical D10 tables have RLS enabled with authenticated SELECT-only policies. Anonymous users have no table or D10 RPC access. Authenticated state changes go through identity-checked RPC boundaries, while the internal block and skill-XP helpers are not executable by either browser role. Missing foreign-key indexes and bounded value constraints were added directly to the live schema.

## Verification

A rollback-only production lifecycle suite exercised the real auth/profile boundary and then:

1. proved anonymous, authenticated, and internal-helper privileges match the documented authority model;
2. opened and discovered a verified mentor profile;
3. rejected an unauthorised mentorship response;
4. requested and accepted mentorship;
5. advanced the mentee's canonical skill level;
6. proved exactly one milestone reward was generated and replay was idempotent;
7. left without a gameplay penalty and enforced the repeat-pair cooldown;
8. created, enrolled in, and server-timed check-in to a player-led class;
9. completed settlement and proved the reward ledger cannot replay;
10. proved teacher cancellation releases a checked-in reservation;
11. enforced reservation-aware weekly anti-farming and the $500 price cap;
12. proved blocks remove both mentor and teacher discovery and prevent enrolment;
13. rolled back the complete fixture and retained zero test rows.

The test exposed an incorrect skill-XP threshold function reference during development. That was corrected to a private D10 threshold helper matching the current 20-level progression table, and the complete lifecycle subsequently passed.

After hardening, Supabase security and performance advisors report no D10-scoped findings. Remaining project-wide findings are pre-existing and outside D10 scope.
