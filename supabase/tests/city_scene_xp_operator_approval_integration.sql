-- Isolated PostgreSQL regression test of independent XP operator approval.
-- Requires all City Scene migrations applied. Never run against production.
-- Both approval and temporary enablement are rolled back.
begin;
do $$
declare
  v_policy_denied boolean := false;
  v_payout_denied boolean := false;
  v_reply jsonb;
begin
  if exists(select 1 from public.scene_reward_payout_controls where payouts_enabled)
     or exists(select 1 from public.scene_reward_policies where enabled)
     or exists(select 1 from public.scene_reward_grant_receipts)
  then raise exception 'ISOLATED_XP_APPROVAL_TEST_ONLY';end if;

  begin
    update public.scene_reward_policies
    set enabled=true where reward_key='daily_participation_xp';
  exception when insufficient_privilege then v_policy_denied:=true;
  end;
  begin
    update public.scene_reward_payout_controls
    set payouts_enabled=true where singleton=true;
  exception when insufficient_privilege then v_payout_denied:=true;
  end;
  if not v_policy_denied or not v_payout_denied then
    raise exception 'XP_REWARD_BOOLEAN_SWITCH_BYPASSED_OPERATOR_APPROVAL';
  end if;

  if has_table_privilege('service_role',
    'private.scene_reward_activation_authorizations','UPDATE')
    or has_table_privilege('authenticated',
    'private.scene_reward_activation_authorizations','SELECT')
  then raise exception 'PRIVATE_XP_APPROVAL_TABLE_EXPOSED';end if;

  update private.scene_reward_activation_authorizations
  set approved_until=clock_timestamp()+interval '5 minutes',
      approved_by='postgres-test',
      reason='Isolated SQL rollback-only approval guard regression',
      approval_recorded_at=clock_timestamp()
  where singleton=true;

  update public.scene_reward_policies
    set enabled=true where reward_key='daily_participation_xp';
  update public.scene_reward_payout_controls
    set payouts_enabled=true where singleton=true;

  update private.scene_reward_activation_authorizations
    set approved_until=clock_timestamp()-interval '1 second'
    where singleton=true;

  v_reply:=private.grant_scene_earned_xp(1);
  if (v_reply->>'disabled')::boolean is not true
     or (v_reply->>'approval_required')::boolean is not true
     or (v_reply->>'xp_granted')::integer<>0
  then raise exception 'EXPIRED_REWARD_APPROVAL_DID_NOT_FAIL_CLOSED: %',v_reply;end if;

  raise notice 'City Scene operator approval triggers, privileges and expiry guard passed';
end;
$$;
rollback;
