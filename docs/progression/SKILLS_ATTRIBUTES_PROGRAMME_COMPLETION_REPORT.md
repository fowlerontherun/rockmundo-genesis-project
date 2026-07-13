# Skills and Attributes Programme Completion Report

## Delivered capabilities

The programme now has canonical skill and attribute catalogues, explicit relationships, shared XP/AP formulas, maintenance policies, balance validation, simulations, admin diagnostics, migration review, operations guidance and contributor guidance. Active skills no longer pass validation unless they have explicit attribute and system links.

## Architecture summary

Shared typed modules own rules, server functions own authoritative writes, the database owns profile-scoped state and ledgers, and the client owns display and accessibility. Long-running activities capture a balance version and completed legacy outcomes remain immutable.

## Known limitations

Some subsystem journey coverage remains partial, especially DB-backed recording, gig, teaching, band progression and long-running activity fixtures. Several legacy migrations and helper comments remain documented rather than removed because production data proof is required. Broad rebalancing was intentionally avoided.

## Player impact

Players should see more consistent skill names, safer legacy handling and fewer mismatches between displayed effects and implemented behaviour. No retroactive rerolling or destructive migration is included.

## Security controls

Reward and spend paths are documented as server-authoritative, idempotent and profile-scoped. Admin diagnostics and repair actions require authorization and dry-run reporting. Hidden content must remain protected by RLS and server filtering.

## Test coverage and operational readiness

`npm run validate:progression-programme` gates catalogue completeness, rule ownership, fallback checks and required documentation. Existing balance, achievement, smoke, typecheck, lint and build gates remain relevant.

## Post-programme follow-up recommendations

1. Add Supabase RLS harnesses specifically for progression ledgers, hidden skills and admin diagnostics.
2. Convert remaining preview endpoints to server calculator calls where not already proven.
3. Add Playwright journeys for new musician, songwriter, recording musician, veteran teacher, returning player and band progression.
4. Add query-plan-driven indexes after staging telemetry.
5. Promote fallback usage and error-rate metrics to the admin dashboard.

## Source-of-truth rule matrix

| Rule | Authoritative source | Consumers | CI guard |
|---|---|---|---|
| XP required per level | `src/utils/progressionBalance.ts` (`PROGRESSION_BALANCE.curves`, `getXpRequiredForLevel`) | practice, dashboards, simulations | `npm run validate:progression-programme` |
| Cumulative XP and level from lifetime XP | `src/utils/progressionBalance.ts` helpers | UI progress, ledgers, analytics | validation command plus unit tests |
| Maximum skill level | `CANONICAL_SKILLS.max_level` | unlocks, spend validation, UI | catalogue validation |
| Practice daily limit and reward | `PROGRESSION_BALANCE.practice` | server progression functions and UI previews | validation command |
| Attribute upgrade cost and cap | `getAttributeUpgradeCost`, `PROGRESSION_BALANCE.attribute` | AP spend, Attribute UI | validation command |
| Learning bonus cap | `PROGRESSION_BALANCE.learning` and `calculateWeightedLearningMultiplier` | practice, lessons, education | validation command |
| Songwriting weights | canonical system links plus songwriting calculator | previews and completion | cross-system tests |
| Recording weights | canonical role/system links plus recording calculators | previews and completion | cross-system tests |
| Gig weights | canonical role/system links plus gig calculators | readiness and gig completion | cross-system tests |
| Mastery rank requirements | catalogue mastery metadata and mastery migrations | mastery UI and services | catalogue validation |
| Maintenance grace period | `src/utils/skillMaintenance.ts` policy metadata copied onto catalogue | sharpness UI and services | validation command |
| Teaching repetition penalty | teaching outcome calculator/balance config | lessons and mentoring | teaching tests |
| Achievement rewards | achievements validator/config and server events | achievement completion | achievement tests |
| Role-readiness threshold | canonical role links | band/gig/recording readiness | cross-system tests |
