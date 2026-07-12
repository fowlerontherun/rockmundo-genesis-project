# Wellness System Foundation

## Audit summary

The previous Wellness route mixed several older concepts in one page: profile `health`/`energy`, derived stress from mental-focus attributes, local mutations for rest/meditation/exercise, hospitalisation, holidays, addictions, and a recent XP-ledger list. The repository already had a newer character-scoped wellness stack that this PR builds on instead of duplicating: `wellness_activity_catalog`, `wellness_activity_log`, `player_ailments`, `wellness_blocks`, the `wellness-perform-activity` edge function, `evaluate_wellness_gate`, `useWellnessState`, `ActivityCard`, `AilmentsPanel`, and booking hooks that call `assertWellnessAllows` before gigs, rehearsal, recording, touring, work, training and travel.

## Core model

Wellness uses 0-100 values. `overall_wellness` is derived, not client-written, from:

| Stat | Meaning |
| --- | --- |
| energy | Immediate stamina for gigs, travel, recording and work. |
| physical_health | Baseline physical condition and recovery capacity. |
| happiness | Mood and social resilience. |
| stress | Pressure that increases mistakes and burnout risk. |
| fatigue | Accumulated tiredness from workload and travel. |
| sleep_quality | Quality of recent recovery sleep. |
| nutrition | Food quality and energy stability. |
| fitness | Long-term conditioning for touring and demanding shows. |
| motivation | Focus for practice, songwriting and studio work. |
| burnout_risk | Long-term overload risk. |

The shared calculation source is `src/lib/wellnessSystem.ts`. Positive stats add to overall wellness; stress, fatigue and burnout risk are inverted. State bands are Excellent (85+), Good (70+), Stable (50+), Struggling (30+) and Critical (<30).

## Progression gates

The system uses existing fame progression as the first gating source:

| Tier | Fame | Unlocks |
| --- | ---: | --- |
| New Artist | 0 | Overall wellness, energy, physical health, happiness, sleep, rest, meals and basic illness recovery. |
| Active Musician | 100 | Stress, fatigue, nutrition, fitness, exercise, massage and clearer rehearsal/tour impacts. |
| Professional Artist | 1,000 | Motivation, burnout risk, improved recovery hooks and studio/tour preparation. |
| Superstar | 10,000 | Premium recovery, luxury accommodation/transport and personal staff hooks for later PRs. |

Locked stats remain visible with lock text. Activity locking is represented in shared config and mirrored by server validation through catalog `unlock_min_fame` and the edge function.

## Initial activity balance

| Activity | Duration | Cost | Tier | Cooldown | Effects |
| --- | ---: | ---: | --- | ---: | --- |
| Rest | 60m | $0 | New Artist | 2h | fatigue -10, energy +6, stress -4 |
| Sleep | 480m | $0 | New Artist | 16h | energy +28, sleep +18, fatigue -24, stress -5 |
| Power nap | 25m | $0 | New Artist | 8h | energy +10, fatigue -5 |
| Healthy meal | 45m | $18 | New Artist | 4h | nutrition +14, energy +4, happiness +2 |
| Relaxation | 45m | $0 | New Artist | 3h | stress -12, happiness +6, motivation +2 |
| Exercise | 60m | $0 | Active Musician | 12h | energy -8, fitness +8, stress -8, fatigue +6, health +3 |
| Massage | 60m | $65 | Active Musician | 24h | fatigue -16, health +5, stress -5 |
| Doctor visit | 90m | $120 | New Artist | 24h | health +8, fatigue -4, condition treatment modifier |

Activities are server-authoritative via the existing edge function and schedule table. Paid actions validate funds before applying effects.

## Conditions and recovery

The existing `player_ailments` table remains the condition store. This PR documents the lightweight lifecycle expected by later jobs: behaviour raises bounded risks, a condition records severity/start/source/restrictions, treatment adds recovery progress rather than deleting every condition instantly, and idempotent daily processing resolves conditions once.

Initial condition templates for this phase are common cold/sore throat, minor fatigue/back pain, muscle strain/sprained wrist, burnout warning/burnout, and vocal strain only where existing vocal data or templates already exist.

## System integrations

Wellness exposes `getWellnessMultiplier()` and `getPerformanceModifier()` for bounded integration. Initial modifiers are deliberately modest: positive wellness caps near +8%; normal negative penalties bottom at -20%; critical wellness can drop to 0.65 only for exceptional availability risks. Existing booking flows already use `evaluate_wellness_gate` to prevent unsafe gigs, tours, recording, rehearsal, work, training and travel.

## Daily processing

Daily wellness processing should be safe to retry for a profile/date pair. It applies natural energy/fatigue changes, sleep recovery, nutrition drift, stress and burnout updates, condition progress, capped lifestyle effects and notifications only for meaningful threshold changes.

## Notifications and logging

Important events should notify: state worsening, high stress, severe fatigue, burnout risk, new/worsened/recovered condition, tier unlock and wellness activity completion. Structured logs should cover daily-processing failures, invalid bookings, condition creation/resolution, gating rejections, activity completion and out-of-range values.

## Future PRs

Recommended follow-ups: vocal health and role-specific strain, advanced injuries, hotels and tour-bus recovery, home wellness upgrades, restaurant/nutrition depth, personal trainers/therapists/staff, long-term lifestyle choices, and richer mental-wellness events.
