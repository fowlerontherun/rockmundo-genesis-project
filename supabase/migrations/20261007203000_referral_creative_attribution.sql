-- Creative attribution is descriptive analytics only. It never affects referral rewards or authorization.
drop function if exists public.attach_my_referral_campaign(text);
create or replace function public.attach_my_referral_campaign(p_campaign text, p_creative text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_campaign text:=lower(trim(coalesce(p_campaign,''))); v_creative text:=lower(trim(coalesce(p_creative,''))); v_referral public.referrals%rowtype; v_existing text; v_existing_creative text;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if v_campaign !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then raise exception 'Invalid referral campaign'; end if;
 if v_creative<>'' and v_creative !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then raise exception 'Invalid referral creative'; end if;
 select * into v_referral from public.referrals where referred_user_id=v_user_id for update;
 if not found then raise exception 'No referral is linked to this account'; end if;
 v_existing:=nullif(v_referral.metadata->>'campaign',''); v_existing_creative:=nullif(v_referral.metadata->>'creative','');
 if v_existing is not null and v_existing<>v_campaign then raise exception 'Referral campaign attribution is already fixed'; end if;
 if v_existing_creative is not null and v_creative<>'' and v_existing_creative<>v_creative then raise exception 'Referral creative attribution is already fixed'; end if;
 if v_referral.bound_at<now()-interval '30 days' then raise exception 'Referral campaign attribution window has expired'; end if;
 update public.referrals set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object('campaign',v_campaign,'creative',nullif(v_creative,''))) where id=v_referral.id;
 return jsonb_build_object('attached',true,'already_attached',v_existing is not null,'campaign',v_campaign,'creative',nullif(v_creative,''));
end; $$;
revoke all on function public.attach_my_referral_campaign(text,text) from public,anon,authenticated;
grant execute on function public.attach_my_referral_campaign(text,text) to authenticated;

create or replace function public.capture_referral_from_signup()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_code text; v_referrer uuid; v_band_id uuid; v_source text; v_campaign text; v_creative text;
begin
 v_code:=upper(trim(coalesce(new.raw_user_meta_data->>'referral_code',''))); if v_code='' then return new; end if;
 select user_id into v_referrer from public.referral_codes where code=v_code; if v_referrer is null or v_referrer=new.id then return new; end if;
 v_source:=lower(trim(coalesce(new.raw_user_meta_data->>'referral_source','signup_metadata'))); if v_source !~ '^[a-z0-9_]{2,40}$' then v_source:='signup_metadata'; end if;
 v_campaign:=lower(trim(coalesce(new.raw_user_meta_data->>'referral_campaign',''))); if v_campaign !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then v_campaign:=null; end if;
 v_creative:=lower(trim(coalesce(new.raw_user_meta_data->>'referral_creative',''))); if v_creative !~ '^[a-z0-9][a-z0-9_-]{1,39}$' then v_creative:=null; end if;
 begin v_band_id:=nullif(new.raw_user_meta_data->>'referral_band_id','')::uuid; exception when invalid_text_representation then v_band_id:=null; end;
 if v_band_id is not null and not exists(select 1 from public.band_members bm join public.profiles p on p.id=bm.profile_id where bm.band_id=v_band_id and p.user_id=v_referrer and coalesce(bm.member_status,'active')='active' and coalesce(bm.is_touring_member,false)=false) then v_band_id:=null; end if;
 insert into public.referrals(referrer_user_id,referred_user_id,referral_code,metadata) values(v_referrer,new.id,v_code,jsonb_strip_nulls(jsonb_build_object('source',v_source,'band_id',v_band_id,'campaign',v_campaign,'creative',v_creative))) on conflict(referred_user_id) do nothing;
 return new;
end; $$;

create or replace function public.admin_get_referral_creative_analytics()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Admin access required'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.joined desc,x.campaign,x.creative),'[]'::jsonb) into v_result from (
  select nullif(r.metadata->>'campaign','') campaign,coalesce(nullif(r.metadata->>'source',''),'unknown') source,nullif(r.metadata->>'creative','') creative,
   count(*)::int joined,count(*) filter(where r.signup_qualified_at is not null)::int qualified,count(*) filter(where r.vip_paid_at is not null)::int vip,
   case when count(*)=0 then 0 else round(count(*) filter(where r.signup_qualified_at is not null)::numeric*100/count(*),1) end qualification_rate,
   case when count(*)=0 then 0 else round(count(*) filter(where r.vip_paid_at is not null)::numeric*100/count(*),1) end vip_rate
  from public.referrals r where nullif(r.metadata->>'creative','') is not null
  group by nullif(r.metadata->>'campaign',''),coalesce(nullif(r.metadata->>'source',''),'unknown'),nullif(r.metadata->>'creative','')
 ) x;
 return v_result;
end; $$;
revoke all on function public.admin_get_referral_creative_analytics() from public,anon,authenticated;
grant execute on function public.admin_get_referral_creative_analytics() to authenticated;