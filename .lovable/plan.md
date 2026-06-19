# Wellness & Lifestyle — Expansion Plan

Today the Wellness page is a localStorage mock (habits, fake heart rate, fake appointments). It doesn't read the character, doesn't write back to the game, and has no cooldowns. This plan turns it into a real, vital game system.

## Goals
1. Wellness stats *gate* what the character can do (jobs, gigs, tours, nightlife).
2. Wellness drives modifiers on performance, songwriting, social, and fame decay.
3. Every lifestyle activity has a cooldown + daily cap + stamina cost (hybrid model).
4. Neglect rolls ailments (vocal strain, burnout, flu, addiction relapse) that hard-block activities until treated.
5. Blocked activities show a hard block + a clear "do this instead" suggestion.

## Design

### Stats (live on existing `profile_health` / `profile_attributes`)
Use existing columns where available, add what's missing:
- `health` 0–100 — physical condition
- `energy` 0–100 — daily stamina, regenerates with sleep
- `mood` 0–100 — mental state
- `stress` 0–100 — inverse pressure (lowered by recovery)
- `addiction_risk` 0–100 — derived

### Activity Catalog (4 categories, ~24 activities)
| Category | Examples | Cooldown | Stamina | Stat changes |
|---|---|---|---|---|
| Recovery | Spa day, sauna, massage, sleep-in, meditation, yoga, therapy | 12h–3d | 10 | +health/+mood/−stress |
| Fitness | Gym, personal trainer, vocal warm-ups, dance class, cardio | 16h–1d | 25 | +health/+energy cap |
| Medical | Doctor, dentist, physio, vocal coach checkup, mental clinic | 3–14d | 5 | clears ailments, +max health |
| Indulgence | Party, binge eating, gambling, drug use | 8h–2d | 30 | +mood NOW, −health/+addiction/+ailment roll |

### Cooldowns (Hybrid)
- **Per-activity timer**: each catalog entry has its own `next_available_at`.
- **Daily cap**: max 3 wellness actions / in-game day; max 1 Indulgence / evening.
- **Stamina cost**: each action subtracts from `energy`. If `energy < cost` → blocked.

### Hard Block + Suggestion
When the player tries a blocked activity (cooldown OR low wellness OR active ailment), we **don't** let them push through. We:
- Disable the action with reason + countdown.
- Surface a `RecommendedAction` panel: "You're too exhausted to gig. Try **Sleep In** (free, +40 energy)."

### Vital-role wiring
- **Performance quality**: gig/recording engines multiply by `wellnessMultiplier = clamp(0.5..1.15)` based on (health + energy + mood)/300.
- **Activity availability**: scheduling guard checks `wellness_gate(activity_type)` before allowing schedule.
- **Random ailments**: nightly cron rolls based on stress/addiction/indulgence streak. 12 conditions: vocal strain, sore throat, flu, sprained wrist, insomnia, burnout, panic attack, food poisoning, hangover, back pain, depression spell, withdrawal.
- **Relationships & fame decay**: weekly cron — if `mood<30` for 7d → −5% friend warmth & −2% regional fame.

## Technical Implementation

### Database (1 migration)
- `wellness_activity_catalog` — id, slug, name, category, duration_min, cooldown_hours, stamina_cost, cost_cents, stat_effects jsonb, ailment_risk jsonb, unlock_min_fame, sort_order. Seed ~24 rows.
- `wellness_activity_log` — id, user_id, profile_id, catalog_id, performed_at, completed_at, stat_snapshot jsonb. Indexed (profile_id, catalog_id, performed_at desc).
- `wellness_cooldowns` — view: per profile × catalog, last performed + `next_available_at` = last + cooldown_hours.
- `wellness_blocks` — id, profile_id, reason ('ailment'|'low_health'|'addiction'|'cooldown'), blocks text[] (activity_type tags blocked), expires_at, source_ailment_id. RLS by profile.
- `player_ailments` — id, profile_id, slug, severity 1–3, contracted_at, resolved_at, treatment_required_slug. Seed list of 12.
- Add `activity_type IN ('wellness_recovery','wellness_fitness','wellness_medical','wellness_indulgence')` to existing `player_scheduled_activities` check.
- SECURITY DEFINER fn `public.evaluate_wellness_gate(_profile_id uuid, _activity_type text)` returns (allowed bool, reason text, suggestion_slug text).
- Grants + RLS for each new table.

### Edge functions
- `wellness-perform-activity` — validates gate, deducts stamina/cost, writes log, applies stat effects, rolls ailments for Indulgence, returns updated state.
- `wellness-treat-ailment` — pairs a Medical activity with an active ailment, resolves it.
- `wellness-daily-rollover` — cron 03:00 game time: regen energy +60, decay mood/health by lifestyle, roll new ailments, expire stale blocks, decay addictions.
- `wellness-weekly-decay` — cron Sunday: applies fame/friendship penalties for sustained low mood.

### Frontend
- `src/lib/api/wellness.ts` — replace localStorage layer with real Supabase queries (`fetchWellnessState`, `performActivity`, `listCatalog`, `listAilments`, `listCooldowns`).
- `src/hooks/useWellnessState.ts` — subscribes to `profile_health` realtime + cooldown ticker.
- `src/components/wellness/`:
  - `WellnessVitals.tsx` — health/energy/mood/stress rings (replace fake heart-rate cards).
  - `ActivityCatalog.tsx` — 4 category tabs, each card shows cooldown countdown, stamina cost, effects, lock state.
  - `ActivityCard.tsx` — disabled-with-countdown + reason tooltip + "Do This Instead" CTA on block.
  - `AilmentsPanel.tsx` — active conditions with required treatment slug deep-link.
  - `RecommendedAction.tsx` — surfaces the suggestion returned by the gate.
- `src/pages/wellness/index.tsx` — restructured around Vitals → Recommended → Catalog (tabs) → Ailments → Activity Log.
- Hook `useWellnessGate(activityType)` exported for gig/recording/job/tour buttons to call. Returns `{ allowed, reason, suggestion }`. Wire into:
  - `GigBooking` / `PerformGig`
  - `Employment` clock-in
  - `TourManager` rejoin
  - `Casino` / `Nightclubs` / `Underworld` entry
- Performance multiplier helper `getWellnessMultiplier(profileId)` used by gig + recording scoring.

### Scheduling integration
- Activities >30 min get inserted into `player_scheduled_activities` so they block other actions like existing jobs.
- Quick (<30 min) activities resolve instantly.

### Version
- Bump `VersionHeader` to **1.1.407**.
- Add entry to `VersionHistory.tsx` describing all of the above.

## Out of Scope (this iteration)
- Custom habit creator UI (existing HabitTracker stays as-is for now).
- Family/child wellness.
- Insurance / hospital billing simulation.

## File Touch List
- New: 1 migration, 4 edge functions, ~6 components, 1 hook.
- Modified: `wellness.ts` API, `wellness/index.tsx` page, gig/job/tour entry buttons, `VersionHeader`, `VersionHistory`.
