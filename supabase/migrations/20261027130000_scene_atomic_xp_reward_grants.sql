-- City Scene XP rewards: gated, exactly-once grants through existing wallet.
-- All payout switches and reward policies are disabled by default.
-- No scheduler or public player claim RPC is installed.
begin;

create table public.scene_reward_payout_controls (
  singleton boolean primary key default true check (singleton is true),
  payouts_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.scene_reward_payout_controls(singleton,payouts_enabled)
values(true,false)
on conflict(singleton) do nothing;
alter table public.scene_reward_payout_controls enable row level security;
revoke all on public.scene_reward_payout_controls from public, anon, authenticated;
grant all on public.scene_reward_payout_controls to service_role;

create table public.scene_reward_grant_receipts (
  claim_id uuid primary key references public.scene_reward_claims(id) on delete restrict,
  ledger_id uuid not null unique references public.experience_ledger(id) on delete restrict,
  account_id uuid not null references auth.users(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  xp_amount integer not null check (xp_amount between 1 and 10000),
  granted_at timestamptz not null default now()
);
create index scene_reward_grant_receipts_account_history
  on public.scene_reward_grant_receipts(account_id,granted_at desc);
alter table public.scene_reward_grant_receipts enable row level security;
revoke all on public.scene_reward_grant_receipts from public, anon, authenticated;
grant all on public.scene_reward_grant_receipts to service_role;

-- Snapshot entitlement eligibility at the end of the challenge cycle.
-- Pending rewards have a seven-day grace window. Existing reward policies
-- remain explicitly disabled; this only hardens how future claims are created.
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
    account_id, profile_id, cycle_id, reward_key, status,
    reward_kind, reward_amount, entitled_at, expires_at
  )
  select earned.account_id, earned.profile_id, earned.cycle_id, policy.reward_key,
    'pending', policy.reward_kind, policy.reward_amount,
    earned.ends_at, earned.ends_at + interval '7 days'
  from (
    select c.id as cycle_id, c.cadence, c.city_id, c.target_total, c.ends_at,
      sc.account_id,
      (array_agg(sc.profile_id order by sc.source_completed_at,sc.profile_id))[1]
        as profile_id,
      sum(sc.points)::integer as earned_points,
      private.scene_capped_cycle_points(c.id) as city_points
    from public.scene_challenge_cycles c
    join public.scene_challenge_objectives obj on obj.cycle_id = c.id
    join public.scene_contributions sc on sc.objective_id = obj.id
    where c.ends_at <= now()
      and c.ends_at > now() - interval '7 days'
      and c.status in ('expired','completed')
      and sc.invalidated_at is null
      and (p_city_id is null or c.city_id = p_city_id)
    group by c.id,c.cadence,c.city_id,c.target_total,c.ends_at,sc.account_id
  ) earned
  join public.scene_reward_policies policy
    on policy.cadence = earned.cadence
    and policy.enabled is true
    and earned.earned_points >= policy.min_personal_points
    and (policy.requires_city_success is false
         or earned.city_points >= earned.target_total)
  on conflict(account_id,cycle_id,reward_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;
revoke all on function private.reconcile_scene_reward_entitlements(uuid)
  from public,anon,authenticated;
grant execute on function private.reconcile_scene_reward_entitlements(uuid)
  to service_role;

-- Each locked claim, wallet mutation, ledger entry, receipt and claim status
-- participate in ONE database transaction. Any exception rolls it all back.
create or replace function private.grant_scene_earned_xp(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_claim record;
  v_profile record;
  v_ledger_id uuid;
  v_granted integer := 0;
  v_expired integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid scene XP batch limit';
  end if;

  if not exists (
    select 1 from public.scene_reward_payout_controls
    where singleton is true and payouts_enabled is true
  ) then
    return jsonb_build_object('disabled',true,'xp_granted',0,'claims_expired',0);
  end if;

  -- Expired unclaimed rewards cannot be paid.
  update public.scene_reward_claims c
  set status = 'expired'
  where c.status = 'pending'
    and c.expires_at <= now()
    and c.reward_kind = 'xp';
  get diagnostics v_expired = row_count;

  for v_claim in
    select c.id,c.account_id,c.profile_id,c.cycle_id,c.reward_key,
      c.reward_amount,c.reward_kind,c.entitled_at,c.expires_at
    from public.scene_reward_claims c
    join public.scene_challenge_cycles cyc on cyc.id = c.cycle_id
    join public.scene_reward_policies policy
      on policy.reward_key = c.reward_key
      and policy.cadence = cyc.cadence
      and policy.enabled is true
      and policy.reward_kind = c.reward_kind
      and policy.reward_amount = c.reward_amount
    where c.status = 'pending'
      and c.reward_kind = 'xp'
      and c.reward_amount between 1 and 10000
      and c.entitled_at <= now()
      and c.expires_at > now()
      and cyc.ends_at <= now()
      and cyc.ends_at > now() - interval '7 days'
    order by c.entitled_at,c.id
    for update of c skip locked
    limit p_limit
  loop
    select p.id,p.user_id into v_profile
      from public.profiles p
      where p.id = v_claim.profile_id
        and p.user_id = v_claim.account_id
        and p.deleted_at is null and p.is_active is true
      for update;
    if not found then
      -- No payout for an inactive/deleted/mismatched character. Retain
      -- entitlement for manual remediation; do not mark as paid.
      continue;
    end if;

    if exists(
      select 1 from public.scene_reward_grant_receipts gr
      where gr.claim_id = v_claim.id
    ) then
      raise exception 'SCENE_GRANT_RECEIPT_STATE_MISMATCH for claim %', v_claim.id;
    end if;

    insert into public.player_xp_wallet(profile_id)
    values(v_profile.id)
    on conflict(profile_id) do nothing;

    update public.player_xp_wallet
    set xp_balance = coalesce(xp_balance,0) + v_claim.reward_amount,
      lifetime_xp = coalesce(lifetime_xp,0) + v_claim.reward_amount,
      skill_xp_balance = coalesce(skill_xp_balance,0) + v_claim.reward_amount,
      skill_xp_lifetime = coalesce(skill_xp_lifetime,0) + v_claim.reward_amount,
      last_recalculated = now()
    where profile_id = v_profile.id;

    insert into public.experience_ledger
      (profile_id,user_id,activity_type,xp_amount,metadata)
    values (
      v_profile.id,v_claim.account_id,'city_scene_reward',v_claim.reward_amount,
      jsonb_build_object(
        'claim_id',v_claim.id,'cycle_id',v_claim.cycle_id,
        'reward_key',v_claim.reward_key,'source','verified_scene_challenge'
      )
    ) returning id into v_ledger_id;

    insert into public.scene_reward_grant_receipts
      (claim_id,ledger_id,account_id,profile_id,xp_amount)
    values(v_claim.id,v_ledger_id,v_claim.account_id,v_profile.id,v_claim.reward_amount);

    update public.scene_reward_claims
    set status='granted',claimed_at=now(),grant_reference=v_ledger_id::text
    where id=v_claim.id and status='pending';
    if not found then
      raise exception 'SCENE_CLAIM_STATE_CHANGED for claim %',v_claim.id;
    end if;

    v_granted := v_granted + 1;
  end loop;

  return jsonb_build_object(
    'disabled',false,'xp_granted',v_granted,
    'claims_expired',v_expired
  );
end;
$$;
revoke all on function private.grant_scene_earned_xp(integer)
  from public,anon,authenticated;
grant execute on function private.grant_scene_earned_xp(integer)
  to service_role;

create or replace function public.scene_grant_earned_xp(p_limit integer default 25)
returns jsonb language sql security invoker
set search_path = pg_catalog,public,private
as $$ select private.grant_scene_earned_xp(p_limit); $$;
revoke all on function public.scene_grant_earned_xp(integer)
  from public,anon,authenticated;
grant execute on function public.scene_grant_earned_xp(integer)
  to service_role;
commit;