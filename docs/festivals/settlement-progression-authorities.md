# Festival settlement progression authority audit

Festival settlement is an orchestrator: it freezes evidence, leases effects, and acknowledges database-verified canonical mutations. It is **not** a claim that the overall Festival system is complete.

## Core authority matrix

| Effect | Dispatcher / RPC | Canonical record | Projections | Replay and acknowledgement | Database status / known gap |
|---|---|---|---|---|---|
| `performance_result` | `apply_festival_performance_result_effect` | `live_performance_outcomes` | immutable performance identity, score, audience, setlist and attendance evidence | `(source_type, source_id)` plus stable reference; verifier checks source, performer, digest and reference | Seeded Festival, ordinary-gig, overlap, NPC and solo cases are required by the harness; CI result must be read from the PR checks |
| `band_fans` | `apply_festival_band_fans_effect` | `band_fan_progression_events` | band tier totals, country, city and supported demographic fans | stable reference; verifier checks event, outcome, band and frozen delta without comparing a historic after-state to today's balance | Festival and ordinary-gig replay are required; demographic projection remains conditional on repository support |
| `band_fame` | `apply_festival_band_fame_effect` | `band_fame_progression_events` | band/global and geographic fame plus `band_fame_history` | stable reference; verifier checks event and history linkage | Festival and ordinary-gig replay are required; all scope deltas must remain in event evidence |
| `member_xp` | `apply_festival_member_xp_effect` | `member_xp_transactions` + `profile_action_xp_events` | `player_xp_wallet`, `xp_ledger`, legacy `profiles.experience` | stable reference shared with action event; verifier checks user/profile, wallet and amount | Present/late only; absent, post-performance and NPC are not applicable; solo uses the same wallet |
| `band_chemistry` | `apply_festival_band_chemistry_effect` | `live_performance_chemistry_events` aggregate | contributions, relationship events, snapshot and band chemistry | stable aggregate reference and deterministic participant/pair references; verifier checks complete sets and snapshot | Band performers only; NPC and solo are not applicable |
| `song_familiarity` | `apply_festival_song_familiarity_effect` | `song_performance_progression_events` (`familiarity`) | `band_song_familiarity.familiarity_minutes` | stable song reference; verifier checks song, outcome, type and delta | Unit is rehearsal-equivalent minutes; skipped songs are not applicable |
| `song_popularity` | `apply_festival_song_popularity_effect` | `song_performance_progression_events` (`popularity`) | bounded `songs.popularity` | stable song reference; verifier checks song, outcome, type and delta | Performed songs only; skipped songs are not applicable |

The production worker claims with `claim_next_festival_settlement_effect`, invokes the mapped RPC, and calls `acknowledge_festival_settlement_effect`. Acknowledgement re-reads the typed canonical row. `finalise_festival_settlement_effects` must reject completion while any required core effect is unresolved. An expired lease or interruption after mutation re-enters the same RPC; the stored receipt returns the original canonical identifier and domain timestamp.

## Fail-closed effects

| Effect | State |
|---|---|
| `festival_company_reputation` | Incomplete — fail-closed (`implementation_pending`) |
| `festival_company_fame` | Incomplete — fail-closed (`implementation_pending`) |
| `artist_relationship` | Incomplete — fail-closed (`implementation_pending`) |
| `sponsor_relationship` | Incomplete — fail-closed (`implementation_pending`) |
| `achievement_award` | Incomplete — fail-closed (`implementation_pending`) |
| `licence_progress` | Incomplete — fail-closed (`implementation_pending`) |
| `world_event` | Incomplete — fail-closed (`implementation_pending`) |
| `notification` | Incomplete — fail-closed (`implementation_pending`) |
| `tax_projection` | Incomplete — fail-closed (`implementation_pending`) |

These effects must never receive a fabricated applied envelope. Their recoverable failure/dead-letter state must preserve attempts and error details and must not interfere with settlements containing only supported core effects.
