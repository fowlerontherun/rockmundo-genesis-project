# Festival settlement dispatcher authority matrix

Audit of active `main` after PRs #1445 and #1447. Each dispatcher entry now has a service-role-only definition in `20291218244300_canonical_festival_effect_authorities.sql`; all use `_festival_effect_authority_context` for relationship, stable-reference and immutable-evidence validation and `_festival_record_authority_result` for replay.

| Dispatcher effect | RPC exists | Canonical authority | Implementation required |
|---|---:|---|---:|
| performance_result | Yes | immutable Festival performance / shared gig adapter | No |
| band_fans | Yes | bounded performance progression adapter | No |
| band_fame | Yes | bounded performance fame adapter | No |
| member_xp | Yes | attending-player progression adapter | No |
| band_chemistry | Yes | relationship evidence + `recalculate_band_chemistry` | No |
| song_familiarity | Yes | performed-song progression adapter | No |
| song_popularity | Yes | performed-song progression adapter | No |
| festival_company_reputation | Yes | company reputation adapter | No |
| festival_company_fame | Yes | company brand-fame adapter | No |
| artist_relationship | Yes | canonical performer/company relationship adapter | No |
| sponsor_relationship | Yes | sponsor-contract relationship adapter | No |
| achievement_award | Yes | `complete_achievement_for_event` / `player_achievements` | No |
| licence_progress | Yes | Festival licence projection adapter | No |
| world_event | Yes | `world_events` | No |
| notification | Yes | typed notification adapter | No |
| tax_projection | Yes | `festival_edition_tax_lines` | No |
