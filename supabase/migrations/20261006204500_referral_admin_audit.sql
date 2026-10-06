-- Read-only referral operations dashboard for admins.
create or replace function public.admin_get_referral_audit(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_result jsonb;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total_referrals', (select count(*)::int from public.referrals),
      'qualified', (select count(*)::int from public.referrals where signup_qualified_at is not null),
      'signup_rewarded', (select count(*)::int from public.referrals where signup_rewarded_at is not null),
      'vip_paid', (select count(*)::int from public.referrals where vip_paid_at is not null),
      'vip_rewarded', (select count(*)::int from public.referrals where vip_rewarded_at is not null),
      'last_24h', (select count(*)::int from public.referrals where bound_at >= now() - interval '24 hours'),
      'last_7d', (select count(*)::int from public.referrals where bound_at >= now() - interval '7 days'),
      'qualification_rate', (
        select case when count(*) = 0 then 0
          else round((count(*) filter (where signup_qualified_at is not null))::numeric * 100 / count(*), 1)
        end
        from public.referrals
      ),
      'vip_conversion_rate', (
        select case when count(*) = 0 then 0
          else round((count(*) filter (where vip_paid_at is not null))::numeric * 100 / count(*), 1)
        end
        from public.referrals
      )
    ),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.bound_at desc)
      from (
        select
          r.id,
          r.referral_code,
          r.bound_at,
          r.signup_qualified_at,
          r.signup_rewarded_at,
          r.vip_paid_at,
          r.vip_eligible_at,
          r.vip_rewarded_at,
          coalesce(r.metadata->>'source', 'unknown') as source,
          referrer.id as referrer_profile_id,
          referrer.name as referrer_name,
          referred.id as referred_profile_id,
          referred.name as referred_name
        from public.referrals r
        left join lateral (
          select p.id, p.name
          from public.profiles p
          where p.user_id = r.referrer_user_id and coalesce(p.is_active, true)
          order by p.created_at asc
          limit 1
        ) referrer on true
        left join lateral (
          select p.id, p.name
          from public.profiles p
          where p.user_id = r.referred_user_id and coalesce(p.is_active, true)
          order by p.created_at asc
          limit 1
        ) referred on true
        order by r.bound_at desc
        limit v_limit
      ) x
    ), '[]'::jsonb),
    'recent_rewards', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.granted_at desc)
      from (
        select
          rg.id,
          rg.reward_key,
          rg.beneficiary_profile_id,
          p.name as beneficiary_name,
          rg.referral_id,
          rg.xp_amount,
          rg.ap_amount,
          rg.cash_amount,
          rg.player_fame_amount,
          rg.band_fame_amount,
          rg.granted_at
        from public.reward_grants rg
        left join public.profiles p on p.id = rg.beneficiary_profile_id
        where rg.reward_key like 'referral_%'
        order by rg.granted_at desc
        limit v_limit
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_get_referral_audit(integer) from public, anon, authenticated;
grant execute on function public.admin_get_referral_audit(integer) to authenticated;
