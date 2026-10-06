-- Complete the referral VIP lifecycle: payment marks the referral immediately,
-- then an authenticated dashboard refresh promotes held rewards once the 7-day hold expires.
create or replace function public.refresh_referral_vip_eligibility()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
  v_row record;
  v_profile_id uuid;
  v_recruit_name text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  for v_row in
    select r.id, r.referred_user_id
    from public.referrals r
    where r.referrer_user_id = v_user_id
      and r.vip_paid_at is not null
      and r.vip_eligible_at is not null
      and r.vip_eligible_at <= now()
      and r.vip_rewarded_at is null
      and not exists (
        select 1 from public.player_inbox pi
        where pi.user_id = v_user_id
          and pi.metadata->>'referral_id' = r.id::text
          and pi.metadata->>'event' = 'referral_vip_ready'
      )
  loop
    select p.id into v_profile_id
    from public.profiles p
    where p.user_id = v_user_id and coalesce(p.is_active, true)
    order by p.last_active_at desc nulls last, p.created_at asc limit 1;

    select coalesce(p.display_name, p.username, p.name, 'Your recruit') into v_recruit_name
    from public.profiles p
    where p.user_id = v_row.referred_user_id and coalesce(p.is_active, true)
    order by p.created_at asc limit 1;

    insert into public.player_inbox(
      user_id, profile_id, category, priority, title, message, metadata,
      action_type, action_data, related_entity_type, related_entity_id
    ) values (
      v_user_id, v_profile_id, 'social'::public.inbox_category, 'normal'::public.inbox_priority,
      'VIP referral reward ready',
      coalesce(v_recruit_name, 'Your recruit') || ' became a paid VIP member and the 7-day hold has completed. Your VIP referral reward is ready to claim.',
      jsonb_build_object('event','referral_vip_ready','referral_id',v_row.id,'referred_user_id',v_row.referred_user_id),
      'navigate', jsonb_build_object('route','/social/referrals'),
      'referral', v_row.id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.refresh_referral_vip_eligibility() from public, anon;
grant execute on function public.refresh_referral_vip_eligibility() to authenticated;

-- Preserve the character-safe read-only dashboard semantics from the correctness pass.
create or replace function public.get_referral_dashboard(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_result jsonb;
  v_qualified integer := 0;
  v_pending_milestones integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id=p_profile_id and user_id=v_user_id and coalesce(is_active,true)) then raise exception 'Invalid profile'; end if;

  perform public.refresh_referral_qualification();
  perform public.refresh_referral_vip_eligibility();
  v_code := public._ensure_referral_code(v_user_id);

  select count(*)::int into v_qualified from public.referrals where referrer_user_id=v_user_id and signup_qualified_at is not null;
  select count(*)::int into v_pending_milestones
  from (values (5),(10),(25)) as m(threshold)
  where v_qualified >= m.threshold
    and not exists (
      select 1 from public.reward_grants rg
      where rg.beneficiary_user_id=v_user_id
        and rg.idempotency_key='referral-milestone:'||v_user_id::text||':'||m.threshold::text
    );

  select jsonb_build_object(
    'code',v_code,
    'stats',jsonb_build_object(
      'joined',count(*)::int,
      'qualified',count(*) filter(where signup_qualified_at is not null)::int,
      'signup_rewarded',count(*) filter(where signup_rewarded_at is not null)::int,
      'vip_paid',count(*) filter(where vip_paid_at is not null)::int,
      'vip_rewarded',count(*) filter(where vip_rewarded_at is not null)::int
    ),
    'pending',jsonb_build_object(
      'signup',count(*) filter(where signup_qualified_at is not null and signup_rewarded_at is null)::int,
      'vip',count(*) filter(where vip_eligible_at <= now() and vip_rewarded_at is null)::int,
      'milestones',v_pending_milestones
    ),
    'rewards',(select coalesce(jsonb_object_agg(reward_key,jsonb_build_object('xp',xp_amount,'ap',ap_amount,'cash',cash_amount,'player_fame',player_fame_amount,'band_fame',band_fame_amount)),'{}'::jsonb) from public.reward_config where enabled=true),
    'discord',coalesce((select jsonb_build_object('verified',status='verified','rewarded',rewarded_at is not null,'verified_at',verified_at) from public.community_verifications where user_id=v_user_id and platform='discord'),jsonb_build_object('verified',false,'rewarded',false))
  ) into v_result
  from public.referrals where referrer_user_id=v_user_id;
  return v_result;
end;
$$;

revoke all on function public.get_referral_dashboard(uuid) from public, anon;
grant execute on function public.get_referral_dashboard(uuid) to authenticated;
