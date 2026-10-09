-- Compatibility gate: existing production XP audit ledger is experience_ledger.
-- This migration intentionally performs no XP grants or wallet updates.
-- Run after the original skill_quest_reward_claims migration.
do $$
begin
  if to_regclass('public.skill_quest_reward_claims') is null then
    raise exception 'skill_quest_reward_claims is missing: apply its base migration first';
  end if;
  if to_regclass('public.experience_ledger') is null then
    raise exception 'experience_ledger is missing: cannot bind payout evidence';
  end if;
  if exists (
    select 1 from public.skill_quest_reward_claims
    where xp_ledger_id is not null
  ) then
    raise exception 'Claims already reference legacy xp_ledger evidence: reconcile before changing reference';
  end if;
end $$;

-- Existing claims cannot have been granted without ledger evidence due to
-- the original granted-evidence CHECK. Drop the obsolete FK and bind evidence
-- to the actual live ledger without changing status or amount.
alter table public.skill_quest_reward_claims
  drop constraint if exists skill_quest_reward_claims_xp_ledger_id_fkey;

alter table public.skill_quest_reward_claims
  add constraint skill_quest_reward_claims_xp_ledger_id_fkey
  foreign key (xp_ledger_id) references public.experience_ledger(id)
  on delete restrict;

comment on column public.skill_quest_reward_claims.xp_ledger_id is
  'XP payout evidence ID in public.experience_ledger (legacy column name retained for UI compatibility).';
