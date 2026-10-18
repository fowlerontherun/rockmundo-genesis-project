# Remaining October 2026 future-dated migration prefix corrections

These eight scripts were named for October 20–31, 2026 despite first being committed in 2025 or earlier October 2026. Date identities now reflect the original Git addition in UTC; the SQL blob SHA is unchanged.

| Before | After |
|---|---|
| `20261020100000_zero_skill_attribute_defaults.sql` | `20250918123900_zero_skill_attribute_defaults.sql` |
| `20261022103000_add_city_night_clubs.sql` | `20251007205818_add_city_night_clubs.sql` |
| `20261025100000_add_extended_skill_definitions.sql` | `20250918150110_add_extended_skill_definitions.sql` |
| `20261030120000_add_city_reference_to_venues.sql` | `20250918151351_add_city_reference_to_venues.sql` |
| `20261030130000_create_xp_tables.sql` | `20250918160448_create_xp_tables.sql` |
| `20261031120000_create_profile_progression_tables.sql` | `20250918162238_create_profile_progression_tables.sql` |
| `20261031120001_replace_daily_conversion_with_weekly_bonus.sql` | `20261008223129_replace_daily_conversion_with_weekly_bonus.sql` |
| `20261031123000_create_progression_functions.sql` | `20250918165530_create_progression_functions.sql` |

**Deployment hold:** Verify actual live schema effects and a staging reset before merging; a renamed historical SQL file may otherwise execute again under the newly introduced version. No database mutation was performed.
