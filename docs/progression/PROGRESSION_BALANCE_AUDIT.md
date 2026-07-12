# Progression Balance Audit

Date: 2026-07-12. Production telemetry was not available, so estimates use repository constants and deterministic modelling assumptions.

## Current findings

- Skill progression was split between client helpers, edge functions and SQL migrations. The most important conflict was `100 * 1.5^level` in `supabase/functions/progression/handlers.ts`, while the canonical catalogue carried `progression_curve_key` metadata but did not own the numeric curve.
- Player level XP uses a separate `250 * 1.15^level` curve in `src/utils/gameBalance.ts`; it is retained because it is player-level progression, not skill-level progression.
- Canonical skills have `max_level = 100` in the catalogue migration, while the progression Edge Function still capped skill spending at 20 for tier compatibility. This PR centralises skill curve helpers for 100-level catalogue rows and documents the tier-gate edge case for follow-up migration.
- Practice copy advertised 5 XP per one-hour session and 5 sessions per day. Stage-practice history mentions a separate 500 XP daily cap. These are inconsistent and made practice rewards hard to explain.
- Attribute training used `120 + currentValue * 0.85`, making early upgrades expensive and elite upgrades too linear for a 0–1000 scale.
- Learning modifiers used weighted canonical links but the effective cap could be 50%, with no diminishing-return curve.
- Skill XP sources found: manual SXP spending, daily stipend SXP, practice, books, mentors, university attendance, rehearsals, stage practice, co-op/relationship actions, random events and admin/special XP.
- Attribute Point sources found: daily stipend, streak bonuses, VIP stipend modifier, admin/special flows and wallet migrations. No unlimited AP grind was identified in the reviewed primary path.

## Current progression risks

1. Direct client payloads can request arbitrary `spend_skill_xp` amounts, though server wallet balance checks prevent overspending.
2. Edge Function skill curves were not tied to catalogue curve keys, so UI previews and awards could diverge.
3. Attribute-based learning bonuses could compound too strongly with future effectiveness formulas.
4. Practice copy, practice hooks and server progression rules had duplicate constants.
5. Existing per-level `current_xp` rows need safe cumulative conversion before any storage migration.

## Representative estimates before rebalance

Assumptions: one practice session/day = 5 XP, old edge curve `100 * 1.5^level`, no education.

| Player | Activity | Result |
| --- | --- | --- |
| New player | 1 practice/day | Level 1 takes 20 days; poor onboarding. |
| Regular casual | 2 practice/day | Level 3 takes about 48 days. |
| Highly active | 5 practice/day | Level 5 takes about 53 days. |
| Established veteran | high existing level | Later levels rapidly become unreachable due to exponential single-level costs. |

## Attribute estimates before rebalance

Assumptions: 6 AP/day, 10-point upgrades. First 10-point upgrade at value 0 costs 120 AP (20 days), while value 900 costs 885 AP (148 days) for only 10 points. This is both too slow early and not deliberately banded at elite levels.

## New audited direction

The new `progression_v2.0.0` configuration centralises named segmented curves, practice rules, activity bands, education multipliers, attribute cost bands, learning caps, beginner bonuses, catch-up rules and role-focus metadata in `src/utils/progressionBalance.ts`.

## Possible exploits and dead ends

- Repeated practice completion must be idempotent server-side before large rewards are enabled.
- Beginner and catch-up bonuses must be tracked at profile/account level, not inferred only from current skill level.
- Legacy rows storing per-level XP must be converted to lifetime XP using `max(new curve cumulative XP for current level, converted legacy cumulative XP)`.
- Max-level skills must reject overflow and avoid consuming SXP for no progress.

## Follow-up progression integrations

- Move the v2 balance table into a database-backed generated config consumed by Edge Functions.
- Add idempotency keys to every activity reward ledger.
- Convert legacy `current_xp` rows to lifetime XP in a guarded migration.
- Connect education, rehearsal, songwriting and recording award calls to the shared activity source map without adding outcome formulas.
