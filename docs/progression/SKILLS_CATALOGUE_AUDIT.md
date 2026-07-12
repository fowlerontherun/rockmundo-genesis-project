# Skills Catalogue Audit

## Executive summary

RockMundo previously split skill metadata across database tables (`skill_definitions`, `skills`, `skill_relationships`, `skill_progress`, `player_skills`), frontend category arrays, education seed migrations, and regex learning-bonus rules. This made it possible for a skill to appear in one system but have no attribute mapping, role relationship, unlock route, or player-facing description.

This PR introduces a canonical catalogue adapter and matching database schema so active skills can be validated and queried with explicit metadata.

## Machine-readable summary

```json
{
  "canonical_table": "skill_definitions",
  "new_relationship_tables": ["skill_attribute_links", "skill_prerequisites", "skill_unlock_routes", "skill_system_links", "skill_role_links"],
  "active_foundational_slugs": ["guitar", "vocals", "drums", "bass", "songwriting"],
  "active_specialist_slugs": ["performance", "composition", "technical"],
  "legacy_fallback_patterns": ["instruments_*", "genres_*", "stage_*", "songwriting_*", "theory_*", "dj_*", "health_*", "business_*", "modeling_*", "fashion_*", "clothing_*"],
  "critical_risks": ["duplicate skill_definitions creation migrations", "legacy player_skills column model", "skill_progress slug model", "education content references skill slugs directly"]
}
```

## Catalogue tables found

- `skill_definitions`: the closest existing catalogue. It stores slug, display name, description, tier caps and default unlock level.
- `skills`: a later simple catalogue referenced by some book tables.
- `skill_relationships`: earlier dependency/synergy table that lacked typed prerequisite semantics.
- `skill_progress` / `profile_skill_progress`: profile-specific progression rows.
- `player_skills`: legacy wide table and later normalized rows used by older migrations and functions.
- `skill_books` and `university_courses`: education content with direct `skill_slug` references.

## Active skill slugs audited for this PR

The confidently mapped active gameplay skills are:

- `guitar`
- `vocals`
- `drums`
- `bass`
- `performance`
- `songwriting`
- `composition`
- `technical`

Extended seeded catalogues also contain genre, stage, instrument, fashion/modeling/clothing, production and education slugs. Those are not deleted. They remain follow-up mapping candidates if production data confirms they are active learnable skills.

## Duplicate or near-duplicate skills

- `songwriting` and `composition` overlap but represent different tiers: broad songwriting vs. advanced arrangement.
- `performance` and `stage_*` slugs overlap in live show systems.
- `technical`, `mixing`, `record_production`, and DAW-related slugs overlap in production systems.
- `guitar` and extended `instruments_*_guitar` style slugs may coexist.

## Inconsistent naming patterns

- Base skills use plain slugs (`guitar`, `vocals`).
- Extended skills often use namespaced tier slugs (`genres_basic_rock`, `instruments_basic_*`).
- Some systems still infer categories from substrings such as `stage`, `genre`, `songwriting`, or `instrument`.

## Code references missing from the confident canonical set

Regex fallback diagnostics now records legacy slugs such as `genres_basic_rock` when they are used without explicit relationship rows. These should be added to the canonical seed after product review rather than silently mapped by slug shape.

## Catalogue skills not used by any system

The extended genre/fashion/modeling/clothing skill seeds appear partially used by education content but are not consistently consumed by live gig, recording or skill tree systems. They are marked for follow-up rather than removal.

## Zero-level seeded skills

Legacy migrations seed new players with zero values in `player_skills` or `skill_progress` to preserve rows before a player has trained them. This PR preserves those rows and uses explicit availability status instead of treating every zero row as fully unlocked.

## Current categories and subcategories

Canonical categories introduced here:

- Instruments / Strings
- Instruments / Percussion
- Performance / Vocals
- Stage / Showmanship
- Songwriting / Composition
- Songwriting / Arrangement
- Production / Studio

## Current prerequisite relationships

- `composition` requires `songwriting` level 20.
- `technical` recommends `performance` level 15.

Older `skill_relationships` rows are left in place for compatibility but are superseded by `skill_prerequisites` for availability rules.

## Current attribute mappings

Explicit learning-speed mappings are weighted. Examples:

- `guitar`: Musical Ability 70%, Musicality 30%.
- `drums`: Rhythm Sense 70%, Musicality 30%.
- `vocals`: Vocal Talent 70%, Musicality 30%.
- `performance`: Stage Presence 60%, Crowd Engagement 40%.
- `technical`: Technical Mastery 70%, Creative Insight 30%.

## Known education or activity unlock routes

Current represented routes are starter profile unlocks for foundational skills and university-course unlocks for specialist skills. Book, lesson, rehearsal, performance and admin route types are supported by schema for existing/planned systems but are not used to introduce new gameplay in this PR.

## Suspected obsolete or risky skills

- Duplicate early migrations dropped/recreated `skill_definitions`.
- Some migrations reference `skills(skill_id)` while other code references `skill_definitions(slug)`.
- Legacy wide `player_skills` columns and normalized `skill_progress` rows coexist.
- Several database functions still use `LIKE` checks against skill IDs or slugs.

## Follow-up catalogue and balancing work

- Product-review every extended genre, instrument, fashion, modeling, clothing and stage slug.
- Decide whether plain base slugs or namespaced tier slugs are canonical for instruments and genres.
- Migrate SQL outcome functions away from `LIKE` skill checks.
- Add admin editing only after catalogue validation is stable.
- Use role/system links in future gig, recording and songwriting formulas without changing XP balance in this PR.
