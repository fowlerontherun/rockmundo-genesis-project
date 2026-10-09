# Live XP schema reconciliation — 2026-10-09

The connected production database does **not** have the repository's `profile_action_xp_events` or `xp_ledger` tables. It **does** have `experience_ledger`, `profile_daily_xp_grants`, and `player_xp_wallet`. These are not interchangeable: `experience_ledger` has columns `id,user_id,profile_id,activity_type,xp_amount,skill_slug,metadata,created_at`, whereas the pending reward processor requires `xp_ledger(id,profile_id,event_type,xp_delta,balance_after,metadata)` and a trigger on `profile_action_xp_events`.

The live migration history is populated with `name` and `version` fields; its latest records include `20261009112112 expire_ineligible_skill_reward_events`, `20261009112110 prevent_empty_random_skill_rewards`, and `20261009103513 atomic_university_and_passive_reconcile`. These versions are distinct from the GitHub skills quest migration versions. **Do not mark GitHub migrations applied based only on date.**

## Blockers before any live DDL

1. Establish whether GitHub migrations dated `20261031*` are intentionally future-dated and whether they can be safely deployed against the live evolved wallet schema. The reward processor assumes their XP trigger exists.
2. Review current live XP functions and triggers, especially `experience_ledger` effects and `player_xp_wallet` balance updates, to avoid awarding XP twice.
3. Confirm that every quest source trigger's dependencies exist (gig, songwriting, recording, luthiery); otherwise apply individually after staging validation.
4. Test the complete chain on a clone/staging database and prove a payout creates **exactly one** authoritative XP ledger record and updates wallet/profile XP once.
5. Keep `skill_quest_reward_definitions.enabled = false`; do not run payout RPC in production until tests pass.

## Read-only inspection queries

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name in ('experience_ledger','profile_action_xp_events','xp_ledger',
                     'player_xp_wallet','profile_daily_xp_grants')
order by table_name, ordinal_position;

select version,name from supabase_migrations.schema_migrations
order by version desc limit 20;

select tgname, tgrelid::regclass as attached_to,
       tgfoid::regprocedure as function_name
from pg_trigger
where not tgisinternal and tgrelid in
  ('public.player_xp_wallet'::regclass,'public.experience_ledger'::regclass);
```

No schema modifications or XP grants were made during this audit.
