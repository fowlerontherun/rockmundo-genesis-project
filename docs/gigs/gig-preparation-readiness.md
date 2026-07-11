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
