# Festival settlement effect authority matrix

`festival_effect_authority_results` remains an audit pointer, never canonical evidence. The seven performance effects below use the non-Festival-specific live-performance outcome and progression event tables. Every other effect remains fail-closed; consequently the complete Festival lifecycle is **not** certified by this change.

| Effect | Wrapper | Domain mutation | Canonical record | Shared with gigs | Integration tested | DB tested |
|---|---|---|---|---|---|---|
| performance_result | `apply_festival_performance_result_effect` | immutable outcome | `live_performance_outcomes` | Yes | Yes | Not run (disposable DB required) |
| band_fans | `apply_festival_band_fans_effect` | band/city/country fan tiers | `band_fan_progression_events` | Yes | Yes | Not run (disposable DB required) |
| band_fame | `apply_festival_band_fame_effect` | band fame and fame history | `band_fame_progression_events` | Yes | Yes | Not run (disposable DB required) |
| member_xp | `apply_festival_member_xp_effect` | profile XP and `experience_ledger` | `member_xp_transactions` | Yes | Yes | Not run (disposable DB required) |
| band_chemistry | `apply_festival_band_chemistry_effect` | contribution then chemistry recalculation | `band_contribution_events` | Yes | Yes | Not run (disposable DB required) |
| song_familiarity | `apply_festival_song_familiarity_effect` | `band_song_familiarity` | `song_performance_progression_events` | Yes | Yes | Not run (disposable DB required) |
| song_popularity | `apply_festival_song_popularity_effect` | `songs.popularity` | `song_performance_progression_events` | Yes | Yes | Not run (disposable DB required) |
| festival_company_reputation | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| festival_company_fame | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| artist_relationship | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| sponsor_relationship | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| achievement_award | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| licence_progress | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| world_event | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| notification | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| tax_projection | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |

Replay resolves the unique stable reference, validates source, subject, outcome and evidence digest, and verifies the current projection. A mismatch raises `FESTIVAL_EFFECT_CANONICAL_STATE_MISMATCH`; it never reapplies a delta. Effect mutation and its event are performed inside one database RPC transaction. Randomness is accepted only as already-frozen outcome evidence.
