-- Referral correctness pass.
-- Restores promoter-aware milestone claiming after the earlier V2 migration,
-- stops read-only dashboard loads from choosing a character for account-earned rewards,
-- and exposes milestone claims as explicitly pending for the selected character.

create or replace function public.claim_referral_milestones(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_qualified integer := 0;
  v_claimed text[] := '{}';
  v_rewarded boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and user_id = v_user_id and coalesce(is_active, true)
  ) then raise exception 'Invalid profile'; end if;

  select count(*)::int into v_qualified
  from public.referrals
  where referrer_user_id = v_user_id and signup_qualified_at is not null;

  if v_qualified >= 5 then
    v_rewarded := public._apply_game_reward(v_user_id, p_profile_id, 'referral_milestone_5', 'referral-milestone:' || v_user_id::text || ':5', null, jsonb_build_object('qualified', v_qualified));
    perform public._grant_referral_promoter_prestige(p_profile_id, 5);
    if v_rewarded then v_claimed := array_append(v_claimed, '5'); end if;
  end if;
  if v_qualified >= 10 then
    v_rewarded := public._apply_game_reward(v_user_id, p_profile_id, 'referral_milestone_10', 'referral-milestone:' || v_user_id::text || ':10', null, jsonb_build_object('qualified', v_qualified));
    perform public._grant_referral_promoter_prestige(p_profile_id, 10);
    if v_rewarded then v_claimed := array_append(v_claimed, '10'); end if;
  end if;
  if v_qualified >= 25 then
    v_rewarded := public._apply_game_reward(v_user_id, p_profile_id, 'referral_milestone_25', 'referral-milestone:' || v_user_id::text || ':25', null, jsonb_build_object('qualified', v_qualified));
    perform public._grant_referral_promoter_prestige(p_profile_id, 25);
    if v_rewarded then v_claimed := array_append(v_claimed, '25'); end if;
  end if;

  return jsonb_build_object('qualified', v_qualified, 'claimed', to_jsonb(v_claimed));
end;
$$;

revoke all on function public.claim_referral_milestones(uuid) from public, anon;
grant execute on function public.claim_referral_milestones(uuid) to authenticated;

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
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and user_id = v_user_id and coalesce(is_active, true)
  ) then raise exception 'Invalid profile'; end if;

  perform public.refresh_referral_qualification();
  v_code := public._ensure_referral_code(v_user_id);

  select count(*)::int into v_qualified
  from public.referrals
  where referrer_user_id = v_user_id and signup_qualified_at is not null;

  select count(*)::int into v_pending_milestones
  from (values (5), (10), (25)) as m(threshold)
  where v_qualified >= m.threshold
    and not exists (
      select 1 from public.reward_grants rg
      where rg.beneficiary_user_id = v_user_id
        and rg.idempotency_key = 'referral-milestone:' || v_user_id::text || ':' || m.threshold::text
    );

  select jsonb_build_object(
    'code', v_code,
    'stats', jsonb_build_object(
      'joined', count(*)::int,
      'qualified', count(*) filter (where signup_qualified_at is not null)::int,
      'signup_rewarded', count(*) filter (where signup_rewarded_at is not null)::int,
      'vip_paid', count(*) filter (where vip_paid_at is not null)::int,
      'vip_rewarded', count(*) filter (where vip_rewarded_at is not null)::int
    ),
    'pending', jsonb_build_object(
      'signup', count(*) filter (where signup_qualified_at is not null and signup_rewarded_at is null)::int,
      'vip', count(*) filter (where vip_eligible_at <= now() and vip_rewarded_at is null)::int,
      'milestones', v_pending_milestones
    ),
    'rewards', (
      select coalesce(jsonb_object_agg(reward_key, jsonb_build_object(
        'xp', xp_amount, 'ap', ap_amount, 'cash', cash_amount,
        'player_fame', player_fame_amount, 'band_fame', band_fame_amount
      )), '{}'::jsonb)
      from public.reward_config where enabled = true
    ),
    'discord', coalesce((
      select jsonb_build_object('verified', status = 'verified', 'rewarded', rewarded_at is not null, 'verified_at', verified_at)
      from public.community_verifications where user_id = v_user_id and platform = 'discord'
    ), jsonb_build_object('verified', false, 'rewarded', false))
  ) into v_result
  from public.referrals where referrer_user_id = v_user_id;

  return v_result;
end;
$$;

revoke all on function public.get_referral_dashboard(uuid) from public, anon;
grant execute on function public.get_referral_dashboard(uuid) to authenticated;
