create or replace function public.claim_referral_rewards(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_referral record;
  v_verification_id uuid;
  v_signup_count integer := 0;
  v_vip_count integer := 0;
  v_discord_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1 from public.profiles where id = p_profile_id and user_id = v_user_id and coalesce(is_active, true)
  ) then
    raise exception 'Invalid profile';
  end if;

  update public.referrals r
  set signup_qualified_at = now()
  where r.referrer_user_id = v_user_id
    and r.signup_qualified_at is null
    and exists (
      select 1
      from auth.users au
      where au.id = r.referred_user_id
        and au.email_confirmed_at is not null
        and au.created_at <= now() - interval '24 hours'
    )
    and exists (
      select 1
      from public.profiles p
      where p.user_id = r.referred_user_id
        and coalesce(p.is_active, true)
        and (
          coalesce(p.total_hours_played, 0) >= 1
          or coalesce(p.experience, 0) >= 100
          or coalesce(p.level, 1) >= 2
        )
    );

  for v_referral in
    select id from public.referrals
    where referrer_user_id = v_user_id
      and signup_qualified_at is not null
      and signup_rewarded_at is null
    order by signup_qualified_at
    for update
  loop
    if public._apply_game_reward(
      v_user_id, p_profile_id, 'referral_signup',
      'referral:' || v_referral.id::text || ':signup', v_referral.id,
      jsonb_build_object('source', 'qualified_referral')
    ) then
      update public.referrals set signup_rewarded_at = now() where id = v_referral.id;
      v_signup_count := v_signup_count + 1;
    end if;
  end loop;

  for v_referral in
    select id from public.referrals
    where referrer_user_id = v_user_id
      and vip_eligible_at is not null
      and vip_eligible_at <= now()
      and vip_rewarded_at is null
    order by vip_eligible_at
    for update
  loop
    if public._apply_game_reward(
      v_user_id, p_profile_id, 'referral_vip',
      'referral:' || v_referral.id::text || ':vip', v_referral.id,
      jsonb_build_object('source', 'paid_vip_referral')
    ) then
      update public.referrals set vip_rewarded_at = now() where id = v_referral.id;
      v_vip_count := v_vip_count + 1;
    end if;
  end loop;

  select id into v_verification_id
  from public.community_verifications
  where user_id = v_user_id and platform = 'discord' and status = 'verified' and rewarded_at is null
  for update;

  if v_verification_id is not null then
    if public._apply_game_reward(
      v_user_id, p_profile_id, 'discord_verified',
      'discord:' || v_user_id::text, null,
      jsonb_build_object('source', 'discord_membership')
    ) then
      update public.community_verifications set rewarded_at = now() where id = v_verification_id;
      v_discord_count := 1;
    end if;
  end if;

  return jsonb_build_object(
    'claimed', jsonb_build_object('signup', v_signup_count, 'vip', v_vip_count, 'discord', v_discord_count)
  );
end;
$$;

revoke all on function public.claim_referral_rewards(uuid) from public, anon;
grant execute on function public.claim_referral_rewards(uuid) to authenticated;
