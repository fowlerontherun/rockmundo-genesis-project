-- Keep referral progress fresh whenever the dashboard is opened.
-- Qualification remains based on the same anti-farm rules; this only removes the need
-- to press Claim before eligible recruits appear as qualified.

create or replace function public.refresh_referral_qualification()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  update public.referrals r
  set signup_qualified_at = now()
  where r.referrer_user_id = v_user_id
    and r.signup_qualified_at is null
    and exists (
      select 1 from auth.users au
      where au.id = r.referred_user_id
        and au.email_confirmed_at is not null
        and au.created_at <= now() - interval '24 hours'
    )
    and exists (
      select 1 from public.profiles p
      where p.user_id = r.referred_user_id
        and coalesce(p.is_active, true)
        and (
          coalesce(p.total_hours_played, 0) >= 1
          or coalesce(p.experience, 0) >= 100
          or coalesce(p.level, 1) >= 2
        )
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.refresh_referral_qualification() from public, anon;
grant execute on function public.refresh_referral_qualification() to authenticated;

create or replace function public.get_referral_dashboard(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and user_id = v_user_id) then raise exception 'Invalid profile'; end if;

  perform public.refresh_referral_qualification();
  -- Idempotent: also ensures earned promoter prestige is present even if a prior UI claim was missed.
  perform public.claim_referral_milestones(p_profile_id);

  v_code := public._ensure_referral_code(v_user_id);
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
      'vip', count(*) filter (where vip_eligible_at <= now() and vip_rewarded_at is null)::int
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
