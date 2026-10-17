# Database migration reconciliation plan

## What the audit found (read-only, 17 Oct 2026)

| Measure | Count |
|---|---|
| Script files in repo | 1,939 (1,918 distinct versions) |
| Versions recorded in live history | 1,502 (latest 20261016210554) |
| Versions in both | 260 |
| Repo versions not recorded live | 1,658 |
| Live versions with no repo file of same version | 1,242 |
| Repo versions that are future-dated (after today) | 274 (incl. 191 dated Dec 2029, 17 dated Jan 2030) |
| Duplicate version numbers in repo | 20 (mostly 20261009–20261016, 202912xx, 20300106200000) |
| Non-standard filenames (no timestamp) | 3 (`085_`, `086_`, `087_`) |

Version history alone is unreliable: most live changes were applied under different timestamps than the repo files. So the schema itself was checked.

Tables that the unrecorded scripts create:
- 361 scripts: every table already exists live (effectively applied under another version)
- 56 scripts: partly applied (some tables exist, some don't)
- 98 scripts: none of their tables exist (truly missing)
- 562 distinct tables are missing live, mostly from Jul 2026 (282), the Dec 2029 "hardening/reconcile" batch (197), and Jun–Jul 2027 (27). Examples: achievement_* engine, attribute_catalog/definitions, balance_* versioning, band_agreements, band_proposals/votes, band_finance_policies, band_member_locks.

Scripts that only alter/replace functions, policies or columns were not yet classified — that's Phase 2.

## Reconciliation phases

1. **Freeze & snapshot** — no new DDL until done; confirm backup/point-in-time restore; export live history and schema dump to a private location (never committed).
2. **Full classification** — extend the existing `audit:migration-history` script to fingerprint each repo script against live objects (tables, columns, functions + signatures, policies, grants, triggers, cron jobs) and label each: Applied / Applied-under-other-version / Partial / Missing / Superseded / Obsolete-or-dangerous. Output a review sheet.
3. **Fix repo hygiene (no DB change)** — resolve the 20 duplicate versions and 3 untimestamped files per the existing timestamp policy; flag the 274 future-dated files; add a guard test so new duplicates/future dates fail CI.
4. **Decide per feature** — for each Missing/Partial cluster (achievements, attributes, balance, band governance/finance, Dec-2029 hardening), choose: deploy, merge into an existing live design, or retire. Many may be abandoned designs the live game replaced — these must not be applied blindly.
5. **Forward-only catch-up migrations** — for approved clusters, write new idempotent migrations (one cluster at a time, IF NOT EXISTS, with grants + RLS), test on a staging copy, apply, then re-verify. Never replay `production-repairs`, destructive gig processing or obsolete DM fallback scripts.
6. **Mark & archive** — record Applied-under-other-version scripts in a reconciliation registry (not by faking history rows); move retired scripts to an archive folder so fresh environments build the real live schema.
7. **Ongoing check** — scheduled read-only drift report comparing repo vs live.

## Needs your decision
- Whether a staging copy of the database is available (strongly recommended before Phase 5).
- Whether big unapplied features (achievement engine, band proposals/agreements, balance versioning) are still wanted or should be retired.

## Technical notes
- No production data or schema was changed during this audit.
- Approved plan execution starts with Phases 2–3 only (scripts, tests, report); every DB change in Phase 5 goes through the migration tool for your approval.
