# Player Teaching and Mentoring Audit

## Scope reviewed

Repository search covered education pages and docs, `useTeaching`, `useMentorSessions`, skill catalogue/progression utilities, scheduling hooks, payment/ledger migrations and functions, social relationship helpers, band systems, admin progression diagnostics, mastery and maintenance utilities, recommendation surfaces, notification helpers, and Supabase teaching/mentor-related migrations.

## Current player teaching functionality

Player-led teaching exists only as a lightweight friendship-based hook around `player_teaching_sessions`.

Current flow example:

1. A teacher must have one unlocked teaching tier: `teaching_basic_teaching`, `teaching_professional_teaching`, or `teaching_mastery_teaching`.
2. The teacher selects an accepted friend and a skill.
3. The client checks same-profile teaching, accepted friendship, teacher skill level, active-student count, and duplicate active session.
4. The client calculates `student_xp_earned` and `teacher_xp_earned` from tier constants and duration.
5. The client inserts `player_teaching_sessions` with status `in_progress`, precomputed XP totals, and duration.
6. A client effect later marks expired sessions `completed`.

This is not end-to-end authoritative progression. Missing stages are: scheduler booking, invitation acceptance, attendance validation, payment reservation, server-side XP calculation, actual skill XP settlement, idempotent completion, reviews, reputation, mastery reward settlement, maintenance event creation, and anti-collusion telemetry.

## Current NPC lesson and education functionality

NPC-style learning is represented by the shared progression balance activity ranges and education multipliers. `PROGRESSION_BALANCE.activities.lesson` is `[120, 260]`, university courses are `[250, 600]`, and education multipliers include `lessonMultiplier: 1.25`, `universityMultiplier: 1.45`, and `mentorMultiplier: 1.2`. This makes NPC/education benefits mechanically distinct from player teaching but also reveals multiple formulas in client utilities and docs.

Concrete NPC lesson example from current balance: a lesson activity grants from the lesson XP range, then education/progression consumers may apply lesson or learning modifiers. Unlike the legacy player teaching hook, this path is tied to shared progression constants rather than a friend session row with client-precomputed XP.

## Current mentorship systems

`mentorshipProgression` provides a standalone bonus calculator. It can award mentor XP per day, mentor fame per day, mentee XP multipliers, and skill boost percent from a broad account-level gap and teaching experience count. This conflicts with the desired no-passive-XP model because a relationship can imply daily rewards without a completed learning activity. It also does not validate skill-specific advantage, scheduler participation, payment, repetition, mastery, or maintenance.

## Session booking, scheduling and attendance

The activity scheduler has a `teaching` activity type, but the player teaching hook does not use shared scheduling. Legacy player sessions are started immediately and auto-completed after `session_duration_days`. Attendance, location, travel feasibility, accepted invitations, no overlapping activities, no booking in the past, and per-participant workshop attendance are not enforced in the hook.

## Payment flow

No complete player-teaching payment flow was found in the hook. It does not reserve funds, settle payment after completion, refund cancellations, write economy ledger rows, prevent negative balances, or make settlement idempotent. Other payment systems in the repo use function/table-specific flows, but teaching does not currently share them end to end.

## Skill XP awards

The legacy hook stores `student_xp_earned` and `teacher_xp_earned` on the session row, but it does not call a shared skill XP grant/ledger function in the reviewed code. The most serious issue is that XP amounts are calculated client-side before insert, which means the session row itself is not a trustworthy reward source.

## Teaching-skill usage

Teaching skill exists as tiered slugs and is used as an unlock gate in the hook. The tier constants are counterintuitive: professional teaching requires a lower target-skill level than basic teaching, and mastery teaching allows any skill at level 1+ with two active students. This conflicts with meaningful teacher advantage and could let weak target-skill teachers produce high student rewards.

## Mastery integration

Mastery has teaching-related hooks: some specialisations recommend `teaching`, challenges include `teaching_sessions`, and `calculateMasteryRewardXp` supports `source: "teaching"`. The legacy teaching hook does not integrate these safely and cannot enforce mastery coaching eligibility or bounded mastery XP settlement.

## Bandmate learning behaviour

Shared balance contains `bandmate_learning: [25, 80]`, but legacy player teaching only allows accepted friends and does not understand band membership, role relevance, rehearsals, song familiarity, band cohesion, or circular coaching safeguards.

## Reputation, reviews and privacy

No end-to-end teaching review or reputation flow was found in the legacy hook. Teacher profiles/listings, aggregate ratings, one review per completed session, moderation, minimum sample smoothing, public privacy filtering, hidden-skill protection, and cancellation records are missing.

## Duplicate or conflicting formulas

- `useTeaching` has local tier config and local XP ranges.
- `PROGRESSION_BALANCE` has canonical activity ranges and education multipliers.
- `mentorshipProgression` grants passive daily mentor/mentee benefits.
- Mastery has separate teaching challenge and XP formulas.
- Skill maintenance treats teaching as a qualifying activity for some policies.

These should converge behind an authoritative teaching calculator and settlement RPC/function.

## Abandoned or partial features

- `player_teaching_sessions` appears to be a partial social hook rather than a complete education system.
- Mentorship bonuses are detached from scheduled sessions and goals.
- Scheduler has a teaching activity type but no complete teaching booking lifecycle.
- Teaching mastery challenges exist without a robust source of valid completed teaching events.

## Known bugs and exploit risks

- Client can submit precomputed XP totals through the teaching session insert path.
- Client can auto-complete sessions by update without authoritative attendance or payment settlement.
- Same teacher/student repetition has only active duplicate blocking; completed repeat farming is not diminished.
- No meaningful student skill comparison is enforced.
- No hidden-skill teachability policy is applied.
- No idempotency key prevents double settlement if future reward code trusts session completion.
- No payment escrow prevents circular payment or negative-balance issues.
- No review gating prevents future fake reviews unless added server-side.
- Passive mentorship formulas could become an XP/fame farm if wired directly.

## Follow-up social progression work

A future social PR should consolidate mentorship identity, trust/reputation, blocking/reporting, social contracts, and safe new-player discovery so teaching reputation becomes part of the wider MMO social graph without making mentorship mandatory.
