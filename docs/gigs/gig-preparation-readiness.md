# Gig preparation readiness

This phase adds gig-specific setlists and an explainable readiness score for upcoming performances.

## Data model

- `gig_setlists`: one persisted preparation setlist per scheduled gig, owned by `gig_id` and `band_id`, with cached `total_duration_seconds`.
- `gig_setlist_items`: ordered setlist rows with `song_id`, `position`, and `is_encore`.
- `gig_outcomes`: stores `readiness_score`, `readiness_modifier`, and `readiness_breakdown` so completed gigs can explain how preparation affected the result.

## Validation rules

Blocking errors prevent saving or resolving a gig:

- Empty setlist.
- Duplicate songs in the same setlist.
- Songs not owned by the performing band.
- Missing song duration.
- Encore songs before normal-set songs.
- Edits by users who are not band leaders or managers.
- Edits to completed or cancelled gigs.

Warnings do not block saving:

- Total duration shorter than 85% of the booked slot.
- Total duration longer than 108% of the booked slot.

## Readiness calculation

Readiness is a weighted 0–100 score:

- Setlist completeness: 24%.
- Booked slot duration fit: 14%.
- Song familiarity/rehearsal: 18%.
- Recent rehearsal: 14%.
- Recent jam session: 8%.
- Band chemistry: 10%.
- Fatigue and health: 6%.
- Required performers: 6%.

Missing optional data falls back to neutral scores so historical and incomplete gigs remain readable.

## Ratings

- 0–29: poor.
- 30–49: average.
- 50–69: good.
- 70–89: excellent.
- 90–100: legendary.

## Outcome impact

Readiness applies a bounded modifier during gig execution. Scores above 70 can add up to +6%; low readiness can penalize by up to -10%. The modifier is intentionally modest so songs, rehearsal, chemistry, equipment, crew, performers, venue, weather, fatigue, and randomness remain meaningful.

## Extension points

Future crew, equipment, soundcheck, and stage setup systems should contribute additional readiness factors through the central readiness input rather than duplicating formulas in UI components or execution code.

## Phase 2: crew and equipment preparation

Phase 2 extends the existing saved gig setlist/readiness architecture instead of adding a second preparation system. Upcoming gigs may now have persistent crew assignments and equipment loadouts; both feed the same explainable readiness factor list and are revalidated again when a gig is resolved.

### Architecture inspected

- Setlists/readiness: `gig_setlists`, `gig_setlist_items`, `save_gig_setlist`, `GigPreparationPanel`, `gigReadiness.ts`, and the readiness fields on `gig_outcomes` provide the extension point.
- Staff and employment: reusable `band_crew_members` NPC staff and `company_employees` company staff are referenced directly; real-player crew is gated through accepted `band_members` relationships until broader gig-work contracts exist.
- Inventory/equipment: `band_stage_equipment` and `player_equipment`/`equipment_items` are the supported source tables. Existing quality, rarity and band equipment condition are converted to loadout quality/condition snapshots for explainable prep and historical compatibility.
- Performance and finance: existing gig outcome columns (`crew_costs`, `equipment_wear_cost`, `breakdown_data`) are preserved; phase 2 adds idempotent ledgers for crew fees, rentals and player crew rewards.
- Security: new tables follow the setlist pattern with band manager mutation policies, band/worker read policies, server-side RPC validation and immutable cost/quality derivation on the backend.

### Crew assignment model

`gig_crew_assignments` stores one assignment per gig/role. Supported roles are tour manager, sound engineer, lighting engineer, stage manager, guitar technician, drum technician, keyboard technician, stage crew, security and merchandise manager. Roles whose downstream systems are not fully connected are preserved for future extension, but only sound engineer, stage manager and technician roles currently affect readiness/reliability directly.

A crew row must reference exactly one worker source: `player_id`, `npc_staff_id`, or `company_staff_id`. The database enforces both the single-source rule and that the source matches `worker_type`.

### Worker eligibility rules

- NPC crew must come from `band_crew_members` for the gig band.
- Player crew must already have an accepted band relationship through `band_members`. This is the strongest existing accepted relationship available in the current schema; arbitrary users cannot be assigned.
- Company staff must come from an active `company_employees` row.
- Server RPCs reject completed/cancelled gigs, cross-band NPC staff, unrelated player equipment, and overlapping real-player crew assignments within the current four-hour gig conflict window.
- Travel/location validation is not yet available in the scheduling model, so phase 2 documents that limitation and applies the strongest current time-based conflict checks.

