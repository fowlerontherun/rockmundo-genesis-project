-- Harden the existing production XP audit ledger before quest payouts are enabled.
-- No reward grants, wallet mutations or claim processing in this migration.
-- Existing production ledger is public.experience_ledger, not public.xp_ledger.
do $$
begin
  if to_regclass('public.experience_ledger') is null then
    raise exception 'Quest XP ledger hardening requires public.experience_ledger';
  end if;
  if exists (
    select 1 from public.experience_ledger
    where activity_type = 'skill_quest_reward'
      and nullif(metadata->>'claim_id', '') is not null
    group by metadata->>'claim_id'
    having count(*) > 1
  ) then
    raise exception 'Duplicate skill quest claim IDs exist in experience_ledger; reconcile before installing uniqueness guard';
  end if;
end $$;

-- NOT VALID avoids rewriting historical rows during deployment, but the
-- constraint is enforced for all newly inserted/updated quest reward rows.
alter table public.experience_ledger
  add constraint experience_ledger_quest_claim_required
  check (
    activity_type <> 'skill_quest_reward'
    or nullif(metadata->>'claim_id', '') is not null
  ) not valid;

create unique index experience_ledger_quest_claim_unique
  on public.experience_ledger ((metadata->>'claim_id'))
  where activity_type = 'skill_quest_reward';

comment on index public.experience_ledger_quest_claim_unique is
  'Guarantees at most one XP audit row per quest reward claim; does not itself award XP.';
