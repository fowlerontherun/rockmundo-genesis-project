# Wellness Lifestyle Habits, Routines, Nightlife and Burnout Prevention

This expansion turns Wellness from a set of one-off recovery actions into a server-authoritative lifestyle layer. It builds on the previous Wellness foundation: character vitals, daily wellness processing, activity catalog cooldowns, ailments, schedule blocks, accommodation/travel recovery, nutrition/hydration panels and professional support.

## Architecture

- `wellness_lifestyle_profiles` stores bounded 0-100 dimensions for sleep consistency, sleep debt, recovery discipline, workload intensity, social activity, partying frequency, recent alcohol exposure, routine stability, burnout pressure and lifestyle balance.
- `wellness_lifestyle_daily_aggregates` stores compact daily rollups instead of unlimited event logs. Processing reads 24-hour, 7-day and 28-day windows.
- `wellness_routines` and `wellness_routine_executions` define personal routines and idempotent generated instances that must become normal schedule activities before they affect stats.
- `wellness_lifestyle_traits` stores gradual trait progress. Traits emerge from sustained behaviour and can fade when behaviour changes.
- `wellness_social_activity_history` records capped social, fame, relationship, alcohol and readiness effects with idempotency keys.

## Lifestyle state calculation

Lifestyle states are plain-language bands derived from rolling balance, workload and burnout pressure:

| State | Meaning |
| --- | --- |
| Highly balanced | Strong recovery, stable sleep and manageable workload. |
| Balanced | Sustainable mix of work, rest and social activity. |
| Busy | High workload without dangerous pressure yet. |
| Unstable | Routine or recovery is inconsistent. |
| Exhausting | Repeated pressure is affecting readiness. |
| Unsustainable | High sustained burnout pressure; warnings should already be visible. |

One late night should not move a character directly to the worst state. The implementation combines recent daily aggregates and bounded caps.

## Sleep need, timing, naps and sleep debt

Default sleep target is 480 minutes, with modest additions for workload and travel. Effective sleep is reduced by late or irregular timing, rough accommodation, interruptions and recent alcohol exposure. Sleep debt accumulates when effective sleep is below target and recovers gradually; recovery is capped so a single long sleep cannot erase sustained debt. Power naps remain useful for short-term readiness, but effective nap value is capped per day.

## Routines and automation

Routine categories include sleep schedule, morning routine, exercise, meal plan, hydration, daily relaxation, weekly rest day, social evening, practice limits, pre-gig prep, post-gig recovery and tour recovery.

Modes:

- Manual: player schedules everything.
- Guided: recommendations and gap highlighting.
- Assisted: schedules approved low-risk routine blocks around existing commitments.
- Managed: higher-tier support-team automation with budgets and preferences.

Automation must not cancel gigs, rehearsals, recording, travel or band commitments. Conflicting routines are rescheduled, shortened only when flexible, or skipped with a recorded reason. Generated executions use routine + period idempotency keys.

## Partying and alcohol trade-offs

| Intensity | Benefits | Costs | Alcohol-free support |
| --- | --- | --- | --- |
| Quiet | Happiness, relationship time, light stress relief | Small fatigue/sleep impact | Fully viable |
| Casual | Social ease, networking, relationship hooks | Cost, fatigue, hydration and sleep impact | Lower cost and lower disruption |
| Lively | Stronger social/networking/publicity chances | Higher fatigue, sleep disruption and readiness penalty | Still grants social chances |
| Heavy | Highest capped nightlife upside | Strongest bounded next-day costs and risk | Not required for content |

Alcohol is represented as temporary exposure, not addiction or dependency. It can reduce hydration, sleep quality, coordination, concentration and next-day readiness. Sober and low-alcohol participation retains social opportunities and is never treated as a lesser content path.

## Burnout stages and recovery

Stages are Low pressure, Building pressure, High pressure, Burnout warning, Mild burnout and Severe burnout. Pressure rises from sustained workload, consecutive demanding days, poor sleep, touring, repeated gigs/recording, stress and lack of downtime. It falls through rest days, quality sleep, relaxation, positive relationships, time at home, nutrition/hydration and professional support. Severe burnout is intended to be uncommon and preceded by visible warnings.

## Lifestyle traits

| Trait | Behaviour source | Benefit | Trade-off |
| --- | --- | --- | --- |
| Night owl | Sustained late sleep or nightlife | Late consistent routines hurt less | Morning readiness is weaker |
| Disciplined | Stable sleep and recovery, low excess partying | Consistent readiness | Fewer spontaneous nightlife hooks |
| Social butterfly | Sustained social activity | Networking and relationship rolls improve | Spending and isolation stress rise |
| Party regular | Frequent nightlife | More invitations and social ease | More recovery pressure |
| Recovery conscious | Rest, sleep and support adherence | Burnout recovery improves | Less room for high-volume work |
| Workaholic | High workload with low downtime | Short-term capacity | Burnout pressure grows faster |

Effects are intentionally modest and capped. Traits update gradually and opposing behaviours reduce progress over time.

## Privacy rules

Private APIs may show sleep debt, burnout pressure, alcohol exposure, therapy attendance, care plans and detailed history only to the owning player or authorised management/admin roles. Public surfaces may show general reputation, public event attendance, published posts, public incidents and self-selected profile traits only.

## Balance caps and anti-abuse

- Daily Wellness action caps and indulgence caps remain in force.
- Social reward counts are capped per activity and recorded in `wellness_social_activity_history`.
- Repeated similar nightlife receives diminishing returns.
- Alcohol exposure and readiness penalties are capped.
- Routine executions use idempotency keys and paused routines stop generating.
- Trait progress changes slowly to prevent rapid switching.
- Fame and relationship gains from generated lifestyle events are bounded and never guaranteed.

## Migration behaviour

The migration is additive and non-destructive. Existing profiles receive neutral lifestyle defaults, zero sleep debt and burnout pressure backfilled from existing `burnout_risk` where available. Existing Wellness activities remain valid. Missing historical data creates no critical penalties.

## Future hooks

Future Wellness PRs can add holidays/retreats, sponsor lifestyle expectations, press/scandal systems, family and relationship routines, seasonal mood, career longevity, life events and lifestyle achievements. Advanced addiction mechanics are intentionally out of scope unless explicitly approved later.