### Crew effectiveness calculation

Crew effectiveness is configurable in `GIG_PREP_BALANCE` and mirrors the backend SQL helper:

```text
crewEffectiveness =
  baseRoleAbility
  + relevantSkillContribution
  + experienceContribution
  + workerQualityContribution
  + realPlayerEngagementBonus
  - fatiguePenalty
  - absencePenalty
```

Real-player crew can outperform NPCs, but only through skills, experience, engagement and attendance. Low-skilled, fatigued or absent player crew can underperform reliable NPC staff.

### Equipment loadout model

`gig_equipment_loadouts` stores primary and spare equipment by role. Sources are band-owned, member-owned, rented, venue-provided or company-owned. Band equipment references `band_stage_equipment`; member equipment references `player_equipment` and derives item quality from `equipment_items.rarity`.

### Equipment requirement rules

Requirements are derived from known band performance roles and song instrument data where available. Until live song arrangements exist, the implementation uses the strongest current signals: performer role strings and song instrument names. Required defaults cover vocals/microphones, guitar, bass, drums, keyboards, amplification, PA and mixing.

### Reliability and failure calculations

Reliability is explainable and bounded:

```text
reliability =
  condition * 0.58
  + quality * 0.24
  + technicianSupport
  + spareEquipmentCoverage
  - conflictPenalty
```

Failure risk is `100 - reliability`. Well-maintained gear with technicians and spares produces uncommon failures; poor condition increases warnings and risk, while unusable gear is rejected server-side. Backend outcome support stores failure explanations in `gig_outcomes.equipment_failures` for future interactive/per-song expansion.

### Cost processing and player rewards

`gig_preparation_cost_ledger` records crew fees and equipment rentals once per source row. `gig_crew_reward_ledger` records real-player crew rewards once per assignment. Salaried company staff are marked as covered by employment so the band is not double charged unless a future overtime system explicitly adds appearance fees.

### Readiness integration

Crew/equipment factors extend the existing readiness factor breakdown:

- Crew role coverage
- Crew effectiveness
- Required equipment coverage
- Equipment reliability

The original setlist, rehearsal, chemistry and performer factors remain intact and are reweighted with the added factors rather than replaced.

### Future extension points

- Dedicated temporary gig-work contracts and acceptance/decline UI.
- Travel-aware availability once tour routing/location commitments are first-class schedule records.
- Venue-provided gear catalogs and company service charge rules.
- Detailed live arrangement instrumentation per song.
- Per-song equipment failure resolution and post-gig repair workflows.

## Phase 3: stage production and soundcheck preparation

Phase 3 keeps production and soundcheck planning attached to scheduled gigs. It adds `gig_production_plans` and `gig_soundcheck_plans`, extends venue capability fields where existing venue quality/capacity/prestige were too coarse, and reuses the gig preparation ledger so crew, rental, production and soundcheck costs are charged once during gig resolution rather than when players configure the plan.

### Production-plan model and packages

`gig_production_plans` stores one plan per upcoming gig with the selected lighting, visual, effects, backdrop, decoration, crowd-screen and setup tier. The backend recalculates estimated setup minutes, cost, compatibility and quality snapshots whenever the plan is saved.

Implemented package tiers:

- Lighting: venue basic, standard lighting, enhanced rig, professional show and arena spectacle.
- Visuals: none, static backdrop, branded projection, LED visuals and full synchronised show.
- Effects: none, haze, smoke effects, limited pyrotechnics and full pyrotechnic package.
- Stage setup: minimal, standard, expanded, headline and festival-scale setup.

Each package has a central cost, setup-time, recommended crew, audience-impact and reliability-risk definition in `gigStageProduction.ts` so UI, readiness and tests share the same balance constants.

### Venue capability rules

Production validation derives capability from existing venue capacity, prestige and type, then uses optional venue fields for stage size, lighting rig quality, electrical capacity, ceiling height, indoor/outdoor status, pyrotechnic permission, smoke/haze permission, screen/projection support, setup access, curfew, house production and venue technicians. Unsupported choices are rejected server-side by `save_gig_production_plan` and surfaced as compatibility warnings in the preparation UI.

### Cost and quality formulas

Production cost is the sum of selected package hire, effects/safety consumables, setup charges and additional stage crew. House production can cover basic lighting client-side; the database estimate remains authoritative for chargeable costs. Costs enter `gig_preparation_cost_ledger` with `production_hire` and `soundcheck_fee` rows and are protected by unique source rows to remain idempotent.

