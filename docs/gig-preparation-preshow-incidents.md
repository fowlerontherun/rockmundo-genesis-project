# Gig Preparation Phase 5: Pre-show incidents and backstage decisions

## Architecture inspected

Phase 5 builds on the merged preparation slices already present in the repo:

- Scheduled gigs use `gigs.status` values such as `scheduled`, `completed` and `cancelled`; preparation and resolution code treats completed/cancelled gigs as terminal and the performance resolver remains authoritative.
- Setlist/readiness preparation is implemented by `gig_setlists`, `gig_setlist_items`, `calculateGigReadiness` and `calculateCrewEquipmentReadiness`.
- Crew and equipment preparation is implemented by `gig_crew_assignments`, `gig_equipment_loadouts`, effectiveness/reliability helpers, and idempotent preparation cost/reward ledgers.
- Stage production and soundcheck preparation is implemented by `gig_production_plans`, `gig_soundcheck_plans`, production quality calculations and deterministic production incident risk.
- Final forecasting is implemented by `generateGigForecast`, `buildFinalPreparationChecklist` and `gig_forecast_snapshots` with an immutable final snapshot RPC.
- Notifications already use the shared `notifications` table/policies in adjacent social flows; this PR stores enough session/incident state for existing notification jobs/hooks to fan out without creating a separate event engine.
- Permissions reuse `is_band_leader_or_manager`, band membership policies, crew assignment state and service-role scheduled processing.
- Economy idempotency follows existing `ON CONFLICT DO NOTHING`/unique-reference patterns from gig preparation ledgers and social guarded RPCs.
- Game-clock handling uses `timestamptz` and UTC ISO timestamps; frontend countdowns are display-only and deadlines are enforced in SQL and utility logic.

## Lifecycle

`gig_preshow_sessions` is one-to-one with a scheduled gig. Supported statuses are `not_started`, `open`, `awaiting_decision`, `resolved`, `expired`, `skipped` and `locked`.

Default timing is configurable in `DEFAULT_PRESHOW_CONFIG`:

- small gigs open 24 hours before showtime;
- large/headline/festival gigs open 48 hours before showtime;
- medium/unknown gigs use the repository-wide 24-hour default;
- sessions lock 30 minutes before the scheduled performance.

Completed, resolved and cancelled gigs skip pre-show. If nobody responds, incidents expire and the gig continues.

## Incident generation

Generation is deterministic per `gigId + bandId + generation_version`, so refreshes cannot reroll incidents. The generator computes:

1. preparation score from readiness, equipment reliability, spares, soundcheck, tour manager coverage and production reliability;
2. risk score from readiness weakness, equipment failure risk, crew effectiveness, production setup risk, performer condition and unresolved warnings;
3. mitigated risk by subtracting configurable preparation mitigation;
4. incident count using gig-size caps and deterministic seeded rolls.

Configured maximums are: small 1, medium 2, large/headline/festival 3. Critical incidents are capped to a low configured probability.

## Implemented categories and types

Supported categories are `equipment`, `crew`, `performer`, `production`, `venue`, `commercial`, `media_social` and `crowd_safety`; initial concrete incident types are limited to systems that exist today:

- `amplifier_fault` (`equipment`) requires an assigned amplifier.
- `player_crew_late` (`crew`) requires a real-player crew assignment that is not confirmed.
- `performer_fatigue` (`performer`) requires low performer fatigue/condition input.
- `effects_restriction` (`production`) requires a production plan with non-empty smoke/haze/pyro effects.
- `last_minute_advertising` (`commercial`) requires weak sell-through/ticket demand.

Additional categories are typed and weighted for future expansion, but impossible incidents are not emitted until an existing game system can support their effects.

## Eligibility rules

Every incident stores an `eligibility_snapshot` with the human explanation and key inputs. Examples:

- amplifier incidents store loadout equipment roles and reliability;
- player crew late incidents store player crew count;
- fatigue incidents store performer fatigue;
- effects restrictions store effect package and venue capability;
- advertising opportunities store sell-through, tickets sold and capacity.

