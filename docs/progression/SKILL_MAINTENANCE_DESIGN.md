# Skill Maintenance Design

## Permanent vs temporary state
- **Earned level:** permanent normal skill progression; never reduced by inactivity.
- **Mastery rank:** permanent veteran progression; ranks, XP, titles and unlocks remain intact.
- **Sharpness:** temporary 0-100 readiness derived from recent meaningful use.
- **Rust:** bounded temporary reduction in sharpness after a long grace period.
- **Recovery:** relevant completed activity that restores missing sharpness quickly.

The system must not directly decrease normal skill level, lifetime XP, mastery XP, mastery rank, unlocked specialisations, achievements or titles.

## Catalogue metadata
Canonical skills expose `supports_maintenance`, `maintenance_policy_key`, `maintenance_threshold_level`, `maintenance_grace_days`, `maintenance_floor` and `recovery_rate_key`. Eligibility is derived from canonical tier/type/foundation/activity metadata, not hard-coded slug lists.

## Policies
- `none`: 100 sharpness, no rust.
- `advanced_light`: threshold 60, 30-day grace, floor 85, slow rust, light recovery.
- `professional_standard`: threshold 50, 45-day grace, floor 80, moderate bounded rust, standard recovery.
- `mastery_specialist`: threshold 80, 60-day grace, floor 75, veteran-only active-effect rust, accelerated recovery.

Rust is lazy and deterministic: first 30 post-grace days are very slow, next 60 moderate, long inactivity approaches the protected floor. There is no daily login pressure and no indefinite decay.

## Sharpness model and ledger
`player_skill_sharpness` stores profile, skill, sharpness, last qualified use, last calculation, policy and balance version. `skill_maintenance_events` stores idempotent sharpness-changing events without emitting daily decay rows.

## Qualifying use
A server-authoritative completion must be completed, attended, relevant to the assigned role/skill, at least 30 minutes, non-cancelled, non-duplicate, reward-bearing and backed by a valid source record. Unrelated activity and page opens never refresh sharpness.

## Recovery and comeback
First relevant sessions restore most missing sharpness; a second session usually gets near full sharpness. Comeback protection triggers after long meaningful inactivity (default 45 days), boosts the first recovery sessions, is capped at 100 and cannot exceed earned ceilings or repeatedly reactivate through short logout periods.

## Outcome integrations
Sharpness applies as a small bounded effectiveness/consistency modifier, not `sharpness / 100`. At 100 it is `1.00`; at 80 it remains around `0.97+`; at 75 it remains about `0.95+`. Songwriting, recording and gig integrations apply only to new calculations and configured skill contribution. Legacy songs, recordings and gigs are not recalculated. Learning XP is not reduced by rust.

## Role protection and burden limit
Current role-focus/core skills can receive +15 grace days, +5 floor and faster reminders, but switching focus does not reset timestamps. Because only advanced/professional/mastery skills are eligible and floors are high, maintaining several core specialties does not become a checklist.

## Player-facing bands
Sharp, Ready, Slightly Rusty, Rusty and Recovering show current sharpness, practical effect, last qualifying use, grace status, role protection, comeback bonus and recommended recovery action only for eligible skills.

## Telemetry
Emit events for grace entry, practical rust threshold, recovery completion, full sharpness restoration, comeback activation/usage, recommendation followed, reminder preference changes and suspicious duplicate refresh attempts. Do not emit daily unchanged telemetry.

## Follow-up retention and returning-player work
Wire all completion functions to emit qualifying-use events, add opt-in reminders if notification preferences are available, expand role-based recovery recommendations with upcoming commitments, and add product copy testing for returning-player panels.
