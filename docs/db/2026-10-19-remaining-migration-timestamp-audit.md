# 2026-10-19 migration filename audit: remaining protected identities

Scope: `rockmundo-genesis-project/supabase/migrations`. At inspection (main tree `2eac437e082bb896e3c8ddb05ea3ddf9955c3260`) there were **2,078** SQL files, **197** named `2029...`, **one** named `2030...`, and **19** duplicated timestamp groups. The linked live Supabase project had **1,637** migration ledger entries. Ledger version absence does not prove SQL has not already been applied (see `AGENTS.md` and `docs/db/MIGRATION_IDENTITY_INVENTORY.md`).

## Evidence from Git and live schema

| Existing filename | First commit UTC | Why not blindly rename |
|---|---|---|
| `20291201090000_create_sponsorship_tables.sql` | 2025-11-25 11:49:41 (`23bac0f59`) | This references `public.sponsorship_types`, while `20251125150703_create_sponsorship_offers.sql` creates overlapping sponsorship tables and depends on that type. Re-dating to a time earlier on 25 November changes fresh-reset dependency order and may break it. |
| `20291202090000_beta_rls_hardening.sql` | 2026-07-10 05:57:59 (`d141f1feb`) | Security policy changes need verified live RLS/policy reconciliation before altering migration identity. |
| `20291203090000_player_social_safety.sql` | 2026-07-13 17:31:52 (`4ccd42b56`) | `player_blocks` and `player_reports` already exist on the live DB. Simply using `20260713090000` also collides with `20260713090000_band_progression_goals.sql`. |
| `20300101010000_festival_offer_withdraw_and_expiry.sql` | 2026-10-04 22:49:57 (`c1bac6e18`) | Festival continuation; preserve until dependent deployment identities have been reconciled. |

The 2029 Festival logical sequence (particularly `20291217`–`20291220`) is an explicitly frozen exception in `docs/database/MIGRATION_TIMESTAMP_POLICY.md`. The previous 2027 and 2030/2031 correction batches are already recorded in `docs/db/2026-10-18-legacy-2027-migration-creation-date-corrections.md` and `docs/db/2026-10-18-migration-creation-date-corrections.md`; do not rename them a second time.

## Exhaustive, non-destructive audit

Run with full Git history, or download the GitHub Actions `migration-creation-audit` artifact from `.github/workflows/migration-creation-date-audit.yml`:

```sh
node --test tests/migrationCreationAudit.test.mjs
node scripts/supabase/audit-migration-creation-dates.mjs --output migration-creation-audit.json
```

The report provides the first Git introduction SHA/UTC date and now also includes `proposed_filename`, `timestamp_valid`, `proposed_timestamp_collision`, and `history_version_match`. A sanitized, uncommitted JSON array of version strings or objects can optionally be passed with `--history-json /path/to/versions.json`; this blocks all exact matched applied identities without ever contacting or changing production. A proposed filename is *not* approval to run or rename a migration: require verified live schema/function/policy/grant effects; old and proposed ledger identities; a clean staging reset including dependency order; a complete exact-path reference review; and a tested forward-only remediation plan. Keep already-deployed SQL identifiers immutable.

**This review performs no production SQL, no history edits, no `db push`, no migration SQL rewrites, and no additional bulk renames.**
## Full-history CI results (PR #4455)

The read-only GitHub Actions run inspected **2,078** files: **1,732** creation-day matches; **153** mismatches needing live-schema review; **9** conflicting proposed timestamp identities; **88** protected historical mismatches; **93** protected invalid calendar timestamps; and **3** numbered legacy files. All audit tests passed. Report artifact: [GitHub Actions migration-creation-audit](https://github.com/fowlerontherun/rockmundo-genesis-project/actions/runs/39319571448/artifacts/12219831080).

A subsequent read-only comparison of the **153** live-review candidates with the **1,637** production ledger versions found **two exact version matches**, which must not be renamed: `20260923192633_avatar_v1_muscle_topless.sql` and `20261017215911_dj_draft_setlists_with_rights_validation_20261017.sql`. The other **151** candidates had no exact version matches, but this does **not** establish that their SQL effects were absent or that changes to their ordering would be safe.
