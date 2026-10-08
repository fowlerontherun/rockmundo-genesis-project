-- Campaign attribution is descriptive analytics only. It never affects rewards or authorization.
create or replace function public.attach_my_referral_campaign(p_campaign text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_campaign text:=lower(trim(coalesce(p_campaign,''))); v_referral public.referrals%rowtype; v_existing text;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if v_campaign !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then raise exception 'Invalid referral campaign'; end if;
 select * into v_referral from public.referrals where referred_user_id=v_user_id for update;
 if not found then raise exception 'No referral is linked to this account'; end if;
 v_existing:=nullif(v_referral.metadata->>'campaign','');
 if v_existing is not null then
  if v_existing=v_campaign then return jsonb_build_object('attached',true,'already_attached',true,'campaign',v_campaign); end if;
  raise exception 'Referral campaign attribution is already fixed';
 end if;
 if v_referral.bound_at<now()-interval '30 days' then raise exception 'Referral campaign attribution window has expired'; end if;
 update public.referrals set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('campaign',v_campaign) where id=v_referral.id;
 return jsonb_build_object('attached',true,'already_attached',false,'campaign',v_campaign);
end; $$;
revoke all on function public.attach_my_referral_campaign(text) from public,anon,authenticated;
grant execute on function public.attach_my_referral_campaign(text) to authenticated;

create or replace function public.capture_referral_from_signup()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_code text; v_referrer uuid; v_band_id uuid; v_source text; v_campaign text;
begin
 v_code:=upper(trim(coalesce(new.raw_user_meta_data->>'referral_code','')));
 if v_code='' then return new; end if;
 select user_id into v_referrer from public.referral_codes where code=v_code;
 if v_referrer is null or v_referrer=new.id then return new; end if;
 v_source:=lower(trim(coalesce(new.raw_user_meta_data->>'referral_source','signup_metadata')));
 if v_source !~ '^[a-z0-9_]{2,40}$' then v_source:='signup_metadata'; end if;
 v_campaign:=lower(trim(coalesce(new.raw_user_meta_data->>'referral_campaign','')));
 if v_campaign !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then v_campaign:=null; end if;
 begin v_band_id:=nullif(new.raw_user_meta_data->>'referral_band_id','')::uuid; exception when invalid_text_representation then v_band_id:=null; end;
 if v_band_id is not null and not exists(
  select 1 from public.band_members bm join public.profiles p on p.id=bm.profile_id
  where bm.band_id=v_band_id and p.user_id=v_referrer and coalesce(bm.member_status,'active')='active' and coalesce(bm.is_touring_member,false)=false
 ) then v_band_id:=null; end if;
 insert into public.referrals(referrer_user_id,referred_user_id,referral_code,metadata)
 values(v_referrer,new.id,v_code,jsonb_strip_nulls(jsonb_build_object('source',v_source,'band_id',v_band_id,'campaign',v_campaign)))
 on conflict(referred_user_id) do nothing;
 return new;
end; $$;

create or replace function public.admin_get_referral_growth_analytics()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if;
 with base0 as (
  select r.*,coalesce(nullif(r.metadata->>'source',''),'unknown') source,nullif(r.metadata->>'campaign','') campaign,
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
 ), campaigns as (
  select campaign,source,count(*)::int joined,count(*) filter(where signup_qualified_at is not null)::int qualified,count(*) filter(where vip_paid_at is not null)::int vip,
   case when count(*)=0 then 0 else round(count(*) filter(where signup_qualified_at is not null)::numeric*100/count(*),1) end qualification_rate,
   case when count(*)=0 then 0 else round(count(*) filter(where vip_paid_at is not null)::numeric*100/count(*),1) end vip_rate
  from base where campaign is not null group by campaign,source
 ), trends as (
  select count(*) filter(where bound_at>=now()-interval '7 days')::int joins_7d,
   count(*) filter(where bound_at>=now()-interval '14 days' and bound_at<now()-interval '7 days')::int joins_prev_7d,
   count(*) filter(where signup_qualified_at>=now()-interval '7 days')::int qualified_7d,
   count(*) filter(where signup_qualified_at>=now()-interval '14 days' and signup_qualified_at<now()-interval '7 days')::int qualified_prev_7d,
   count(*) filter(where intended_band_joined_at>=now()-interval '7 days')::int band_joins_7d,
   count(*) filter(where intended_band_joined_at>=now()-interval '14 days' and intended_band_joined_at<now()-interval '7 days')::int band_joins_prev_7d from base
 ), speed as (
  select round((percentile_cont(0.5) within group(order by extract(epoch from(signup_qualified_at-bound_at))/3600) filter(where signup_qualified_at is not null and signup_qualified_at>=bound_at))::numeric,1) median_qualification_hours,
   round((percentile_cont(0.5) within group(order by extract(epoch from(intended_band_joined_at-bound_at))/3600) filter(where intended_band_joined_at is not null and intended_band_joined_at>=bound_at))::numeric,1) median_band_join_hours from base
 )
 select jsonb_build_object(
  'funnel',jsonb_build_object('joined',count(*)::int,'qualified',count(*) filter(where signup_qualified_at is not null)::int,'vip',count(*) filter(where vip_paid_at is not null)::int,'activating',count(*) filter(where signup_qualified_at is null)::int),
  'dropoff',jsonb_build_object('missing_email',count(*) filter(where signup_qualified_at is null and not email_met)::int,'waiting_24h',count(*) filter(where signup_qualified_at is null and not age_met)::int,'missing_activity',count(*) filter(where signup_qualified_at is null and not activity_met)::int),
  'band',jsonb_build_object('joined',count(*) filter(where band_recruit)::int,'qualified',count(*) filter(where band_recruit and signup_qualified_at is not null)::int,'band_members',count(*) filter(where band_recruit and intended_band_joined_at is not null)::int,'vip',count(*) filter(where band_recruit and vip_paid_at is not null)::int,'qualification_rate',case when count(*) filter(where band_recruit)=0 then 0 else round(count(*) filter(where band_recruit and signup_qualified_at is not null)::numeric*100/(count(*) filter(where band_recruit)),1) end,'band_join_rate',case when count(*) filter(where band_recruit)=0 then 0 else round(count(*) filter(where band_recruit and intended_band_joined_at is not null)::numeric*100/(count(*) filter(where band_recruit)),1) end),
  'trends',(select to_jsonb(t) from trends t),'speed',(select to_jsonb(s) from speed s),
  'sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.joined desc,s.source) from sources s),'[]'::jsonb),
  'campaigns',coalesce((select jsonb_agg(to_jsonb(c) order by c.joined desc,c.campaign,c.source) from campaigns c),'[]'::jsonb)
 ) into v_result from base;
 return v_result;
end; $$;
revoke all on function public.admin_get_referral_growth_analytics() from public,anon,authenticated;
grant execute on function public.admin_get_referral_growth_analytics() to authenticated;