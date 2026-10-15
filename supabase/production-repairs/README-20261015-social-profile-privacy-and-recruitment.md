# RockMundo production social-privacy and recruitment reconciliation

**Date:** 2026-10-15. **Supabase:** `yztogmdixmchsmimtent`. **Tracker:** #4072.

All six SQL files next to this README are **exact statements already executed in production** (taken from `supabase_migrations.schema_migrations.statements[1]`). They are intentionally outside `supabase/migrations`: **do not run a blanket migration replay or merge the original historical migrations over these repairs**.

| Recorded version | Live identity | Exact SQL archive |
| --- | --- | --- |
| `20261015164048` | `rockmundo_20261015_social_visibility_band_members_enum_compat` | `20261015164048_social_visibility_band_members_enum_compat.sql` |
| `20261015164122` | `rockmundo_20261015_private_social_profile_editor_foundation` | `20261015164122_private_social_profile_editor_foundation.sql` |
| `20261015164212` | `rockmundo_20261015_opt_in_private_friend_suggestions_compat` | `20261015164212_opt_in_private_friend_suggestions_compat.sql` |
| `20261015164531` | `rockmundo_20261015_band_recruitment_safe_partial_compat` | `20261015164531_band_recruitment_safe_partial_compat.sql` |
| `20261015164731` | `rockmundo_20261015_band_vacancy_expiry_cron_live_compat` | `20261015164731_band_vacancy_expiry_cron_live_compat.sql` |
| `20261015165135` | `rockmundo_20261015_social_discovery_opt_in_privacy_gate` | `20261015165135_social_discovery_opt_in_privacy_gate.sql` |

## Social/profile privacy repair

The canonical player-social migration `20260713120000_player_profiles_social_identity.sql` had never been applied and would have defaulted new social profiles to public while recreating incompatible legacy functions. Instead, the live repair:

- Adds the missing `band_members` visibility enum value and `profile_skill_visibility` type.
- Creates the frontend-required `player_profiles` editor table, **private by default**, with owner-only RLS SELECT/INSERT/UPDATE (not a publicly readable row table) and no bulk backfill.
- Restores `get_safe_friend_suggestions` returning only other explicitly public, living, active, unblocked character profiles, excluding pending/accepted friendships and suppressing hidden city names.
- **Closes previously existing privacy exposure** in `get_public_profile_detail`, `search_public_profiles`, and `search_player_discovery`: they were SECURITY DEFINER functions returning details from raw `profiles` without confirming opt-in. The production replacement validates the requested viewer's account ownership and the target's publication state **before** querying/counting results. Public city, skills, online status, biography and band-history presentation respects per-profile visibility flags. Anonymous EXECUTE revoked; authenticated users retain verified API signatures.
- Owner preview remains possible without publishing. Existing `profile_privacy_settings` can further restrict publication when a row is present; no privacy-settings rows existed at preflight.

Verified in rolled-back authenticated-role tests: owner private-profile creation/updates, nonowner write denial; zero unpublished friend suggestions; explicit public opt-in visible then revoke immediately hidden; hidden city not leaked; unowned viewer rejected; public profile detail, player search and discovery each excluded unpublished characters; opt-in continued to mask city, bands, skills and online activity.

## Recruitment repair

The original future migration `20300106170000_repair_band_recruitment_capacity_applications_expiry.sql` expects nonexistent `band_membership_offers` and `band_vacancies.closed_at`, so must **not** be applied verbatim.

- Reconciles pending application uniqueness per vacancy and character, keeping general non-vacancy applications one pending per band.
- Patches `submit_band_vacancy_application` to reuse only an application to the **same vacancy**, and to commit an expired vacancy status instead of rolling it back with a raised exception.
- Patches `respond_band_application` to reject approvals to no-longer-open or deadline-expired vacancies, preserving its existing permission, membership, quota and notification checks.
- Adds `band_vacancy_capacity_guard` to prevent future open adverts from reserving more than actual remaining band member slots.
- Installs service-only `expire_band_recruitment_records()` compatible with production's real vacancy columns (does not touch missing membership offers), and a named `pg_cron` job `rockmundo-band-vacancy-expiry` (job ID 131), active every 15 minutes. No overdue rows existed at the time of installation.

Verified in rolled-back tests: future normal open advert accepted, over-capacity and past deadline update rejected; two different pending vacancy applications for one character allowed, duplicate for the *same* vacancy rejected by unique index. No test applications or vacancy records survived rollback.

**Known pre-existing exceptional state:** two open adverts remain; one belongs to a band whose member count already fills the capacity despite the remaining advertised slot. The guard prevents new overbooking but the repair did **not** silently pause or delete that existing advert. Review with the band owner before editing historical adverts.

## Final verification

- **1,467** recorded migrations (from 1,461 at start of this batch).
- **0** player social profiles persisted by these repairs; **0** pending applications; **2** existing open adverts unchanged.
- Security advisor: no `security_definer_view` error, and no new unmitigated RLS or access-control issue found. Broader historical SECURITY DEFINER callable-function and mutable-search-path warnings remain.
- No earnings, XP, payout, membership, friendship or social-privacy history backfilled.

## Next gated changes

Canonical social badges/activity/milestone tables and downstream badge-rich profile functions require a separate design review. The current profile API preserves compatible JSON keys with empty badges/activity collections; do not fake awards or backfill arbitrary data. Recruitment departure seat-release logic from the historical migration also references absent `band_members.recruitment_application_id`; implement only after canonical membership provenance reconciliation. Financial/payroll/achievement reward migrations remain blocked pending consistent ledgers and safe idempotency.
