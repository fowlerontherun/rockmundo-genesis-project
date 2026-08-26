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

Students must already have the subject skill unlocked and the teacher must be at least two levels ahead at enrolment. Students can hold at most three upcoming player classes and can receive rewards from the same teacher / skill pairing at most twice in seven days.

Class settlement requires a server-timed check-in window and cannot occur until the configured duration has elapsed. Completion revalidates the relationship and skill gap. Skill XP is calculated and applied server-side. Paid classes settle through the canonical Finance journal only after verified attendance; free classes use the same attendance/reward path without a transfer.

Per-student settlement failures remain visible on the enrolment and can be retried rather than being recorded as successful.

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

All canonical D10 tables have RLS enabled. The authenticated role has SELECT-only table privileges; all state changes go through authenticated RPC boundaries. Internal block and skill-XP helpers are not executable by browser roles.

## Verification

A rollback-only production lifecycle test exercised the real auth/profile boundary and then:
1. opened a verified mentor profile;
2. requested and accepted mentorship;
3. advanced the mentee's canonical skill level;
4. proved exactly one milestone reward was generated;
5. created a player-led class;
6. enrolled and checked in the student;
7. completed server-side class settlement;
8. proved skill XP and teacher progression rewards were recorded;
9. rolled back the complete fixture.

The test exposed an incorrect skill-XP threshold function reference during development. That was corrected to a private D10 threshold helper matching the current 20-level progression table, and the complete lifecycle subsequently passed.

Supabase security advisors show no D10-specific function warning. Remaining advisor findings are pre-existing project findings outside D10 scope.