Unavailable options remain visible with an unavailable reason but must still be rejected server-side by the guarded RPC/service path.

## Severity

Severity is derived from mitigated risk plus incident-specific pressure:

- `minor`: score <= 40;
- `moderate`: score > 40;
- `major`: score > 66;
- `critical`: score > 82 and the deterministic roll is under the configured critical cap.

Good readiness, strong crew, spares and soundcheck lower both probability and severity.

## Decisions and skill checks

Options include requirements, permission categories, time cost, cost preview, guaranteed consequences, optional risk consequences, resolution behaviour and confirmation hints. Current options include spare replacement, technician repair, venue rental, working short, tour-manager reassignment, local standby crew, backstage rest, setlist shortening, effect downsizing/negotiation and advertising choices.

Skill checks use:

```ts
finalChance = clamp(
  baseChance
  + skillContribution
  + equipmentContribution
  + preparationContribution
  + timeContribution
  - difficultyPenalty,
  minChance,
  maxChance,
)
```

The default clamp is 15% to 92%. Rolls are not exposed before resolution; persisted decisions store skill-check and outcome snapshots for audit.

## Expiry and fallback

Each incident has a deadline bounded by session lock and gig start. Late choices are rejected server-side. `expire_gig_preshow_incidents` records an `automatic_fallback` decision exactly once per incident and moves sessions to `expired` when nothing remains actionable.

Fallback options are cautious rather than catastrophic: continue with degraded equipment, work short-handed, push through fatigue, drop restricted effects or decline advertising.

## Delegation and permissions

Database policies allow band members to view sessions/incidents/options/decisions. Committing a decision currently requires `is_band_leader_or_manager`; option metadata also records future delegated authorities (`tour_manager`, `crew_lead`, `admin`) for UI and service-layer validation. The first committed decision wins through `UNIQUE(incident_id)` and row locks in `commit_gig_preshow_decision`.

## Financial processing

Costs are server-authored in option consequences, not trusted from the client. Decision rows have a unique `transaction_reference`; consequence payloads include stable idempotency keys such as `gig:incident:option`. This PR stores transaction-ready consequences and prevents duplicate decision/transaction references. A follow-up can wire those references into the full band ledger once the app’s final band-money RPC is selected.

## Readiness, forecast and resolution integration

`applyPreshowConsequencesToReadiness` adds a capped pre-show factor and warning. `generateGigForecast` accepts `preShowConsequences`, includes incident costs in expected costs, adjusts attendance/performance/satisfaction/energy with caps, and adds a pre-show risk row.

`executeGigPerformance` reads persisted `gig_preshow_decisions`, summarizes consequences once, applies attendance/performance modifiers, and includes pre-show flags in the gig outcome breakdown. Historical gigs without pre-show rows resolve normally.

## Scheduled processing

The project already has service-role cron/function patterns. This PR adds the service-role RPC needed by scheduled processing to expire decisions. Opening/generation can be run by the same scheduler or by a lazy page/service call because sessions are unique per gig and generation is deterministic. The limitation is documented: a production scheduler should call the open/generate workflow and `expire_gig_preshow_incidents` frequently enough to send reminders and avoid relying on a page visit.

## Configuration and balancing

All core values live in `DEFAULT_PRESHOW_CONFIG`: timing windows, incident count caps, category weights, base probability, mitigation, critical cap, option costs, skill-check bounds, effect caps and positive opportunity frequency.

## Known limitations

- The initial delegated-staff implementation records delegated authorities in option metadata, while the committed SQL RPC only allows band leader/manager decisions until a staff-auth resolver is finalized.
- Notification fanout is not duplicated; existing notification/SSE surfaces can consume session/incident rows. A scheduled reminder fanout job is recommended next.
- Financial consequences are stored with idempotency keys and transaction references, but not yet posted to every possible band/company ledger table.
- Setlist changes are represented as validated consequence intents; the existing setlist editor/service remains the only full editor.
