-- Fix SQL three-valued logic in the quest claim-ID guard.
-- A CHECK passes when its expression is NULL; nullable metadata must be
-- handled explicitly so a quest reward cannot be logged without claim_id.
-- Safe both when the prior guard migration has already run and when it has not.
do $$
begin
  if to_regclass('public.experience_ledger') is null then
    raise exception 'Missing public.experience_ledger';
  end if;

  if exists (
    select 1 from public.experience_ledger
    where activity_type = 'skill_quest_reward'
      and nullif(btrim(coalesce(metadata->>'claim_id', '')), '') is null
  ) then
    raise exception 'Existing quest reward ledger rows lack claim IDs; reconcile before hardening';
  end if;

  alter table public.experience_ledger
    drop constraint if exists experience_ledger_quest_claim_required;

  alter table public.experience_ledger
    add constraint experience_ledger_quest_claim_required
    check (
      activity_type is distinct from 'skill_quest_reward'
      or nullif(btrim(coalesce(metadata->>'claim_id', '')), '') is not null
    ) not valid;
end $$;

-- Validates all existing rows. Quest entries without IDs must be reconciled,
-- rather than silently grandfathered in.
alter table public.experience_ledger
  validate constraint experience_ledger_quest_claim_required;
