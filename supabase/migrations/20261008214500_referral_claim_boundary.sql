-- Keep referral claim/read RPCs aligned with canonical living-character and qualification rules.

create or replace function public.claim_referral_rewards(p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_referral record;
  v_verification_id uuid;
  v_signup_count integer := 0;
  v_vip_count integer := 0;
  v_discord_count integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.profiles
    where id=p_profile_id and user_id=v_user_id and coalesce(is_active,true) and died_at is null
  ) then raise exception 'Invalid living active profile'; end if;

  -- One canonical qualification implementation: includes confirmation, age,
  -- progression, active/living recruit rules, and notifications.
  perform public.refresh_referral_qualification();

  for v_referral in
    select id from public.referrals
    where referrer_user_id=v_user_id
      and signup_qualified_at is not null
      and signup_rewarded_at is null
    order by signup_qualified_at
    for update
  loop
    if public._apply_game_reward(
      v_user_id,p_profile_id,'referral_signup',
      'referral:'||v_referral.id::text||':signup',v_referral.id,
      jsonb_build_object('source','qualified_referral')
    ) then
      update public.referrals set signup_rewarded_at=now() where id=v_referral.id;
      v_signup_count:=v_signup_count+1;
    end if;
  end loop;

  for v_referral in
    select id from public.referrals
    where referrer_user_id=v_user_id
      and vip_paid_at is not null
      and vip_eligible_at is not null
      and vip_eligible_at<=now()
      and vip_rewarded_at is null
    order by vip_eligible_at
    for update
  loop
    if public._apply_game_reward(
      v_user_id,p_profile_id,'referral_vip',
      'referral:'||v_referral.id::text||':vip',v_referral.id,
      jsonb_build_object('source','paid_vip_referral')
    ) then
      update public.referrals set vip_rewarded_at=now() where id=v_referral.id;
      v_vip_count:=v_vip_count+1;
    end if;
  end loop;

  select id into v_verification_id
  from public.community_verifications
  where user_id=v_user_id and platform='discord' and status='verified' and rewarded_at is null
  for update;

  if v_verification_id is not null then
    if public._apply_game_reward(
      v_user_id,p_profile_id,'discord_verified',
      'discord:'||v_user_id::text,null,
      jsonb_build_object('source','discord_membership')
    ) then
      update public.community_verifications set rewarded_at=now() where id=v_verification_id;
      v_discord_count:=1;
    end if;
  end if;

  return jsonb_build_object(
    'claimed',jsonb_build_object('signup',v_signup_count,'vip',v_vip_count,'discord',v_discord_count)
  );
end;
$$;
revoke all on function public.claim_referral_rewards(uuid) from public,anon;
grant execute on function public.claim_referral_rewards(uuid) to authenticated;

create or replace function public.claim_referral_milestones(p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_qualified integer:=0;
  v_claimed text[]:='{}';
  v_rewarded boolean;
  v_owner_profile_id uuid;
  v_threshold integer;
  v_reward_key text;
  v_idempotency_key text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.profiles
    where id=p_profile_id and user_id=v_user_id and coalesce(is_active,true) and died_at is null
  ) then raise exception 'Invalid living active profile'; end if;

  select count(*)::int into v_qualified
  from public.referrals
  where referrer_user_id=v_user_id and signup_qualified_at is not null;

  foreach v_threshold in array array[5,10,25]
  loop
    if v_qualified<v_threshold then continue; end if;
    v_reward_key:='referral_milestone_'||v_threshold::text;
    v_idempotency_key:='referral-milestone:'||v_user_id::text||':'||v_threshold::text;

    v_rewarded:=public._apply_game_reward(
      v_user_id,p_profile_id,v_reward_key,v_idempotency_key,null,
      jsonb_build_object('qualified',v_qualified)
    );

    select rg.beneficiary_profile_id into v_owner_profile_id
    from public.reward_grants rg
    where rg.beneficiary_user_id=v_user_id and rg.idempotency_key=v_idempotency_key
    limit 1;

    if v_owner_profile_id is not null then
      perform public._grant_referral_promoter_prestige(v_owner_profile_id,v_threshold);
    end if;
    if v_rewarded then v_claimed:=array_append(v_claimed,v_threshold::text); end if;
  end loop;

  return jsonb_build_object('qualified',v_qualified,'claimed',to_jsonb(v_claimed),'profile_id',p_profile_id);
end;
$$;
revoke all on function public.claim_referral_milestones(uuid) from public,anon;
grant execute on function public.claim_referral_milestones(uuid) to authenticated;

create or replace function public.get_referral_dashboard(p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_code text;
  v_result jsonb;
  v_qualified integer:=0;
  v_pending_milestones integer:=0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.profiles
    where id=p_profile_id and user_id=v_user_id and coalesce(is_active,true) and died_at is null
  ) then raise exception 'Invalid living active profile'; end if;

  perform public.refresh_referral_qualification();
  perform public.refresh_referral_vip_eligibility();
  v_code:=public._ensure_referral_code(v_user_id);

  select count(*)::int into v_qualified
  from public.referrals where referrer_user_id=v_user_id and signup_qualified_at is not null;

  select count(*)::int into v_pending_milestones
  from (values(5),(10),(25)) as m(threshold)
  where v_qualified>=m.threshold
    and not exists(
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
      'vip',count(*) filter(where vip_eligible_at<=now() and vip_rewarded_at is null)::int,
      'milestones',v_pending_milestones
    ),
    'rewards',(select coalesce(jsonb_object_agg(reward_key,jsonb_build_object(
      'xp',xp_amount,'ap',ap_amount,'cash',cash_amount,'player_fame',player_fame_amount,'band_fame',band_fame_amount
    )),'{}'::jsonb) from public.reward_config where enabled=true),
    'discord',coalesce((
      select jsonb_build_object('verified',status='verified','rewarded',rewarded_at is not null,'verified_at',verified_at)
      from public.community_verifications where user_id=v_user_id and platform='discord'
    ),jsonb_build_object('verified',false,'rewarded',false))
  ) into v_result
  from public.referrals where referrer_user_id=v_user_id;

  return v_result;
end;
$$;
revoke all on function public.get_referral_dashboard(uuid) from public,anon;
grant execute on function public.get_referral_dashboard(uuid) to authenticated;
