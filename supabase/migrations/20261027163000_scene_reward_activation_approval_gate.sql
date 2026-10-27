-- City Scene independent XP operator approval, fail-closed by default.
-- Requires an explicit short-lived human-authored approval in private schema
-- BEFORE any policy or payout toggle can be enabled. A boolean alone cannot
-- activate grants. Approved time windows expire automatically during payouts.
begin;

create table if not exists private.scene_reward_activation_authorizations (
  singleton boolean primary key default true check(singleton is true),
  approved_until timestamptz,
  reason text,
  approved_by text,
  approval_recorded_at timestamptz
);
insert into private.scene_reward_activation_authorizations(singleton)
values(true) on conflict(singleton) do nothing;
revoke all on private.scene_reward_activation_authorizations
  from public,anon,authenticated,service_role;

create or replace function private.scene_require_xp_activation_approval()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if new.enabled is true and (
     tg_op='INSERT' or old.enabled is distinct from true
  ) then
    if not exists(
      select 1 from private.scene_reward_activation_authorizations a
      where a.singleton is true
        and a.approved_until > clock_timestamp()
        and length(trim(coalesce(a.reason,''))) >= 16
        and length(trim(coalesce(a.approved_by,''))) >= 3
    ) then
      raise exception 'SCENE_XP_OPERATOR_APPROVAL_REQUIRED'
        using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.scene_require_xp_activation_approval()
  from public,anon,authenticated;
drop trigger if exists scene_reward_policy_activation_guard
  on public.scene_reward_policies;
create trigger scene_reward_policy_activation_guard
  before insert or update of enabled on public.scene_reward_policies
  for each row execute function private.scene_require_xp_activation_approval();

create or replace function private.scene_require_payout_activation_approval()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if new.payouts_enabled is true and (
    tg_op='INSERT' or old.payouts_enabled is distinct from true
  ) then
    if not exists(
      select 1 from private.scene_reward_activation_authorizations a
      where a.singleton is true
        and a.approved_until > clock_timestamp()
        and length(trim(coalesce(a.reason,''))) >= 16
        and length(trim(coalesce(a.approved_by,''))) >= 3
    ) then
      raise exception 'SCENE_XP_OPERATOR_APPROVAL_REQUIRED'
        using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.scene_require_payout_activation_approval()
  from public,anon,authenticated;
drop trigger if exists scene_reward_payout_activation_guard
  on public.scene_reward_payout_controls;
create trigger scene_reward_payout_activation_guard
  before insert or update of payouts_enabled on public.scene_reward_payout_controls
  for each row execute function private.scene_require_payout_activation_approval();

-- Preserve the reviewed exactly-once wallet, ledger and receipt transaction;
-- only add a second authorization check before any expiry or grant writes.
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

  -- Even if a switch was left ON, payout requires an independently
  -- authorised, time-bounded operator approval. Expired approvals fail closed.
  if not exists (
    select 1 from private.scene_reward_activation_authorizations a
    where a.singleton is true
      and a.approved_until > clock_timestamp()
      and length(trim(coalesce(a.reason,''))) >= 16
      and length(trim(coalesce(a.approved_by,''))) >= 3
  ) then
    return jsonb_build_object(
      'disabled',true,'approval_required',true,
      'xp_granted',0,'claims_expired',0
    );
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
      and cyc.status in ('expired','completed')
      and c.entitled_at = cyc.ends_at
      -- Re-check eligibility just before paying. An invalidated gig or
      -- recording must not remain payable simply because a pending claim
      -- was created earlier in the seven-day reward grace window.
      and (
        select coalesce(sum(sc.points),0)
        from public.scene_contributions sc
        join public.scene_challenge_objectives obj
          on obj.id=sc.objective_id
        where obj.cycle_id=c.cycle_id
          and sc.account_id=c.account_id
          and sc.invalidated_at is null
      ) >= policy.min_personal_points
      and (policy.requires_city_success is false
        or private.scene_capped_cycle_points(c.cycle_id) >= cyc.target_total)
    order by c.entitled_at,c.id
    limit p_limit
    for update of c skip locked
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
commit;
