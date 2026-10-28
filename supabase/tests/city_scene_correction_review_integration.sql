-- Rollback-only integration for the operator-reviewed City Scene correction flow.
-- Run against disposable PostgreSQL CI fixture, NEVER against production.
begin;
do $$
declare
  v_city uuid:='20000000-0000-0000-0000-000000000001';
  v_profile uuid:='30000000-0000-0000-0000-000000000001';
  v_user uuid:='10000000-0000-0000-0000-000000000001';
  v_band uuid:=gen_random_uuid();
  v_venue uuid:=gen_random_uuid();
  v_gig uuid:=gen_random_uuid();
  v_outcome uuid:=gen_random_uuid();
  v_cycle uuid;
  v_weekly_cycle uuid;
  v_template uuid;
  v_weekly_template uuid;
  v_obj uuid;
  v_weekly_obj uuid;
  v_credit uuid;
  v_weekly_credit uuid;
  v_review uuid;
  v_claim uuid;
  v_ledger uuid;
  v_failed boolean;
  v_result jsonb;
  v_event timestamptz:=now()-interval '1 hour';
begin
  if (select count(*) from public.cities)<>1
    or exists(select 1 from public.scene_contributions)
  then raise exception 'DISPOSABLE_SCENE_CORRECTION_FIXTURE_REQUIRED';end if;
  if has_function_privilege('authenticated','private.scene_apply_confirmed_correction(uuid,text)','EXECUTE')
    or has_function_privilege('anon','private.scene_apply_confirmed_correction(uuid,text)','EXECUTE')
    or has_function_privilege('service_role','private.scene_apply_confirmed_correction(uuid,text)','EXECUTE')
    or has_table_privilege('service_role','private.scene_correction_reviews','UPDATE')
    or has_table_privilege('authenticated','private.scene_correction_reviews','SELECT')
  then raise exception 'SCENE_CORRECTION_OPERATOR_PRIVILEGE_BYPASS';end if;

  select id into strict v_template from public.scene_challenge_templates
  where cadence='daily' order by id limit 1;
  select id into strict v_weekly_template from public.scene_challenge_templates
  where cadence='weekly' order by id limit 1;
  insert into public.scene_challenge_cycles(
    city_id,cadence,starts_at,ends_at,
    active_population_snapshot,theme_slug,target_total,status
  ) values(v_city,'daily',now()-interval '2 hours',now()+interval '2 hours',
    1,'correction-test',1,'active') returning id into v_cycle;
  insert into public.scene_challenge_objectives(
    cycle_id,template_id,target_points,source_health_snapshot
  ) values(v_cycle,v_template,1,'{"scoring_enabled":false}'::jsonb)
  returning id into v_obj;
  insert into public.scene_challenge_cycles(
    city_id,cadence,starts_at,ends_at,
    active_population_snapshot,theme_slug,target_total,status
  ) values(v_city,'weekly',now()-interval '2 hours',now()+interval '2 hours',
    1,'correction-weekly-test',1,'active') returning id into v_weekly_cycle;
  insert into public.scene_challenge_objectives(
    cycle_id,template_id,target_points,source_health_snapshot
  ) values(v_weekly_cycle,v_weekly_template,1,'{"scoring_enabled":false}'::jsonb)
  returning id into v_weekly_obj;

  insert into public.bands(id) values(v_band);
  insert into public.venues(id,city_id) values(v_venue,v_city);
  insert into public.gigs(id,venue_id,band_id,status)
    values(v_gig,v_venue,v_band,'completed');
  insert into public.gig_outcomes(id,gig_id,band_id,completed_at)
    values(v_outcome,v_gig,v_band,v_event);
  insert into public.gig_performers(
    gig_id,band_id,profile_id,lineup_status,performed_at
  ) values(v_gig,v_band,v_profile,'performed',v_event-interval '15 minutes');
  insert into public.scene_contributions(
    objective_id,account_id,profile_id,band_id,city_id,
    source_type,source_event_id,source_completed_at,points
  ) values(v_obj,v_user,v_profile,v_band,v_city,
    'verified_gig_performance',v_outcome::text,v_event,1)
  returning id into v_credit;
  insert into public.scene_contributions(
    objective_id,account_id,profile_id,band_id,city_id,
    source_type,source_event_id,source_completed_at,points
  ) values(v_weekly_obj,v_user,v_profile,v_band,v_city,
    'verified_gig_performance',v_outcome::text,v_event,1)
  returning id into v_weekly_credit;

  if not private.scene_contribution_source_valid(v_credit)
  then raise exception 'VALID_GIG_WAS_REJECTED';end if;
  perform private.reconcile_scene_milestones(v_city);
  if (select count(*) from public.scene_milestones
    where cycle_id in(v_cycle,v_weekly_cycle) and revoked_at is null)<>8
  then raise exception 'EXPECTED_COMPLETE_MURAL_BEFORE_CORRECTION';end if;

  -- A cancelled gig is a potential correction, not an automatic reversal.
  update public.gigs set cancelled_at=now() where id=v_gig;
  if private.scene_contribution_source_valid(v_credit)
  then raise exception 'CANCELLED_SOURCE_REPORTED_VALID';end if;
  if (select count(*) from public.scene_contributions
    where id in(v_credit,v_weekly_credit) and invalidated_at is null)<>2
  then raise exception 'AUTOMATIC_DELETION_BEFORE_HUMAN_REVIEW';end if;

  v_review:=private.scene_request_correction(
    v_credit,'operations-requester',
    'Gig was cancelled after the final outcome was published',
    'issue:scene-ci-fixture-01'
  );

  v_failed:=false;
  begin
    perform private.scene_decide_correction(v_review,'operations-requester',true);
  exception when raise_exception then v_failed:=true; end;
  if not v_failed then raise exception 'SAME_REVIEWER_APPROVED_OWN_REQUEST';end if;

  v_failed:=false;
  begin
    perform private.scene_apply_confirmed_correction(v_review,'db-operator');
  exception when raise_exception then v_failed:=true; end;
  if not v_failed then raise exception 'PENDING_REVIEW_APPLIED_WITHOUT_APPROVAL';end if;

  perform private.scene_decide_correction(v_review,'independent-reviewer',true);

  -- An operator cannot revoke an already restored source.
  update public.gigs set cancelled_at=null where id=v_gig;
  v_failed:=false;
  begin
    perform private.scene_apply_confirmed_correction(v_review,'db-operator');
  exception when raise_exception then v_failed:=true; end;
  if not v_failed then raise exception 'RESTORED_GIG_WAS_INVALIDATED';end if;
  update public.gigs set cancelled_at=now() where id=v_gig;

  -- Simulated already-paid rewards block correction until finance resolves.
  insert into public.scene_reward_claims(
    account_id,profile_id,cycle_id,reward_key,status,
    entitled_at,claimed_at,grant_reference,reward_kind,reward_amount
  ) values(v_user,v_profile,v_weekly_cycle,'weekly_participation_xp','granted',
    now()-interval '5 minutes',now(), 'manual-fixture-ledger', 'xp',10)
  returning id into v_claim;
  insert into public.experience_ledger(
    profile_id,user_id,activity_type,xp_amount,metadata
  ) values(v_profile,v_user,'city_scene_reward',10,'{}'::jsonb)
  returning id into v_ledger;
  insert into public.scene_reward_grant_receipts(
    claim_id,ledger_id,account_id,profile_id,xp_amount
  ) values(v_claim,v_ledger,v_user,v_profile,10);

  v_failed:=false;
  begin
    perform private.scene_apply_confirmed_correction(v_review,'db-operator');
  exception when raise_exception then v_failed:=true; end;
  if not v_failed then raise exception 'PAID_REWARD_WITHOUT_FINANCE_ESCALATION';end if;

  -- Fixtures are synthetic; remove them only inside the rolled-back test.
  delete from public.scene_reward_grant_receipts where claim_id=v_claim;
  delete from public.scene_reward_claims where id=v_claim;
  delete from public.experience_ledger where id=v_ledger;

  v_result:=private.scene_apply_confirmed_correction(v_review,'db-operator');
  if v_result->>'status'<>'applied'
    or (v_result->>'credits_invalidated')::int<>2
    or (v_result->>'cycles_affected')::int<>2
    or (select count(*) from public.scene_contributions
      where id in(v_credit,v_weekly_credit) and invalidated_at is not null)<>2
    or (select count(*) from private.scene_correction_affected
      where review_id=v_review)<>2
    or (select count(*) from public.scene_milestones
      where cycle_id in(v_cycle,v_weekly_cycle) and revoked_at is not null)<>8
    or (select count(*) from public.scene_challenge_cycles
      where id in(v_cycle,v_weekly_cycle) and status='active')<>2
    or not exists(select 1 from private.scene_correction_reviews
      where id=v_review and status='applied' and applied_by='db-operator')
  then raise exception 'CONFIRMED_SCENE_CORRECTION_NOT_ATOMIC: %',v_result;end if;

  if exists(select 1 from public.scene_reward_grant_receipts)
  then raise exception 'CORRECTION_CREATED_XP_RECEIPT';end if;
  raise notice 'Scene dual review, two-cadence reversal, paid-claim block and atomic mural invalidation passed';
end;
$$;
rollback;