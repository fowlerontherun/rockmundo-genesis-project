# Player Teaching, Mentoring and Collaborative Skill Development Design

## Activity model

Player learning relationships are intentionally separate:

- **One-off lesson:** a focused scheduled one-to-one session for one teachable skill. It has price, duration, attendance, completion, XP settlement, teacher rewards, and review eligibility.
- **Mentoring relationship:** a longer-term social relationship with goals, recurring session limits, reviews, recommendations, and small relationship modifiers. It grants no passive XP.
- **Band coaching:** a bounded bandmate activity for role-relevant skills, song preparation, cohesion, and rehearsal-linked learning. It is cheaper and smaller than private lessons.
- **Workshop:** one qualified teacher instructs a small validated group. Per-student effectiveness is lower than one-to-one teaching, and teacher rewards are capped.
- **Professional coaching:** advanced specialist training tied to mastery, production, live performance, songwriting, or career systems. It has higher requirements, higher cost, and bounded outcomes.

## Authoritative calculator

`src/utils/teachingOutcomeCalculator.ts` defines versioned teaching policies and `calculateTeachingOutcome`. Production settlement should be wrapped by a Supabase RPC/Edge Function that accepts identifiers and choices only: teacher, student(s), skill, session type, scheduled activity, duration, price, optional mentoring relationship, and balance version.

The server fetches profile ownership, availability, skill state, teaching skill, attributes, mastery, relationship state, prior pair sessions, payment reservation, activity completion, and balance configuration. Clients must never submit XP, quality, mastery XP, reputation rewards, or completion outcomes.

## Teachable skill metadata

Canonical skills are projected into `TEACHABLE_SKILLS` with metadata equivalent to:

- `is_teachable`
- `minimum_teacher_level`
- `minimum_teacher_advantage`
- `teaching_policy_key`
- `supports_group_workshop`
- `supports_band_coaching`
- `supports_mentoring`

Hidden, inactive, and mastery-system skills are not publicly teachable unless explicitly given a public policy later.

## Teaching policies

Policies are centralized and versioned:

- `foundation_lesson`
- `standard_skill_lesson`
- `advanced_specialist_lesson`
- `mastery_coaching`
- `bandmate_coaching`
- `group_workshop`

Each policy defines teacher level, teaching-skill requirement, capacity, base duration, XP range, advantage requirement, repetition penalties, cooldown, price limits, mastery requirement, maintenance credit, and teacher rewards.

## Eligibility

A teacher is eligible only when the skill is teachable, the session type supports it, the teacher is not restricted, both participants are available, payment has been reserved where required, the teacher meets target skill and teaching skill requirements, the teacher has meaningful advantage, and any mastery/band/group requirements pass.

## Teaching quality formula

Teaching quality is bounded and uses diminishing returns:

- 42% target skill advantage
- 25% teaching skill
- 13% mastery/specialist expertise
- 12% Mental Focus
- 8% Charisma
- small relationship/format modifier

The target skill matters most, but a brilliant performer with no teaching skill is inconsistent and a teacher with little target-skill advantage cannot deliver elite outcomes.

## Student-learning formula

Student XP is calculated as:

`base policy XP × teaching quality modifier × student learning modifier × duration modifier × difficulty modifier × repetition modifier × relationship modifier`

The target skill receives the main XP. Supporting XP, mastery XP, and sharpness recovery must be explicit settlement events. XP is capped by policy and by normal progression rules; max-level skills receive no normal target XP.

## Repetition and diversity

Repetition is tracked by teacher/student/skill in a rolling window. The first session is full value, the second remains useful, the third is reduced, and further repeated sessions are strongly diminished. Mentoring can soften the relationship experience through recommendations and small rapport bonuses, but it must not remove repetition penalties.

Diversity incentives are recommendation-based: practice after a lesson, apply coaching in rehearsal/gig/recording, alternate self-led and teacher-led learning, or consult specialists for complementary skills.

## Mentoring

`mentoring_relationships` should store mentor/student IDs, target role, status, start/end, next review, session limit, agreed price, and metadata. Goals are authoritative targets such as reaching a skill level, unlocking a specialist skill, preparing for a gig/recording, restoring rusty skills, or completing songwriting. Goal completion can grant modest recognition/reputation, not large XP windfalls.

## Band coaching and rehearsals

Band coaching requires shared band membership, coach advantage, participant attendance, and role relevance. Rehearsal-linked coaching is a small focus inside rehearsal that can grant targeted XP, song familiarity, and cohesion, but never full private-lesson rewards.

## Workshops and professional coaching

Workshops support 2–5 students with per-student validation, lower effectiveness, capped teacher rewards, and no reward for absent students. Professional coaching requires advanced teaching skill, target expertise, and possibly mastery rank or reputation.

## Pricing, payments and settlement

Booking reserves payment atomically. Completion settles once, refunds eligible cancellations, applies no-show policy, pays the teacher, writes ledger entries, and emits telemetry. Price bounds come from policy. Free bandmate coaching is allowed but still subject to XP caps and anti-farming checks.

## Reviews and reputation

One review is allowed per completed qualifying session. Cancelled or uncompleted sessions cannot be reviewed. Aggregate ratings use smoothing/minimum sample sizes. Reputation blends completed sessions, attendance, ratings, student outcomes, cancellation rate, repeat students, mastery, and challenge difficulty rather than raw volume.

## Mastery and maintenance

Mastery can unlock professional coaching, improve consistency, slightly increase group capacity, or grant bounded mastery XP where configured. Teaching counts as skill maintenance only when the maintenance policy allows `teaching`, and trivial repeated teaching cannot fully preserve elite sharpness.

## Anti-collusion controls

Controls include pair repetition penalties, reciprocal activity telemetry, duplicate completion idempotency, account/profile relationship checks, free-session caps, payment/XP caps, fake-review gating, circular payment diagnostics, and admin-visible suspicious patterns. Safeguards should flag and diminish suspicious behavior rather than automatically punish legitimate household players.

## UI and admin integration

Skills pages should show whether teaching is available, compare practice/NPC/player routes, preview XP range and penalties, and surface current mentor/goals/upcoming lessons. Band pages can request/offer coaching and add rehearsal focus without letting leaders force paid lessons. Teacher dashboards stay concise. Admin diagnostics are read-only and show policies, sessions, pairs, XP, payments, reviews, repetition, mastery, suspicious reciprocity, duplicate attempts, and balance version.

## Migration and legacy compatibility

Existing NPC lessons, university courses, self-practice, and legacy sessions remain valid. Legacy `player_teaching_sessions` should be migrated or read as incomplete unless they have authoritative scheduler, attendance, and payment records. Existing mentor records should become relationships/goals without granting passive XP.

## Telemetry

Track listing creation, search, preview, request, accept/decline, completion, XP awarded, payment settled, review submitted, relationship started, goal completed, workshop completed, repetition penalty applied, and suspicious pair activity. Do not log private notes or message content.

## Follow-up social progression work

Follow-up work should connect teaching reputation to broader trust, contracts, social identity, moderation-safe discovery, and community onboarding while preserving solo viability and avoiding predatory new-player coaching.
