create or replace function public.admin_get_referral_growth_analytics()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if;
 with base0 as (
  select r.*,coalesce(nullif(r.metadata->>'source',''),'unknown') source,
   au.email_confirmed_at is not null email_met,au.created_at<=now()-interval '24 hours' age_met,
   exists(select 1 from public.profiles p where p.user_id=r.referred_user_id and coalesce(p.is_active,true) and (coalesce(p.total_hours_played,0)>=1 or coalesce(p.experience,0)>=100 or coalesce(p.level,1)>=2)) activity_met,
   case when coalesce(r.metadata->>'band_id','')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (r.metadata->>'band_id')::uuid end intended_band_id
  from public.referrals r join auth.users au on au.id=r.referred_user_id
 ), base as (
  select b.*,b.intended_band_id is not null band_recruit,
   (select min(bm.joined_at) from public.band_members bm where bm.band_id=b.intended_band_id and bm.user_id=b.referred_user_id and bm.member_status='active' and coalesce(bm.is_touring_member,false)=false) intended_band_joined_at
  from base0 b
 ), sources as (
  select source,count(*)::int joined,count(*) filter(where signup_qualified_at is not null)::int qualified,count(*) filter(where vip_paid_at is not null)::int vip,count(*) filter(where signup_qualified_at is null)::int activating,
   count(*) filter(where signup_qualified_at is null and not email_met)::int missing_email,count(*) filter(where signup_qualified_at is null and not age_met)::int waiting_24h,count(*) filter(where signup_qualified_at is null and not activity_met)::int missing_activity,
   count(*) filter(where intended_band_joined_at is not null)::int band_joined,
   case when count(*)=0 then 0 else round(count(*) filter(where signup_qualified_at is not null)::numeric*100/count(*),1) end qualification_rate,
   case when count(*)=0 then 0 else round(count(*) filter(where vip_paid_at is not null)::numeric*100/count(*),1) end vip_rate
  from base group by source
 ), trends as (
  select
   count(*) filter(where bound_at>=now()-interval '7 days')::int joins_7d,
   count(*) filter(where bound_at>=now()-interval '14 days' and bound_at<now()-interval '7 days')::int joins_prev_7d,
   count(*) filter(where signup_qualified_at>=now()-interval '7 days')::int qualified_7d,
   count(*) filter(where signup_qualified_at>=now()-interval '14 days' and signup_qualified_at<now()-interval '7 days')::int qualified_prev_7d,
   count(*) filter(where intended_band_joined_at>=now()-interval '7 days')::int band_joins_7d,
   count(*) filter(where intended_band_joined_at>=now()-interval '14 days' and intended_band_joined_at<now()-interval '7 days')::int band_joins_prev_7d
  from base
 ), speed as (
  select
   round((percentile_cont(0.5) within group(order by extract(epoch from(signup_qualified_at-bound_at))/3600) filter(where signup_qualified_at is not null and signup_qualified_at>=bound_at))::numeric,1) median_qualification_hours,
   round((percentile_cont(0.5) within group(order by extract(epoch from(intended_band_joined_at-bound_at))/3600) filter(where intended_band_joined_at is not null and intended_band_joined_at>=bound_at))::numeric,1) median_band_join_hours
  from base
 )
 select jsonb_build_object(
  'funnel',jsonb_build_object('joined',count(*)::int,'qualified',count(*) filter(where signup_qualified_at is not null)::int,'vip',count(*) filter(where vip_paid_at is not null)::int,'activating',count(*) filter(where signup_qualified_at is null)::int),
  'dropoff',jsonb_build_object('missing_email',count(*) filter(where signup_qualified_at is null and not email_met)::int,'waiting_24h',count(*) filter(where signup_qualified_at is null and not age_met)::int,'missing_activity',count(*) filter(where signup_qualified_at is null and not activity_met)::int),
  'band',jsonb_build_object('joined',count(*) filter(where band_recruit)::int,'qualified',count(*) filter(where band_recruit and signup_qualified_at is not null)::int,'band_members',count(*) filter(where band_recruit and intended_band_joined_at is not null)::int,'vip',count(*) filter(where band_recruit and vip_paid_at is not null)::int,'qualification_rate',case when count(*) filter(where band_recruit)=0 then 0 else round(count(*) filter(where band_recruit and signup_qualified_at is not null)::numeric*100/(count(*) filter(where band_recruit)),1) end,'band_join_rate',case when count(*) filter(where band_recruit)=0 then 0 else round(count(*) filter(where band_recruit and intended_band_joined_at is not null)::numeric*100/(count(*) filter(where band_recruit)),1) end),
  'trends',(select to_jsonb(t) from trends t),'speed',(select to_jsonb(s) from speed s),
  'sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.joined desc,s.source) from sources s),'[]'::jsonb)
 ) into v_result from base;
 return v_result;
end; $$;
revoke all on function public.admin_get_referral_growth_analytics() from public,anon,authenticated;
grant execute on function public.admin_get_referral_growth_analytics() to authenticated;