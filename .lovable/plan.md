# Wellness System Expansion Plan

Turn the Wellness page from a single-activity picker into a full lifestyle-management hub, giving players persistent choices that grant real bonuses and penalties across the game.

## 1. Lifestyle Presets (headline feature)

Add a **Lifestyle** that the player selects and can switch (with a cooldown / adjustment cost). Each lifestyle passively modifies stats each day, changes activity cooldowns, and affects other systems (gigs, fame, addictions, XP).

Suggested presets:

| Lifestyle | Bonuses | Penalties |
|---|---|---|
| Balanced | Small +to all vitals, no drift | No standout bonus |
| Straight Edge | +Health, +Focus, immune to substance ailments, faster skill XP | −Fame gain, −Party rep, some indulgences locked |
| Party Animal | +Fame gain, +Charisma, +Nightclub rep, cheaper indulgences | −Health drift, higher addiction risk, energy drain |
| Fitness Fanatic | +Stamina, +Health regen, longer gig endurance | −Creativity XP, higher food cost |
| Workaholic | +XP from practice/recording, +Money from jobs | −Mood, −Relationship XP, burnout risk |
| Bohemian / Creative | +Songwriting XP, +Inspiration events | −Money income, −Health regen |
| Spiritual / Zen | +Mood floor, resistance to stress ailments | −Aggression-based reputation, slower fame |
| Luxury / Rockstar | +Fame multiplier, +VIP access, +Charisma | Weekly upkeep drain, higher tabloid risk |

Each has a numeric modifier bundle applied by cron / edge fn (mood, health, energy drift, xp_multiplier, fame_multiplier, addiction_risk, money_upkeep).

## 2. Daily Habits (routines)

Player builds a small routine (max 3–5 slots) from a **habit catalog**:

- Morning run, Meditation, Balanced meals, 8h sleep, Vocal warm-up, Journaling, Cold shower, Social hour, etc.

Habits auto-tick daily. Streaks compound (+bonus at 7 / 30 / 90 day marks). Missing habits break streaks and give small penalties. Habits interact with lifestyle (e.g. Straight Edge locks "nightcap", Fitness boosts "morning run" gains).

## 3. Sleep & Diet controls

Two sliders/pickers persistently set on the player:

- **Sleep schedule**: 4h Grind / 6h Standard / 8h Restful / 10h Recovery — affects energy cap, mood, next-day activity slots.
- **Diet plan**: Junk / Standard / Balanced / Athlete / Vegan / Custom — affects health regen, weight (cosmetic), stamina, and weekly food cost.

Both feed into the daily drift calculation.

## 4. Goals & Programs

Multi-day programs the player commits to for rewards:

- 7-day Detox, 30-day Fitness Challenge, Rehab program, Weight loss plan, Mindfulness course.

Track progress, allow abandon (with penalty), pay out on completion (permanent stat, achievement, insurance discount).

## 5. Medical & Professional care

Expand medical beyond the current one-shot activities:

- **Doctor visits**: full check-up reveals hidden ailments early.
- **Therapy** (recurring): reduces stress/addiction risk while attending.
- **Personal trainer** (weekly cost): boosts fitness activity effectiveness.
- **Nutritionist**: unlocks better diet plans.
- **Rehab clinic**: cures addictions faster (already partly present — integrate here).

Weekly retainer costs, appointment slots, ties into existing hospitals & mentors tables where possible.

## 6. Health Insurance

Simple tiered policy (None / Basic / Standard / Premium). Monthly premium; reduces medical costs, unlocks premium clinics, prevents big hospitalisation bills.

## 7. Ailments overhaul (light)

Keep current ailments; add:

- Severity progression if untreated (mild → serious → critical → hospitalisation).
- Chronic conditions from long-term bad lifestyle (back pain, vocal strain, burnout, addiction).
- Visible risk meter driven by lifestyle + habits + recent activities.

## 8. Wellness effects surfaced game-wide

Wellness must matter outside its page:

- Gig performance modifier (already partial) — expose in gig pre-check.
- Skill XP multiplier from lifestyle/habits.
- Fame gain multiplier.
- Activity slot count per day (currently 3) becomes lifestyle-driven (2–5).
- Random events biased by lifestyle (Party Animal → more tabloid events; Zen → more inspiration).

