# Skill System Overhaul

Based on the audit, the project has ~620 skill slugs across 20 families. Three structural problems and one big effect gap drive this plan.

## Problems found

1. **Naming inconsistencies / duplicates**
   - `songwriting_professional_vocal_production` sits between `songwriting_basic_vocal_processing` and `songwriting_mastery_vocal_processing` — pick one stem.
   - `songwriting_mastery_composing_anthems` breaks the `<prefix>_<tier>_<topic>` pattern (Basic/Pro use `_composing`).
   - 6 "capstone" instrument slugs exist only at Mastery (no Basic/Pro) — incompatible with the new gating rule.
   - `luthiery_*_technical` topic is semantically empty.

2. **Tier gating is not enforced**
   - `PROFESSIONAL_UNLOCK_VALUE = 250 XP`, `MASTERY_UNLOCK_VALUE = 650 XP` exist in `skillTree.ts` but NO learning source consults `SKILL_TREE_RELATIONSHIPS` before granting XP. University, books, mentors (via `relationship-action`), `progression.handleSpendSkillXp`, and client `useSkillPractice` all upsert `skill_progress` blind.
   - `MAX_SKILL_LEVEL` is 20 in the client and 100 in three edge functions — they disagree.

3. **Dead skills**
   - `sampling`, `sound_design`, `ai_music`, all `stage_*`, `improv_*`, `audience_*`, `health_*`, `business_*`, `theory_ear_training`, `theory_sight_reading` grant XP but no util reads them.
   - `skillLearningMultiplier.ts` matches short keys (`guitar`) against full slugs (`instruments_basic_electric_guitar`) — silently returns 1.0× for all real slugs.

## Decisions (confirmed)

- **Tier unlock**: must hit `current_level = 20` in lower tier before higher tier accepts XP. Single shared constant.
- **All four learning paths gated**: University, Books, Mentors, Practice + SXP spend.
- **Effects**: unify on the existing `tieredSkillBonus` curve (medium pass — no per-skill bespoke tuning), but apply it to every dead family so each skill actually matters.

## Implementation

### Phase 1 — Taxonomy cleanup (`src/data/skillTree.ts`)

- Rename `songwriting_professional_vocal_production` → `songwriting_professional_vocal_processing`. Add migration that renames any existing `skill_progress.skill_slug` rows.
- Rename `songwriting_mastery_composing_anthems` → `songwriting_mastery_composing`. Migration renames rows.
- Drop the 6 mastery-only capstone instrument configs (`lead_vocals`, `multi_instrumentalist`, `session_musician`, `bandleader`, `touring_musician`, `studio_virtuoso`) OR promote each to a full B/P/M family. Plan: **drop** — they overlap with role-based slugs and are not referenced anywhere meaningful except `instruments_mastery_lead_vocals` in one ROLE_SKILL_MAP entry, which we'll point at `instruments_mastery_vocal_performance` instead.
- Rename `luthiery_*_technical` topics to descriptive names (`repair`, `building`, `restoration` for B/P/M).
- Update `skillRecordingBonus.ts` vocal-production slug list to the renamed slugs.

### Phase 2 — Shared gating helper

New module `src/data/skillTierGating.ts`:

```ts
export const TIER_UNLOCK_LEVEL = 20; // matches MAX_SKILL_LEVEL
export type SkillTier = "basic" | "professional" | "mastery";
export function getTier(slug: string): SkillTier | null;
export function getPrerequisiteSlug(slug: string): string | null;
export function isTierUnlocked(slug: string, allProgress): boolean;
```

Mirror it as a small SQL function so edge functions can validate without importing src:

```sql
CREATE OR REPLACE FUNCTION public.skill_tier_unlocked(
  p_profile_id uuid, p_slug text
) RETURNS boolean ...
```

### Phase 3 — Wire gating into every XP source

- `supabase/functions/progression/handlers.ts` (`handleSpendSkillXp`) → call `skill_tier_unlocked`, return `{success:false, message:"Max your <basic> skill first"}` if locked. Standardise local `MAX_SKILL_LEVEL` to 20.
- `supabase/functions/university-attendance/index.ts` → same guard; also block enrollment if the target skill is locked. Cap level at 20.
- `supabase/functions/book-reading-attendance/index.ts` → same; block purchase/start at the source.
- `supabase/functions/relationship-action/index.ts` (mentor sessions) → same guard around the existing `skill_progress` upsert.
- Client `src/hooks/useSkillPractice.ts` and `SkillSystemProvider.updateSkillProgress` → call `isTierUnlocked` before upsert and surface a toast.
- Extract the duplicated `calculateLearningMultiplier` into `supabase/functions/_shared/learningMultiplier.ts`.

### Phase 4 — Effect coverage (medium pass)

Use `getTieredBonusScaled` for every family, additive into the appropriate output. New utilities, each reading basic/pro/mastery slugs:

- `src/utils/stageSkillBonus.ts` — `stage_*` skills add up to +12% to gig audience score (showmanship, crowd → engagement; tech, visuals → technical execution; social, streaming → fan conversion).
- `src/utils/theoryFullBonus.ts` — extend recording bonus to also read `ear_training` (+3%) and `sight_reading` (+3%); add to songwriting `melodyStrength` via `harmony` (+5%).
- `src/utils/improvBonus.ts` — `improv_musical` mitigates random gig disaster severity; `improv_recovery` reduces "song ruined" probability.
- `src/utils/audienceBonus.ts` — `audience_engagement` boosts merch+tip yield at gigs; `audience_trends` boosts release first-week streams.
- `src/utils/healthSkillBonus.ts` — `health_conditioning` reduces tour fatigue; `health_vocal` reduces vocal-strain ailment chance; `health_mental` reduces stress accumulation.
- `src/utils/businessSkillBonus.ts` — `contracts` improves label/sponsorship negotiated terms; `marketing` boosts auto-hype gain; `booking` improves venue offers.
- `src/utils/songQuality.ts` — add reads for `sampling`, `sound_design`, `ai_music` (each contributes a capped slice to `productionPotential`).

Wire each new util into its single existing caller (gig scoring, songQuality, release predictions, tour fatigue, sponsorship negotiation). No formula re-tuning — all use the shared scaler.

### Phase 5 — Fix `skillLearningMultiplier`

Rewrite `SKILL_LEARNING_ATTRIBUTES` keys to use slug prefixes (`instruments_*_electric_guitar`, `songwriting_*_mixing`) matched via regex helpers, so the multiplier actually fires. Add a unit-style assertion in dev.

### Phase 6 — UI

- `SkillTree.tsx` shows a lock badge on any tier whose prerequisite isn't at 20, with tooltip "Max <basic name> to unlock".
- University/Book/Mentor enrollment buttons disable + tooltip when target is locked.
- Bump version to **1.1.353**, add VersionHistory entry summarising taxonomy cleanup and gating.

## Out of scope

- Per-skill bespoke effect tuning (deferred — would be Phase 7).
- Resetting any existing player skill XP. Players who already over-leveled a Mastery slug keep it; gating only blocks future XP for new players past this point.
- New skill families.
- Translating dead modeling/fashion/clothing/teaching/luthiery skills into music effects — those belong to non-music subsystems and stay as-is.

## Verification

- `bunx vitest run` on any existing skill-related tests.
- Manual: open `SkillTree`, confirm lock badges appear; try to enroll in a Mastery university course with Basic below 20 and confirm it blocks; confirm version banner reads 1.1.353.
