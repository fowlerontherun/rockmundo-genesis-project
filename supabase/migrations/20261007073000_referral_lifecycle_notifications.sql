-- Referral lifecycle notifications: joined, close to qualification, and safe VIP-ready delivery.
create or replace function public.capture_referral_from_signup()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_code text; v_referrer uuid; v_band_id uuid; v_source text; v_referral_id uuid; v_referrer_profile uuid;
begin
 v_code:=upper(trim(coalesce(new.raw_user_meta_data->>'referral_code',''))); if v_code='' then return new; end if;
 select user_id into v_referrer from public.referral_codes where code=v_code; if v_referrer is null or v_referrer=new.id then return new; end if;
 v_source:=lower(trim(coalesce(new.raw_user_meta_data->>'referral_source','signup_metadata'))); if v_source !~ '^[a-z0-9_]{2,40}$' then v_source:='signup_metadata'; end if;
 begin v_band_id:=nullif(new.raw_user_meta_data->>'referral_band_id','')::uuid; exception when invalid_text_representation then v_band_id:=null; end;
 if v_band_id is not null and not exists(select 1 from public.band_members bm join public.profiles p on p.id=bm.profile_id where bm.band_id=v_band_id and p.user_id=v_referrer and coalesce(bm.member_status,'active')='active' and coalesce(bm.is_touring_member,false)=false) then v_band_id:=null; end if;
 insert into public.referrals(referrer_user_id,referred_user_id,referral_code,metadata) values(v_referrer,new.id,v_code,jsonb_strip_nulls(jsonb_build_object('source',v_source,'band_id',v_band_id))) on conflict(referred_user_id) do nothing returning id into v_referral_id;
 if v_referral_id is not null then
  select id into v_referrer_profile from public.profiles where user_id=v_referrer and coalesce(is_active,true) order by last_active_at desc nulls last,created_at asc limit 1;
  insert into public.player_inbox(user_id,category,priority,title,message,metadata,action_type,action_data,related_entity_type,related_entity_id)
  values(v_referrer,'social'::public.inbox_category,'normal'::public.inbox_priority,'A new recruit joined RockMundo','Someone joined through your RockMundo invite. Help them get started while they work toward referral qualification.',jsonb_build_object('event','referral_joined','referral_id',v_referral_id,'referred_user_id',new.id,'profile_id',v_referrer_profile,'scope','character'),'navigate',jsonb_build_object('route','/social/referrals'),'referral',v_referral_id);
 end if;
 return new;
end; $$;

create or replace function public.refresh_referral_progress_notifications()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_count integer:=0; v_row record; v_profile_id uuid; v_name text;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 select id into v_profile_id from public.profiles where user_id=v_user_id and coalesce(is_active,true) order by last_active_at desc nulls last,created_at asc limit 1;
 for v_row in
  select r.id,r.referred_user_id from public.referrals r join auth.users au on au.id=r.referred_user_id
  where r.referrer_user_id=v_user_id and r.signup_qualified_at is null
  and ((case when au.email_confirmed_at is not null then 1 else 0 end)+(case when au.created_at<=now()-interval '24 hours' then 1 else 0 end)+(case when exists(select 1 from public.profiles p where p.user_id=r.referred_user_id and coalesce(p.is_active,true) and (coalesce(p.total_hours_played,0)>=1 or coalesce(p.experience,0)>=100 or coalesce(p.level,1)>=2)) then 1 else 0 end))=2
  and not exists(select 1 from public.player_inbox pi where pi.user_id=v_user_id and pi.metadata->>'referral_id'=r.id::text and pi.metadata->>'event'='referral_close_to_qualifying')
 loop
  select coalesce(display_name,username,name,'Your recruit') into v_name from public.profiles where user_id=v_row.referred_user_id and coalesce(is_active,true) order by created_at asc limit 1;
  insert into public.player_inbox(user_id,category,priority,title,message,metadata,action_type,action_data,related_entity_type,related_entity_id)
  values(v_user_id,'social'::public.inbox_category,'normal'::public.inbox_priority,'Your recruit is close to qualifying',coalesce(v_name,'Your recruit')||' has completed two of the three referral activation requirements.',jsonb_build_object('event','referral_close_to_qualifying','referral_id',v_row.id,'referred_user_id',v_row.referred_user_id,'profile_id',v_profile_id,'scope','character'),'navigate',jsonb_build_object('route','/social/referrals'),'referral',v_row.id);
  v_count:=v_count+1;
 end loop; return v_count;
end; $$;
revoke all on function public.refresh_referral_progress_notifications() from public,anon,authenticated;
grant execute on function public.refresh_referral_progress_notifications() to authenticated;

create or replace function public.refresh_referral_vip_eligibility()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_count integer:=0; v_row record; v_profile_id uuid; v_recruit_name text;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 select id into v_profile_id from public.profiles where user_id=v_user_id and coalesce(is_active,true) order by last_active_at desc nulls last,created_at asc limit 1;
 for v_row in select r.id,r.referred_user_id from public.referrals r where r.referrer_user_id=v_user_id and r.vip_paid_at is not null and r.vip_eligible_at is not null and r.vip_eligible_at<=now() and r.vip_rewarded_at is null and not exists(select 1 from public.player_inbox pi where pi.user_id=v_user_id and pi.metadata->>'referral_id'=r.id::text and pi.metadata->>'event'='referral_vip_ready')
 loop
  select coalesce(display_name,username,name,'Your recruit') into v_recruit_name from public.profiles where user_id=v_row.referred_user_id and coalesce(is_active,true) order by created_at asc limit 1;
  insert into public.player_inbox(user_id,category,priority,title,message,metadata,action_type,action_data,related_entity_type,related_entity_id)
  values(v_user_id,'social'::public.inbox_category,'normal'::public.inbox_priority,'VIP referral reward ready',coalesce(v_recruit_name,'Your recruit')||' became a paid VIP member and the 7-day hold has completed. Your VIP referral reward is ready to claim.',jsonb_build_object('event','referral_vip_ready','referral_id',v_row.id,'referred_user_id',v_row.referred_user_id,'profile_id',v_profile_id,'scope','character'),'navigate',jsonb_build_object('route','/social/referrals'),'referral',v_row.id);
  v_count:=v_count+1;
 end loop; return v_count;
end; $$;
revoke all on function public.refresh_referral_vip_eligibility() from public,anon,authenticated;
grant execute on function public.refresh_referral_vip_eligibility() to authenticated;