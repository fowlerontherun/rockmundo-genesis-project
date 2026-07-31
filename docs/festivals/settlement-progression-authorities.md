# Festival settlement progression authority audit

Festival settlement is an orchestrator: it freezes evidence, leases effects, and acknowledges database-verified canonical mutations. It is **not** a claim that the overall Festival system is complete.

> **Certification status:** not certified. The calculator-only harness merged in
> PR #1457 did not execute the settlement lifecycle and is not end-to-end
> evidence. The static gate now rejects that harness (including RPC or scenario
> names placed in comments/documentation strings). Each core row below remains
> unverified until the disposable database harness and both GitHub workflows are
> green; a migration or static inspection alone is never certification.

## Core authority matrix

| Effect | Dispatcher / RPC | Canonical record | Projections | Replay and acknowledgement | Database status / known gap |
|---|---|---|---|---|---|
| `performance_result` | `apply_festival_performance_result_effect` | `live_performance_outcomes` | immutable performance identity, score, audience, setlist and attendance evidence | `(source_type, source_id)` plus stable reference; verifier checks source, performer, digest and reference | **Not certified** — Festival, gig, overlap, NPC, solo, and replay DB scenarios require a green workflow |
| `band_fans` | `apply_festival_band_fans_effect` | `band_fan_progression_events` | band tier totals, country, city and supported demographic fans | stable reference; verifier checks event, outcome, band and frozen delta without comparing a historic after-state to today's balance | **Not certified** — Festival, ordinary-gig, and replay DB scenarios require a green workflow |
| `band_fame` | `apply_festival_band_fame_effect` | `band_fame_progression_events` | band/global and geographic fame plus `band_fame_history` | stable reference; verifier checks event and history linkage | **Not certified** — Festival, ordinary-gig, and replay DB scenarios require a green workflow |
| `member_xp` | `apply_festival_member_xp_effect` | `member_xp_transactions` + `profile_action_xp_events` | `player_xp_wallet`, `xp_ledger`, legacy `profiles.experience` | stable reference shared with action event; verifier checks user/profile, wallet and amount | **Not certified** — membership timing, attendance, solo, and wallet reconciliation need DB evidence |
| `band_chemistry` | `apply_festival_band_chemistry_effect` | `live_performance_chemistry_events` aggregate | contributions, relationship events, snapshot and band chemistry | stable aggregate reference and deterministic participant/pair references; verifier checks complete sets and snapshot | **Not certified** — participant/pair completeness and replay need DB evidence |
| `song_familiarity` | `apply_festival_song_familiarity_effect` | `song_performance_progression_events` (`familiarity`) | `band_song_familiarity.familiarity_minutes` | stable song reference; verifier checks song, outcome, type and delta | **Not certified** — completed/skipped song and replay DB scenarios require a green workflow |
| `song_popularity` | `apply_festival_song_popularity_effect` | `song_performance_progression_events` (`popularity`) | bounded `songs.popularity` | stable song reference; verifier checks song, outcome, type and delta | **Not certified** — completed/skipped song and replay DB scenarios require a green workflow |

The production worker claims with `claim_next_festival_settlement_effect`, invokes the mapped RPC, and calls `acknowledge_festival_settlement_effect`. Acknowledgement re-reads the typed canonical row. `finalise_festival_settlement_effects` must reject completion while any required core effect is unresolved. An expired lease or interruption after mutation re-enters the same RPC; the stored receipt returns the original canonical identifier and domain timestamp.

## Fail-closed effects

| Effect | State |
|---|---|
| `festival_company_reputation` | Incomplete — explicitly fail-closed (`implementation_pending`) |
| `festival_company_fame` | Incomplete — explicitly fail-closed (`implementation_pending`) |
| `artist_relationship` | Incomplete — explicitly fail-closed (`implementation_pending`) |
| `sponsor_relationship` | Incomplete — explicitly fail-closed (`implementation_pending`) |
| `achievement_award` | Incomplete — explicitly fail-closed (`implementation_pending`) |
| `licence_progress` | Incomplete — explicitly fail-closed (`implementation_pending`) |
| `world_event` | Incomplete — explicitly fail-closed (`implementation_pending`) |
| `notification` | Incomplete — explicitly fail-closed (`implementation_pending`) |
| `tax_projection` | Incomplete — explicitly fail-closed (`implementation_pending`) |

These effects must never receive a fabricated applied envelope. Their recoverable failure/dead-letter state must preserve attempts and error details and must not interfere with settlements containing only supported core effects.