Production quality is capped from package ambition, venue compatibility, crew capability, equipment reliability, setup-time fit and overall readiness. Complexity above crew capability applies a penalty, so an oversized package in a weak venue scores worse than a modest compatible setup. The result returns score, rating, audience impact, reliability, setup risk, cost efficiency and explainable factors.

### Soundcheck types and scheduling

`gig_soundcheck_plans` stores none, line check, short soundcheck, standard soundcheck or full production soundcheck. Each type defines duration, cost, crew need, sound-quality benefit, equipment-failure risk reduction, fatigue and setup reliability. Soundchecks are validated against venue/setup access and the gig start time; a selected start after the latest valid start is rejected server-side.

### Setup timeline

The preparation timeline is derived per gig from venue access, crew arrival, unload, stage setup, lighting/setup work, soundcheck, doors open, band call, performance start and curfew markers. The UI flags insufficient access and scheduling conflicts without creating a tour-wide logistics planner.

### Readiness and outcome integration

Readiness now accepts production/soundcheck factors for plan completeness, venue compatibility, setup sufficiency, production crew coverage, soundcheck validity and complexity reliability. The same central readiness result remains bounded 0-100.

Gig resolution processes production and soundcheck costs through the existing ledger, applies capped audience/sound/fatigue modifiers, stores `production_breakdown`, `soundcheck_breakdown` and deterministic `production_incidents`, and keeps repeated completion calls idempotent by returning existing outcomes before recalculating.

Incident probability considers production complexity, crew skill, setup-time fit and soundcheck risk reduction. Incidents currently include delayed setup and lighting cue failure with severity, proportional impact and mitigation text; no interactive incident decisions are introduced yet.

### Extension points

Future PRs can add transport/load-in forecasting, reusable production templates, weather-aware outdoor production, live-performance incident events and richer venue production staff without replacing these per-gig plans.

## Phase 4: gig forecasting and final preparation review

Phase 4 adds an explainable final review layer for upcoming gigs. It does not replace gig resolution. Forecasts use the same preparation foundations as resolution where available: `gigReadiness.ts` for readiness and setlist pressure, `gigCrewEquipment.ts` for crew effectiveness/equipment reliability/cost inputs, and `gigStageProduction.ts` for production quality, soundcheck costs and setup risks. Randomness is not consumed during forecasting; instead, the review returns low/likely/high ranges whose width is controlled by confidence.

### Architecture inspected

- Readiness is calculated centrally by `calculateGigReadiness` and extended by `calculateCrewEquipmentReadiness`.
- Setlists are stored in `gig_setlists` and `gig_setlist_items`; the preparation UI saves through `save_gig_setlist`.
- Crew assignments and equipment loadouts are stored in `gig_crew_assignments` and `gig_equipment_loadouts`; costs flow into `gig_preparation_cost_ledger`.
- Production and soundcheck plans are stored in `gig_production_plans` and `gig_soundcheck_plans`; package balance constants live in `gigStageProduction.ts`.
- Venue capacity, prestige, type and production capability fields are read through the existing gig/venue relation.
- Gig resolution already processes preparation ledger rows once, applies readiness, crew/equipment, production and soundcheck modifiers, and stores outcome breakdowns on `gig_outcomes`.
- Historical outcomes remain in `gig_outcomes`, with replay/review systems reading attendance, revenue, profit, rating and preparation breakdowns.
- RLS patterns restrict gig preparation reads and writes to band members/managers; the forecast snapshot table follows the same band membership visibility model.

### Forecast snapshot and invalidation

Forecasts can be generated reproducibly from current server-loaded gig data and may also be stored in `gig_forecast_snapshots` with a calculation version and input fingerprint. The client final review recalculates from the latest loaded preparation queries and invalidates those queries after setlist, crew, equipment, production and soundcheck changes. Server consumers should regenerate before presenting a final review and must not let an old persisted snapshot override current preparation data.

Meaningful inputs include setlist rows, rehearsals, performer readiness, crew assignments, equipment loadouts, production plan, soundcheck plan, ticket price, ticket sales, venue data, local popularity/promotion data where present and gig schedule/status.

### Attendance demand

Attendance is capped by venue capacity and already-sold tickets form the lower floor. The current formula is:

`likely = clampToCapacity(max(soldTickets, capacity * (0.18 + demandScore / 118) * largeVenuePenalty * pricePressure * repeatPenalty * readinessLift))`

