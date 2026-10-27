-- Rebalance City Scene XP against live RockMundo activity economy.
-- Current source data: work shifts ~13 XP, individual recordings ~8 XP,
-- mentor sessions ~260 XP, university attendance ~142 median XP.
-- These are conservative participation rewards, not XP farming loops.
-- All reward policies and the independent payout switch stay disabled.
begin;
do $$
declare v_expected integer;
begin
  if exists(select 1 from public.scene_reward_claims)
     or exists(select 1 from public.scene_reward_grant_receipts)
  then raise exception 'Scene XP already has grants or claims; policy revision requires review';
  end if;
  if exists(select 1 from public.scene_reward_policies where enabled)
     or exists(select 1 from public.scene_reward_payout_controls where payouts_enabled)
  then raise exception 'Scene XP reward switches must be OFF for balance revision';
  end if;

  update public.scene_reward_policies
  set min_personal_points=case reward_key
      when 'daily_participation_xp' then 1
      when 'daily_completion_xp' then 1
      when 'weekly_participation_xp' then 2
      when 'monthly_participation_xp' then 3
    end,
    reward_amount=case reward_key
      when 'daily_participation_xp' then 20
      when 'daily_completion_xp' then 20
      when 'weekly_participation_xp' then 75
      when 'monthly_participation_xp' then 250
    end
  where reward_key in (
    'daily_participation_xp','daily_completion_xp',
    'weekly_participation_xp','monthly_participation_xp'
  ) and enabled=false and reward_kind='xp';

  get diagnostics v_expected=row_count;
  if v_expected<>4 then
    raise exception 'Expected four disabled scene XP policies; updated %',v_expected;
  end if;
  if exists(select 1 from public.scene_reward_policies where enabled)
    or exists(select 1 from public.scene_reward_payout_controls where payouts_enabled)
  then raise exception 'Scene XP unexpectedly enabled'; end if;
end $$;
commit;