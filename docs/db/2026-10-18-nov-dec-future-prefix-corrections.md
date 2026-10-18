# October 2026 audit: 10 additional future-dated 2026 migrations

These scripts had November/December 2026 prefixes despite having been introduced in Git in 2025. Dates below are first-add Git commit timestamps (UTC). SQL blobs were moved unchanged; this does not establish when they were deployed.

| Old path | New path |
|---|---|
| `20261101090000_ensure_schedule_events_schema.sql` | `20250919132539_ensure_schedule_events_schema.sql` |
| `20261101100000_create_friendships_table.sql` | `20250918174219_create_friendships_table.sql` |
| `20261105090000_create_radio_play_metrics_functions.sql` | `20251106095833_create_radio_play_metrics_functions.sql` |
| `20261105120000_replace_venue_city_id_with_city.sql` | `20250918212424_replace_venue_city_id_with_city.sql` |
| `20261108090000_create_sponsorship_offers.sql` | `20251125150703_create_sponsorship_offers.sql` |
| `20261111090000_create_brand_sponsorships.sql` | `20251125115645_create_brand_sponsorships.sql` |
| `20261201000000_add_check_radio_submission_week.sql` | `20251113192345_add_check_radio_submission_week.sql` |
| `20261201090000_create_skills_table.sql` | `20250919064642_create_skills_table.sql` |
| `20261202090000_create_universities_table.sql` | `20250919084140_create_universities_table.sql` |
| `20261205100000_create_skill_books_tables.sql` | `20250919101204_create_skill_books_tables.sql` |

**Stop before deploying:** A name correction can reorder migration execution. Reconcile full staging migration dependencies and database history before merging. No SQL was applied to production as part of this PR.
