-- City Scene: privileged, two-person review of corrected source evidence.
-- Never automatically revoke scores from diagnostic warnings.
-- Only the database owner/DBA may call these functions. No client/API grants.
-- No reward policy, cron or payout changes.
begin;

create table private.scene_correction_reviews (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null unique
    references public.scene_contributions(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','approved','dismissed','applied')),
  requested_by text not null check(length(btrim(requested_by))>=3),
  request_reason text not null check(length(btrim(request_reason))>=25),
  evidence_reference text not null check(length(btrim(evidence_reference))>=12),
  requested_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  applied_by text,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
create index scene_correction_reviews_status
  on private.scene_correction_reviews(status,requested_at desc);
alter table private.scene_correction_reviews enable row level security;
revoke all on private.scene_correction_reviews
  from public,anon,authenticated,service_role;

-- Reassess CURRENT canonical evidence, not the player's present city/band.
-- Do not mark ordinary travel or post-gig band departure as a false credit.
create or replace function private.scene_contribution_source_valid(
  p_contribution_id uuid
) returns boolean
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,private
as $$
declare
  v_sc public.scene_contributions%rowtype;
  v_event_id uuid;
begin
  select * into v_sc
  from public.scene_contributions where id=p_contribution_id;
  if not found then raise exception 'SCENE_CONTRIBUTION_NOT_FOUND'; end if;
  if v_sc.source_type not in (
    'verified_gig_performance','completed_recording','verified_rehearsal'
  ) then raise exception 'UNSUPPORTED_SCENE_CORRECTION_SOURCE'; end if;

  if v_sc.source_event_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then return false; end if;
  v_event_id:=v_sc.source_event_id::uuid;

  if v_sc.source_type='verified_gig_performance' then
    return exists (
      select 1 from public.gig_outcomes o
      join public.gigs g on g.id=o.gig_id
      join public.venues v on v.id=g.venue_id
      join public.gig_performers gp
        on gp.gig_id=o.gig_id and gp.profile_id=v_sc.profile_id
      join public.profiles p on p.id=v_sc.profile_id
      where o.id=v_event_id and o.completed_at=v_sc.source_completed_at
        and o.band_id=v_sc.band_id and g.band_id=v_sc.band_id
        and g.status='completed' and g.cancelled_at is null
        and v.city_id=v_sc.city_id
        and gp.lineup_status='performed'
        and gp.band_id=v_sc.band_id
        and gp.performed_at is not null and gp.performed_at<=o.completed_at
        and p.user_id=v_sc.account_id
    );
  elsif v_sc.source_type='completed_recording' then
    return exists (
      select 1 from public.recording_sessions s
      join public.profiles p on p.id=s.profile_id
      where s.id=v_event_id and s.status='completed'
        and s.completed_at=v_sc.source_completed_at
        and s.city_id=v_sc.city_id
        and s.profile_id=v_sc.profile_id
        and s.user_id=v_sc.account_id
        and s.band_id is not distinct from v_sc.band_id
        and p.user_id=v_sc.account_id
        and s.scheduled_end<=s.completed_at
        and jsonb_typeof(s.xp_awards)='object'
        and s.xp_awards<>'{}'::jsonb
    );
  else
    return exists (
      select 1 from public.band_rehearsals r
      join public.rehearsal_rooms rr on rr.id=r.rehearsal_room_id
      join public.profiles p on p.id=r.payment_profile_id
      where r.id=v_event_id and r.status='completed'
        and r.completed_at=v_sc.source_completed_at
        and r.payment_profile_id=v_sc.profile_id
        and p.user_id=v_sc.account_id
        and r.band_id=v_sc.band_id
        and rr.city_id=v_sc.city_id
        and r.scheduled_end<=r.completed_at and r.xp_earned>0
    );
  end if;
end;
$$;
revoke all on function private.scene_contribution_source_valid(uuid)
  from public,anon,authenticated,service_role;

create or replace function private.scene_request_correction(
  p_contribution_id uuid, p_requested_by text,
  p_reason text, p_evidence_reference text
) returns uuid
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$
declare
  v_sc public.scene_contributions%rowtype;
  v_review_id uuid;
  v_cycle_ends timestamptz;
begin
  if length(btrim(coalesce(p_requested_by,'')))<3
    or length(btrim(coalesce(p_reason,'')))<25
    or length(btrim(coalesce(p_evidence_reference,'')))<12 then
      raise exception 'SCENE_CORRECTION_REQUEST_REQUIRES_DOCUMENTED_EVIDENCE';
  end if;

  select * into v_sc from public.scene_contributions
    where id=p_contribution_id for update;
  if not found or v_sc.invalidated_at is not null then
    raise exception 'SCENE_CONTRIBUTION_NOT_ACTIVE';
  end if;
  select cyc.ends_at into v_cycle_ends
  from public.scene_challenge_objectives o
  join public.scene_challenge_cycles cyc on cyc.id=o.cycle_id
  where o.id=v_sc.objective_id;
  if v_cycle_ends<=now()-interval '7 days' then
    raise exception 'SCENE_CORRECTION_OUTSIDE_GRACE_REQUIRES_MANUAL_ESCALATION';
  end if;
  if private.scene_contribution_source_valid(v_sc.id) then
    raise exception 'SCENE_SOURCE_STILL_VALID_NO_CORRECTION_NEEDED';
  end if;

  insert into private.scene_correction_reviews(
    contribution_id,requested_by,request_reason,evidence_reference
  ) values(p_contribution_id,btrim(p_requested_by),
           btrim(p_reason),btrim(p_evidence_reference))
  on conflict(contribution_id) do nothing
  returning id into v_review_id;
  if v_review_id is null then
    raise exception 'SCENE_CORRECTION_ALREADY_REVIEWED_OR_PENDING';
  end if;
  return v_review_id;
end;
$$;
revoke all on function private.scene_request_correction(uuid,text,text,text)
 from public,anon,authenticated,service_role;

create or replace function private.scene_decide_correction(
  p_review_id uuid, p_reviewer text, p_approve boolean
) returns text
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$
declare v_review private.scene_correction_reviews%rowtype;
begin
  if length(btrim(coalesce(p_reviewer,'')))<3 or p_approve is null
    then raise exception 'SCENE_REVIEW_DECISION_INVALID'; end if;
  select * into v_review from private.scene_correction_reviews
  where id=p_review_id for update;
  if not found or v_review.status<>'pending' then
    raise exception 'SCENE_REVIEW_NOT_PENDING';
  end if;
  if lower(btrim(p_reviewer))=lower(v_review.requested_by) then
    raise exception 'SCENE_CORRECTION_REQUIRES_SECOND_REVIEWER';
  end if;
  if p_approve and private.scene_contribution_source_valid(v_review.contribution_id) then
    raise exception 'SCENE_SOURCE_RESTORED_CANNOT_APPROVE';
  end if;
  update private.scene_correction_reviews
    set status=case when p_approve then 'approved' else 'dismissed' end,
        approved_by=btrim(p_reviewer),approved_at=now()
    where id=p_review_id;
  return case when p_approve then 'approved' else 'dismissed' end;
end;
$$;
revoke all on function private.scene_decide_correction(uuid,text,boolean)
 from public,anon,authenticated,service_role;

create or replace function private.scene_apply_confirmed_correction(
  p_review_id uuid, p_applied_by text
) returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$
declare
  v_review private.scene_correction_reviews%rowtype;
  v_sc public.scene_contributions%rowtype;
  v_cycle uuid;
  v_city uuid;
  v_reconciled integer;
begin
  if length(btrim(coalesce(p_applied_by,'')))<3 then
    raise exception 'SCENE_CORRECTION_APPLIER_REQUIRED';
  end if;
  select * into v_review from private.scene_correction_reviews
    where id=p_review_id for update;
  if not found or v_review.status<>'approved'
    or v_review.approved_by is null
    or v_review.approved_at < now()-interval '24 hours' then
    raise exception 'SCENE_CORRECTION_NOT_RECENTLY_APPROVED';
  end if;
  select * into v_sc from public.scene_contributions
    where id=v_review.contribution_id for update;
  if not found or v_sc.invalidated_at is not null then
    raise exception 'SCENE_CONTRIBUTION_ALREADY_INACTIVE';
  end if;
  select cyc.id,cyc.city_id into v_cycle,v_city
    from public.scene_challenge_objectives o
    join public.scene_challenge_cycles cyc on cyc.id=o.cycle_id
    where o.id=v_sc.objective_id and cyc.ends_at>now()-interval '7 days';
  if v_cycle is null then
    raise exception 'SCENE_CYCLE_OUTSIDE_CORRECTION_GRACE';
  end if;

  -- Never silently claw back XP or invalidate a campaign with paid claims.
  -- Finance must reconcile those cases separately before any correction.
  if exists(
    select 1 from public.scene_reward_grant_receipts receipt
      join public.scene_reward_claims claim on claim.id=receipt.claim_id
    where claim.cycle_id=v_cycle
  ) then
    raise exception 'SCENE_PAID_REWARDS_REQUIRE_FINANCE_RECONCILIATION';
  end if;
  if private.scene_contribution_source_valid(v_sc.id) then
    raise exception 'SCENE_SOURCE_RESTORED_NO_INVALIDATION';
  end if;

  update public.scene_contributions
  set invalidated_at=now() where id=v_sc.id and invalidated_at is null;
  if not found then raise exception 'SCENE_CREDIT_CONCURRENTLY_CHANGED'; end if;

  -- Recompute objective, cycle and player-visible mural in this transaction.
  v_reconciled:=private.reconcile_scene_milestones(v_city);
  update private.scene_correction_reviews
    set status='applied',applied_by=btrim(p_applied_by),applied_at=now()
    where id=v_review.id;
  return jsonb_build_object(
    'review_id',v_review.id,'contribution_id',v_sc.id,'cycle_id',v_cycle,
    'status','applied','mural_rows_changed',v_reconciled
  );
end;
$$;
revoke all on function private.scene_apply_confirmed_correction(uuid,text)
 from public,anon,authenticated,service_role;
commit;
