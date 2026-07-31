# Festival settlement effect authority matrix

`festival_effect_authority_results` remains an audit pointer, never canonical evidence. The seven performance effects below use the non-Festival-specific live-performance outcome and progression event tables. Every other effect remains fail-closed; consequently the complete Festival lifecycle is **not** certified by this change.

| Effect | Wrapper | Canonical mutation | Canonical verification | Acknowledgement | Replay | Ordinary gig shared | NPC | Solo | Disposable DB | CI |
|---|---|---|---|---|---|---|---|---|---|---|
| performance_result | Yes | Yes | Yes | Yes | Yes | Yes | outcome | outcome | pending CI | pending |
| band_fans | Yes | Yes | Yes | Yes | Yes | Yes | not applicable | solo authority | pending CI | pending |
| band_fame | Yes | Yes | Yes | Yes | Yes | Yes | not applicable | solo authority | pending CI | pending |
| member_xp | Yes | Yes | Yes | Yes | Yes | Yes | not applicable | player wallet | pending CI | pending |
| band_chemistry | Yes | Yes | Yes | Yes | Yes | Yes | not applicable | not applicable | pending CI | pending |
| song_familiarity | Yes | Yes | Yes | Yes | Yes | Yes | eligible songs | eligible songs | pending CI | pending |
| song_popularity | Yes | Yes | Yes | Yes | Yes | Yes | eligible songs | eligible songs | pending CI | pending |
| festival_company_reputation | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| festival_company_fame | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| artist_relationship | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| sponsor_relationship | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| achievement_award | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| licence_progress | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| world_event | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| notification | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |
| tax_projection | fail-closed generic adapter | **Incomplete** | none | No | fail-closed only | No |

Replay resolves the unique stable reference and validates source, subject, outcome, evidence digest, rules version, validated change, and reversal state. It never compares an historical after-state with the current projection. A mismatch raises `FESTIVAL_EFFECT_CANONICAL_STATE_MISMATCH`; it never reapplies a delta. Effect mutation and its event are performed inside one database RPC transaction. Randomness is accepted only as already-frozen outcome evidence.