Where:

- `demandScore = localPopularity * 0.36 + globalFame * 0.20 + genreAffinity * 0.14 + venueQuality * 0.11 + promotionScore * 0.12 + readinessScore * 0.07`.
- `largeVenuePenalty` makes high-capacity rooms harder to sell through.
- `pricePressure` suppresses demand above the baseline ticket price.
- `repeatPenalty` reduces demand for repeated local gigs when that data is available.
- `readinessLift` uses the existing readiness performance modifier at a modest pre-sale influence.

Missing local popularity or promotion data is recorded as an assumption rather than inventing a new city-demand system.

### Revenue, costs and break-even

Ticket revenue is `attendanceRange * ticketPrice`. Merchandise revenue is `attendanceRange * merchandiseSpendPerAttendee * merchandiseMargin` when merchandise details are not more specific. Fixed fees, appearance fees or other guaranteed income are represented as the `other` revenue range and `guaranteedIncome`.

Committed costs are the sum of venue hire, crew fees not covered by employment, equipment rental, production cost, soundcheck cost and other existing expenses. Crew/equipment/production/soundcheck inputs reuse the same preparation rows that resolution charges through the ledger, avoiding double counting.

Break-even attendance is:

`ceil(max(0, committedCosts - guaranteedIncome) / variableIncomePerAttendee)`

where `variableIncomePerAttendee = ticketPrice + merchandiseSpendPerAttendee * merchandiseMargin`.

### Performance-quality forecast

Performance quality blends readiness, performer skill, song quality, band chemistry, crew effectiveness, equipment quality, production quality, venue acoustics and soundcheck benefit. Fatigue and equipment failure risk reduce the likely value. The output is a 0-100 low/likely/high range plus a broad rating label, not an exact future review score.

### Fan satisfaction forecast

Fan satisfaction derives from expected performance quality, attendance density, song popularity, venue quality, genre fit, ticket value and readiness. It intentionally avoids hidden incident rolls and only reports ranges and positive/negative contributors.

### Crowd-energy forecast

Crowd energy derives from satisfaction, attendance density, song popularity, production audience impact, performer skill and encore configuration. The review exposes opening, mid-set, closing, encore-potential and overall ranges without simulating every song.

### Confidence

Confidence starts from a neutral baseline and is raised by high readiness, substantial sold tickets and comparable historical data. It is reduced by missing equipment, unconfirmed/conflicted crew, no soundcheck, high production setup risk, long time remaining, critical risks and incomplete data. Confidence changes range width only; it does not improve the likely outcome.

### Risks, strengths, checklist and go/no-go status

Risks and strengths are scored with impact weights, sorted by expected impact and linked to preparation sections. Risks cover blocking readiness issues, missing equipment, poor condition, incompatible production, invalid soundcheck, expensive tickets, low sell-through, high loss risk and performer fatigue. Strengths cover strong local popularity, high readiness, reliable equipment, strong production fit, near sell-out attendance and profitable margins.

The final checklist covers setlist, performers, crew, equipment, production, soundcheck, finance and schedule. Items have `complete`, `warning`, `missing`, `blocked` or `not_applicable` status, a blocking flag and a linked section.

Go/no-go status is calculated as:

- `not_ready` if any blocking checklist item exists.
- `ready_with_risks` if no blockers remain but significant warnings or high/critical risks remain.
- `ready` if critical preparation is complete with only minor warnings.
- `fully_prepared` when readiness is high and no meaningful warnings remain.

There is no manual bypass for blocking validation.

### Historical snapshot behaviour

At resolution, the edge function attempts to copy the latest valid `gig_forecast_snapshots.forecast` into `gig_outcomes.final_forecast_snapshot` using `preserve_final_gig_forecast_snapshot`. The function only writes when the outcome does not already have a final forecast, so repeated idempotent completion calls do not overwrite the snapshot. Historical gigs without forecasts remain readable because the new outcome columns are nullable.

### Security and limitations

Forecast inputs are intended to be calculated server-side or from RLS-protected preparation queries; clients must not be trusted for finance, popularity, quality or attendance values. Forecast snapshots are visible only to band members and writable only by band leaders/managers. The forecast does not expose random seeds, hidden rolls or private worker details beyond existing authorised preparation views.

Known limitations: local demand, promotion, competing events, performer health and city genre affinity are included only when the existing data is available. No weather, competitor event simulation, automated cancellation, ticket-price automation or management-skill progression is introduced in this phase.
