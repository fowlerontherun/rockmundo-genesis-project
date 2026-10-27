-- City Scene XP payout transactional acceptance test.
-- Run ONLY on isolated staging after ALL City Scene migrations. It selects an
-- existing active test character from staging and ROLLS BACK every change.
-- psql -v ON_ERROR_STOP=1 -X -f supabase/tests/city_scene_xp_grant_staging_harness.sql
begin;

do $$
declare
  v_profile uuid;
  v_user uuid;
  v_city uuid;
  v_template uuid;
  v_cycle uuid;
  v_objective uuid;
  v_claim uuid;
  v_ledger uuid;
  v_baseline integer;
  v_after integer;
  v_payload jsonb;
  v_unique text := replace(gen_random_uuid()::text,'-','');
begin
  select p.id,p.user_id,p.current_city_id
    into v_profile,v_user,v_city
  from public.profiles p
  join auth.users au on au.id=p.user_id
  where p.user_id is not null
    and p.current_city_id is not null
    and p.deleted_at is null and p.is_active is true
  order by p.id
  limit 1;

  if v_profile is null then
    raise exception 'STAGING_FIXTURE_PROFILE_REQUIRED: add one real test account/profile/city';
  end if;

  if exists (select 1 from public.scene_reward_payout_controls where payouts_enabled)
    or exists (select 1 from public.scene_reward_policies where enabled)
    or exists (select 1 from public.scene_reward_claims)
  then
    raise exception 'ISOLATED_STAGING_REQUIRED: payout test cannot run on active scenes';
  end if;

  select coalesce(w.xp_balance,0) into v_baseline
  from public.player_xp_wallet w where w.profile_id=v_profile;
  v_baseline := coalesce(v_baseline,0);

  insert into public.scene_challenge_templates(
    slug,cadence,title,description,action_type,target_weight,enabled
  ) values (
    'staging-scene-' || v_unique,'daily','Staging scene payout',
    'Isolated fixture','gig:verified_performance',1,true
  ) returning id into v_template;

  insert into public.scene_challenge_cycles(
    city_id,cadence,starts_at,ends_at,active_population_snapshot,
    theme_slug,target_total,status
  ) values (
    v_city,'daily',now()-interval '2 days',now()-interval '1 day',
    1,'staging-fixture',1,'expired'
  ) returning id into v_cycle;

  insert into public.scene_challenge_objectives(
    cycle_id,template_id,target_points,
    source_health_snapshot
  ) values (
    v_cycle,v_template,1,'{"adapter":"test-fixture","scoring_enabled":false}'::jsonb
  ) returning id into v_objective;

  insert into public.scene_contributions(
    objective_id,account_id,profile_id,city_id,
    source_type,source_event_id,source_completed_at,points
  ) values (
    v_objective,v_user,v_profile,v_city,
    'staging_verified_fixture',v_unique,now()-interval '1 day 12 hours',1
  );

  insert into public.scene_reward_policies(
    reward_key,cadence,min_personal_points,requires_city_success,
    reward_kind,reward_amount,enabled
  ) values (
    'staging_scene_' || v_unique,'daily',1,true,'xp',17,true
  );

  -- This proves both eligibility and community-completion reward logic.
  if private.reconcile_scene_reward_entitlements(v_city) <> 1 then
    raise exception 'ENTITLEMENT_GENERATION_FAILED';
  end if;
  select id into v_claim from public.scene_reward_claims
  where cycle_id=v_cycle and account_id=v_user;
  if v_claim is null then raise exception 'CLAIM_NOT_CREATED'; end if;

  v_payload := public.scene_grant_earned_xp(25);
  if (v_payload->>'disabled')::boolean is not true
    or (v_payload->>'xp_granted')::int <> 0 then
    raise exception 'XP_GRANTED_WITH_PAYOUTS_DISABLED';
  end if;

  -- Revoked source contributions must never pay a previously qualified
  -- pending claim, even though it passed entitlement creation.
  update public.scene_contributions
  set invalidated_at=now()
  where objective_id=v_objective and account_id=v_user;

  update public.scene_reward_payout_controls
     set payouts_enabled=true,updated_at=now()
   where singleton is true;

  v_payload := public.scene_grant_earned_xp(25);
  if (v_payload->>'xp_granted')::int <> 0 then
    raise exception 'REVOKED_CONTRIBUTION_PAID_XP: %',v_payload;
  end if;

  update public.scene_contributions
  set invalidated_at=null
  where objective_id=v_objective and account_id=v_user;

  v_payload := public.scene_grant_earned_xp(25);
  if (v_payload->>'disabled')::boolean is true
    or (v_payload->>'xp_granted')::int <> 1 then
    raise exception 'EXPECTED_SINGLE_XP_GRANT: %',v_payload;
  end if;

  select ledger_id into v_ledger from public.scene_reward_grant_receipts
  where claim_id=v_claim and xp_amount=17 and profile_id=v_profile;
  if v_ledger is null then
    raise exception 'MISSING_GRANT_RECEIPT';
  end if;

  if not exists (
    select 1 from public.experience_ledger
    where id=v_ledger and profile_id=v_profile
      and user_id=v_user and activity_type='city_scene_reward'
      and xp_amount=17 and metadata->>'claim_id'=v_claim::text
  ) then
    raise exception 'MISSING_OR_INVALID_XP_LEDGER_ENTRY';
  end if;

  if not exists(
    select 1 from public.scene_reward_claims
    where id=v_claim and status='granted'
      and grant_reference=v_ledger::text and claimed_at is not null
  ) then
    raise exception 'CLAIM_NOT_MARKED_GRANTED';
  end if;

  select coalesce(xp_balance,0) into v_after
  from public.player_xp_wallet where profile_id=v_profile;
  if v_after - v_baseline <> 17 then
    raise exception 'INCORRECT_XP_WALLET_DELTA: %',v_after-v_baseline;
  end if;

  -- The same worker may run many times; claim and receipt make replay inert.
  v_payload := public.scene_grant_earned_xp(25);
  if (v_payload->>'xp_granted')::int <> 0 then
    raise exception 'DUPLICATE_XP_GRANT: %',v_payload;
  end if;

  if (select count(*) from public.scene_reward_grant_receipts
      where claim_id=v_claim) <> 1 then
    raise exception 'DUPLICATE_GRANT_RECEIPT';
  end if;

  if (select xp_balance from public.player_xp_wallet
      where profile_id=v_profile) <> v_after then
    raise exception 'REPLAY_MUTATED_XP_WALLET';
  end if;

  raise notice 'Scene XP staging harness passed: one entitlement, one ledger, one receipt, no duplicate XP.';
end;
$$;

rollback;
