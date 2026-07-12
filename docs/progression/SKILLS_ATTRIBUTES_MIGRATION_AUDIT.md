# Skills & Attributes Migration Audit

## Warning
Do not rename or rewrite already-applied production migrations without first checking the production Supabase migration history. Renaming historical files can cause Supabase to attempt duplicate or out-of-order changes.

## Suspicious filenames and ordering risks

- `20260923110000_normalize_skills.sql` creates normalized skill definition/progress structures after older skill progress tables. This is future-dated relative to the current 2026 work and may run after dependent feature migrations in fresh environments.
- `20261025100000_add_extended_skill_definitions.sql` and `20261205100000_create_skill_books_tables.sql` are future-dated and may depend on normalized skill tables being present.
- `20261030130000_create_xp_tables.sql` and `20270601120000_add_daily_xp_allocation.sql` introduce XP wallet/allocation concepts with future timestamps, which can make local reset order differ from production if production has already applied equivalent changes manually.
- `20291202090000_beta_rls_hardening.sql` is intentionally far-future dated and should be reviewed before any production reset or migration replay.

## Safety assessment

The suspicious migrations appear additive or hardening-oriented, but the future timestamps create ordering risk for fresh database builds and branch previews. This PR does not rename or rewrite historical migrations.

## Recommended follow-up

Create a dedicated migration-history follow-up to compare production migration records with repository filenames, then add corrective forward-only migrations if any dependency order is unsafe. Avoid editing previously applied files.