## 9. UI redesign of `/wellness`

Reorganise into clear tabs, keeping the working activity core intact:

```text
Header:  Vitals summary  |  Lifestyle badge  |  Active blocks
Tabs:
  1. Overview   — vitals, active modifiers, today's habits, quick actions
  2. Lifestyle  — pick/change lifestyle, see modifiers, switch cost
  3. Routine    — habits builder, streaks, sleep + diet pickers
  4. Activities — existing 4-category catalog (unchanged core)
  5. Care       — doctor / therapist / trainer / insurance
  6. Goals      — active programs + available programs
  7. Ailments   — current + chronic conditions with treat buttons
```

Mobile: collapse tabs into a segmented control; keep dense card layout consistent with FM style.

## Technical Details

### New tables (public schema, with GRANTs + RLS scoped to `profile_id`)

- `wellness_lifestyles` — catalog: slug, name, description, modifiers jsonb, unlock_requirements, switch_cost, icon.
- `player_wellness_lifestyle` — one row per profile: profile_id, lifestyle_slug, started_at, switch_available_at.
- `wellness_habits_catalog` — slug, name, category, daily_effects jsonb, streak_bonuses jsonb, lifestyle_synergy.
- `player_wellness_habits` — profile_id, habit_slug, slot, active, current_streak, best_streak, last_ticked_at.
- `player_wellness_routine` — profile_id, sleep_plan, diet_plan, updated_at.
- `wellness_programs_catalog` — multi-day programs (slug, duration_days, requirements, rewards jsonb).
- `player_wellness_programs` — profile_id, program_slug, status, started_at, progress, completed_at.
- `wellness_care_providers` — doctor / therapist / trainer / nutritionist listings (reuse `hospitals` where sensible).
- `player_wellness_care_subscriptions` — profile_id, provider_type, tier, next_charge_at, benefits jsonb.
- `player_health_insurance` — profile_id, tier, monthly_premium, coverage jsonb, active_since.
- Extend `player_ailments` with `severity`, `is_chronic`, `escalates_at`.

### Server logic

- Edge function `wellness-apply-daily-drift` (cron): applies lifestyle + habit + routine + insurance effects to vitals, ticks streaks, escalates ailments, charges upkeep.
- RPC `switch_wellness_lifestyle(new_slug)` with cost + cooldown validation.
- RPC `set_wellness_routine(sleep, diet)` and `toggle_wellness_habit(slug, slot)`.
- RPC `start_wellness_program(slug)` / `complete_wellness_program(id)`.
- RPC `purchase_health_insurance(tier)` / `cancel_health_insurance()`.
- Update `wellness-perform-activity` to read lifestyle modifiers for cost/effect scaling and to honour lifestyle activity locks.
- Hook lifestyle multipliers into: gig outcome calc, skill XP grant, fame delta, addiction risk roll, random-event weighting.

### Frontend

- New components under `src/components/wellness/`: `LifestylePickerPanel`, `HabitsRoutinePanel`, `SleepDietPanel`, `ProgramsPanel`, `CarePanel`, `InsurancePanel`, `WellnessModifiersBadge`.
- New hooks: `usePlayerLifestyle`, `usePlayerHabits`, `usePlayerRoutine`, `usePlayerPrograms`, `usePlayerCare`, `usePlayerInsurance`.
- Rework `src/pages/wellness/index.tsx` into the tabbed layout above; keep `ActivityCard`, `AilmentsPanel`, `WellnessVitalsPanel`.
- Surface active lifestyle badge + modifiers in `FMShell` top bar and pre-gig confirm dialog.

### Rollout order

1. Migration: lifestyles catalog + `player_wellness_lifestyle` + switch RPC + UI picker.
2. Habits + routine (sleep/diet) tables, RPCs, daily drift edge fn, UI.
3. Programs + goals.
4. Care providers + insurance.
5. Ailment severity & chronic conditions.
6. Cross-system wiring (gig / XP / fame / random events).
7. Version bump + version history entry per milestone.
