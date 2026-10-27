-- Dormant reward entitlement evaluation. No payouts or user claim RPC.
-- Config values are provisional, and policies are disabled until balance QA.
begin;

create table public.scene_reward_policies (
  reward_key text primary key check (length(reward_key) between 4 and 100),
  cadence text not null check (cadence in ('daily','weekly','monthly')),
  min_personal_points integer not null check (min_personal_points >= 1),
  requires_city_success boolean not null default false,
  reward_kind text not null check (reward_kind in ('xp')),
  reward_amount integer not null check (reward_amount between 1 and 10000),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.scene_reward_policies enable row level security;
revoke all on public.scene_reward_policies from public, anon, authenticated;
grant select on public.scene_reward_policies to authenticated;
grant all on public.scene_reward_policies to service_role;
create policy scene_reward_policy_visible
on public.scene_reward_policies for select to authenticated
using (enabled is true);

insert into public.scene_reward_policies
  (reward_key, cadence, min_personal_points,
   requires_city_success, reward_kind, reward_amount, enabled)
values
  ('daily_participation_xp', 'daily', 2, false, 'xp', 100, false),
  ('daily_completion_xp', 'daily', 2, true, 'xp', 50, false),
  ('weekly_participation_xp', 'weekly', 8, false, 'xp', 350, false),
  ('monthly_participation_xp', 'monthly', 20, false, 'xp', 1000, false)
on conflict(reward_key) do nothing;

alter table public.scene_reward_claims
  add column reward_kind text,
  add column reward_amount integer check (reward_amount is null or reward_amount > 0);

-- This function writes *pending* entitlements only. The eventual XP payout
-- processor must atomically mutate the canonical wallet and experience_ledger,
-- record its evidence, and mark the claim granted in the SAME transaction.
create or replace function private.reconcile_scene_reward_entitlements(
  p_city_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.scene_reward_claims (
    account_id, profile_id, cycle_id, reward_key,
    status, reward_kind, reward_amount
  )
  select earned.account_id, earned.profile_id,
    earned.cycle_id, policy.reward_key,
    'pending', policy.reward_kind, policy.reward_amount
  from (
    select cycle.id as cycle_id, cycle.cadence,
      cycle.city_id, cycle.target_total,
      contribution.account_id,
      (array_agg(contribution.profile_id
        order by contribution.source_completed_at, contribution.profile_id))[1]
          as profile_id,
      sum(contribution.points)::integer as earned_points,
      (
        select coalesce(sum(other_contribution.points), 0)::integer
        from public.scene_contributions other_contribution
        join public.scene_challenge_objectives other_objective
          on other_objective.id = other_contribution.objective_id
        where other_objective.cycle_id = cycle.id
          and other_contribution.invalidated_at is null
      ) as city_points
    from public.scene_challenge_cycles cycle
    join public.scene_challenge_objectives objective
      on objective.cycle_id = cycle.id
    join public.scene_contributions contribution
      on contribution.objective_id = objective.id
    where cycle.ends_at <= now()
      and cycle.status in ('expired','completed')
      and contribution.invalidated_at is null
      and (p_city_id is null or cycle.city_id = p_city_id)
    group by cycle.id, cycle.cadence, cycle.city_id, cycle.target_total,
      contribution.account_id
  ) earned
  join public.scene_reward_policies policy
    on policy.cadence = earned.cadence and policy.enabled is true
    and earned.earned_points >= policy.min_personal_points
    and (policy.requires_city_success is false
      or earned.city_points >= earned.target_total)
  on conflict(account_id, cycle_id, reward_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function private.reconcile_scene_reward_entitlements(uuid)
  from public, anon, authenticated;
grant execute on function private.reconcile_scene_reward_entitlements(uuid)
  to service_role;

create or replace function public.scene_reconcile_reward_entitlements(p_city_id uuid default null)
returns integer
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.reconcile_scene_reward_entitlements(p_city_id);
$$;

revoke all on function public.scene_reconcile_reward_entitlements(uuid)
  from public, anon, authenticated;
grant execute on function public.scene_reconcile_reward_entitlements(uuid)
  to service_role;
commit;