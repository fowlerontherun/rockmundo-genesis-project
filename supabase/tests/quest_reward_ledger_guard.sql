-- Run only on a staging/test database after both quest ledger guard migrations.
-- Transaction rolls back all fixtures; no live players or XP are touched.
begin;
do $$
declare
  v_constraint_exists boolean;
  v_index_exists boolean;
begin
  select exists (
    select 1 from pg_constraint
    where conrelid='public.experience_ledger'::regclass
      and conname='experience_ledger_quest_claim_required'
      and convalidated
  ) into v_constraint_exists;
  if not v_constraint_exists then
    raise exception 'Quest claim-ID constraint is missing or unvalidated';
  end if;

  select exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='experience_ledger'
      and indexname='experience_ledger_quest_claim_unique'
  ) into v_index_exists;
  if not v_index_exists then
    raise exception 'Quest claim-ID unique index missing';
  end if;

  -- CHECK is null-safe: these expressions must be FALSE for bad claim IDs.
  if ('skill_quest_reward' is distinct from 'skill_quest_reward'
       or nullif(btrim(coalesce(null::jsonb->>'claim_id','')),'') is not null)
    is distinct from false then
    raise exception 'NULL metadata must fail the quest claim check';
  end if;

  if ('skill_quest_reward' is distinct from 'skill_quest_reward'
       or nullif(btrim(coalesce('{"claim_id":"   "}'::jsonb->>'claim_id','')),'') is not null)
    is distinct from false then
    raise exception 'Whitespace claim ID must fail the quest claim check';
  end if;

  if ('skill_quest_reward' is distinct from 'skill_quest_reward'
       or nullif(btrim(coalesce('{"claim_id":"valid-id"}'::jsonb->>'claim_id','')),'') is not null)
    is distinct from true then
    raise exception 'Valid claim ID must pass the quest claim check';
  end if;
end $$;
rollback;
