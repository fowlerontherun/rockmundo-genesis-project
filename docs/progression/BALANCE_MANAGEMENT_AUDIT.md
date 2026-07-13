# Balance Management Audit

## Summary
Current progression balance is split between TypeScript utilities, Supabase Edge Functions, catalogue data, migrations/RPCs, and feature-specific calculators. The riskiest findings are duplicated client/server progression constants, hard-coded Edge Function rewards, no canonical balance registry before this PR, and incomplete immutable version snapshots on historical outcomes.

## Authoritative source table
| Rule area | Current source | Owner | Risk | New target |
|---|---|---|---|---|
| Player level XP curve | `src/utils/gameBalance.ts` | Client utility | Client/server mismatch | `balance_versions.config.progression` |
| Daily SXP/AP | `supabase/functions/progression/handlers.ts` | Server | Hard-coded rewards | `progression` and `attributes.apIncome` sections |
| Attribute keys/caps | `src/utils/attributeProgression.ts` | Client utility | UI metadata can drift | `attributes` section plus catalogue references |
| Practice rewards/limits | skill practice hooks/functions | Mixed | Exploit/cap drift | `practice` section |
| Skill catalogue | `src/data/skillTree.ts` and DB skill definitions | Mixed | Unknown key references | structural validation against catalogue keys |
| Songwriting outcome | songwriting calculators/docs | Mixed | Duplicated weights | `songwriting` section |
| Recording outcome | recording calculators/docs | Mixed | Duplicated weights | `recording` section |
| Gig outcome | gig functions and feature modules | Server-heavy | Many hard-coded percentages | `gigs` section |
| Mastery | mastery docs/config | Mixed | Rank/cost migration risk | `mastery` section |
| Maintenance | maintenance docs/config | Mixed | destructive sharpness changes | `maintenance` section |
| Teaching | teaching docs/policies | Mixed | pair farming | `teaching` section |
| Band progression | band contribution/reward systems | Server | repeated milestone risk | `bandProgression` section |
| Achievements | `src/features/achievements` | Client/server validation | repeat farming | `achievements` section |

## Hard-coded progression values found
- `src/utils/gameBalance.ts` contains level curve coefficients, reward modifiers, cooldowns and thresholds.
- `src/utils/attributeProgression.ts` contains attribute caps, increments, keys and UI descriptions.
- `supabase/functions/progression/handlers.ts` contains `PROGRESSION_BALANCE_VERSION`, role XP arrays, stipend AP/SXP caps, streak bonuses and conversion values.
- Gig, recording, education, wellness and achievement systems contain local percentages and caps that should be referenced through validated balance sections as follow-up migrations reach each calculator.

## Database-configured values
Existing migrations define many outcome tables and reward ledgers, but no single pre-existing `balance_versions` table was found. Some systems already include idempotency keys and harness tests, which are useful for exploit simulations.

## Client-owned values
Client utilities currently own level display, attribute metadata, some calculated bonuses and admin-facing previews. These must be treated as display mirrors only; clients must not choose the active balance version.

## Server-owned values
Supabase Edge Functions and RPCs are authoritative for progression awards, gig completions, recording completion and idempotent reward capture. New calculations should resolve the active version server-side and stamp `balance_version_key` plus a parameter snapshot.

## Duplicated formulas and version identifiers
`progression_v2.0.0` exists in `supabase/functions/progression/handlers.ts`, while client utilities independently encode level curves. This PR introduces a canonical registry and typed config to remove that mismatch over staged calculator migrations.

## Simulation tooling and test coverage
Prior docs include progression and maintenance simulation result files. CI did not include a single balance gate. This PR adds `npm run validate:balance` and `npm run simulate:balance` with deterministic scenario coverage.

## Admin controls, feature flags and rollback
Existing admin pages exist for focused systems, but no safe balance dashboard, validation workflow, scheduled activation or config rollback path existed. Rollback must reactivate an older config for new calculations only and must not rewrite completed outcomes.

## Migration risks and historical dependencies
Curve and reward changes can affect level preservation, AP affordability, mastery eligibility, maintenance sharpness and stored outcome interpretation. Completed records must retain the calculation version and relevant parameter subset.

## Known balance vulnerabilities
- Practice, teaching, achievement and milestone loops need caps plus idempotency checks.
- Veteran AP/SXP compounding can accelerate if daily income and sinks are changed together.
- Outcome score weights can silently exceed 100% or make secondary inputs dominant.
- UI text can claim one cap while config permits another.

## Follow-up live balancing work
Wire every production calculator to resolve `balance_versions` at runtime, backfill non-destructive version keys where possible, add seeded production-safe migration impact samples, and expose the dashboard route through the existing admin navigation after role names are finalized.
