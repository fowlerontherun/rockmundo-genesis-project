# Migration filename creation-date corrections — 2026-10-18

These mappings use the **first Git commit adding the file** (UTC), not the latest edit or filesystem mtime. They change only the paths: existing Git blob SHAs are reused and SQL bytes stay untouched. The original and new timestamp versions did not occur in the linked database's version ledger at the time of review.

| Previous filename | Corrected filename |
|---|---|
| `20300106090000_expand_mayor_university_city_upgrades.sql` | `20260906160041_expand_mayor_university_city_upgrades.sql` |
| `20300106101500_university_upgrade_cooldowns.sql` | `20260906171610_university_upgrade_cooldowns.sql` |
| `20300106110000_allow_public_player_band_invitations.sql` | `20260927150812_allow_public_player_band_invitations.sql` |
| `20300106120000_fix_band_invitation_notification_route.sql` | `20260927164650_fix_band_invitation_notification_route.sql` |
| `20300106130000_notify_band_invitation_responses.sql` | `20260927174628_notify_band_invitation_responses.sql` |
| `20300106140000_live_band_invitation_updates.sql` | `20260927183310_live_band_invitation_updates.sql` |
| `20300106150000_share_moment_snapshots.sql` | `20261007182222_share_moment_snapshots.sql` |
| `20300106160000_enforce_social_contact_consent_and_request_cooldowns.sql` | `20261013202702_enforce_social_contact_consent_and_request_cooldowns.sql` |
| `20300106170000_repair_band_recruitment_capacity_applications_expiry.sql` | `20261013205418_repair_band_recruitment_capacity_applications_expiry.sql` |
| `20300106180000_correct_recruitment_approvals_and_departures.sql` | `20261013210924_correct_recruitment_approvals_and_departures.sql` |
| `20300106181000_character_scoped_notification_archive.sql` | `20261013211010_character_scoped_notification_archive.sql` |
| `20300106182000_atomic_chart_entry_notifications.sql` | `20261013211126_atomic_chart_entry_notifications.sql` |
| `20300106190000_harden_band_governance_profile_identity.sql` | `20261013211832_harden_band_governance_profile_identity.sql` |
| `20300106200000_atomic_personal_funded_gig_booking.sql` | `20261014163142_atomic_personal_funded_gig_booking.sql` |
| `20300106200000_secure_atomic_weekly_band_payroll.sql` | `20261014101831_secure_atomic_weekly_band_payroll.sql` |
| `20300106201000_controlled_random_event_backlog_reconciliation.sql` | `20261014163811_controlled_random_event_backlog_reconciliation.sql` |
| `20300106210000_rehearsal_booking_full_intent_idempotency.sql` | `20261014121144_rehearsal_booking_full_intent_idempotency.sql` |
| `20310102090000_education_pootube_mentor_reconciliation.sql` | `20261018142732_education_pootube_mentor_reconciliation.sql` |

## Deployment safeguards and exceptions

- **No production SQL has been applied and no migration history altered.** Do not run automatic bulk `db push` against production or replay historical migrations as a side effect of this PR.
- The established 2029 Festival sequence is a deliberately frozen logical namespace, NOT chronological file creation dates. Preserve those identities even if their Git introduction was in 2025/2026. The additional `20300101010000_festival_offer_withdraw_and_expiry.sql` is also held back pending deployment evidence.
- Other 2027/2029 historical anomalies are intentionally deferred for live-schema and dependency review; date mismatch alone does not establish that renaming is safe (`AGENTS.md`, migration timestamp policy).
- The historical collision exception for `20300106200000` has been removed because these two SQL blobs have distinct new timestamps.
- Before merge, verify staging migration order and exact source Git blob hashes. Do not mistake Git date for production deployment date.
