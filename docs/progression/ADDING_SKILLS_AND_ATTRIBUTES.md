# Adding Skills and Attributes

New progression content is incomplete until catalogue validation, relationship validation, balance validation, translations and representative simulations pass.

## New skill checklist

1. Add `CANONICAL_SKILLS` metadata: slug, name, description, category, type, tier, max level, progression curve and active state.
2. Add explicit attribute learning links in `CANONICAL_ATTRIBUTE_LINKS`; regex fallback is forbidden for active skills.
3. Add prerequisites or an explicit not-applicable/starter route.
4. Add unlock route, role links where applicable and system links for every outcome system that consumes the skill.
5. Set practice eligibility, mastery policy, maintenance policy and teaching policy.
6. Add UI translation keys and player-facing effect descriptions that match implemented effects.
7. Add tests for catalogue completeness, cross-system mapping, reward/spend handling and previews.
8. Run `npm run validate:progression-programme`.

## New attribute effect checklist

1. Add metadata, max value, increment and cost policy.
2. Link affected skills and calculators explicitly.
3. Add preview support, analytics support and a player-facing description.
4. Run sensitivity tests to verify it is measurable but capped.
5. Document any limitation in the final audit and operations runbook.

## Done definition

A change is done only when active content has a purpose, implemented gameplay effect, observable event path and safe legacy behaviour.

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
