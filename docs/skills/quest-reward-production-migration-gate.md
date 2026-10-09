# Skill quest rewards: production migration gate (2026-10-09)

## Observed on connected Rockmundo production Supabase
- Present: `public.profiles`, `public.player_xp_wallet`.
- Absent: `public.skill_quest_events`, `public.profile_action_xp_events`, `public.xp_ledger`, `public.skill_quest_reward_claims`, `public.skill_quest_reward_definitions`, `public.process_skill_quest_xp_claim(uuid)`.
- `supabase_migrations.schema_migrations` contains 20261009 versions, but **not** the GitHub migration filenames 20261009090000, 20261009160000, 20261009170000, 20261009180000, 20261009190000, 20261009200000.
- No production DDL or XP mutations performed during this audit.

## Safe deployment gate
1. Compare complete remote migration history to repository migrations; determine why migration versions differ. Do not mark unapplied migrations as applied.
2. Verify baseline `profile_action_xp_events` and `xp_ledger` creation dependencies, triggers, RLS and existing wallet semantics. Avoid replaying older baseline migrations blindly against an evolved schema.
3. Stage/test migration chain in dependency order: action XP/ledger infrastructure; quest events and verified source triggers; reward claims; reward definitions; claim enqueue; payout processor; hardening.
4. Confirm all reward definitions remain `enabled = false` and no scheduler calls the payout function.
5. Test using disposable test profiles in staging, not live players:
   - Non-service roles cannot call payout or insert claims.
   - Missing verified event and disabled definition do not award XP.
   - One valid claim increments wallet/profile XP exactly once and creates one XP ledger entry.
   - Repeated call returns `already_granted` with no additional XP.
   - Two concurrent workers grant once.
   - A stale pending claim with a pre-existing XP event fails closed.
   - Trigger/ledger failure rolls back XP, claim status and wallet.
   - Historical backfill does not duplicate claims.
6. Re-run production schema inspection and migration/advisor checks before enabling any definition. Enabling rewards is a separate reviewed release.

## Queries (read-only)
```sql
select table_schema, table_name from information_schema.tables
where table_schema = 'public' and table_name in
('profiles','player_xp_wallet','profile_action_xp_events','xp_ledger',
 'skill_quest_events','skill_quest_reward_claims','skill_quest_reward_definitions')
order by table_name;
select version from supabase_migrations.schema_migrations
where version like '20261009%' order by version;
select to_regprocedure('public.process_skill_quest_xp_claim(uuid)');
```
