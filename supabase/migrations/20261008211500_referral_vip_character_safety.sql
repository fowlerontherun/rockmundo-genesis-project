-- Align VIP referral-ready notification routing with canonical living active-character resolution.
create or replace function public.refresh_referral_vip_eligibility()
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid:=auth.uid(); v_count integer:=0; v_row record; v_profile_id uuid; v_recruit_name text;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 select p.id into v_profile_id from public.profiles p
 where p.user_id=v_user_id and coalesce(p.is_active,true) and p.died_at is null
 order by p.updated_at desc nulls last,p.created_at desc nulls last,p.id asc limit 1;
 for v_row in select r.id,r.referred_user_id from public.referrals r
  where r.referrer_user_id=v_user_id and r.vip_paid_at is not null and r.vip_eligible_at is not null and r.vip_eligible_at<=now() and r.vip_rewarded_at is null
   and not exists(select 1 from public.player_inbox pi where pi.user_id=v_user_id and pi.metadata->>'referral_id'=r.id::text and pi.metadata->>'event'='referral_vip_ready')
 loop
  select coalesce(p.display_name,p.username,p.name,'Your recruit') into v_recruit_name from public.profiles p
  where p.user_id=v_row.referred_user_id and coalesce(p.is_active,true) and p.died_at is null
  order by p.updated_at desc nulls last,p.created_at desc nulls last,p.id asc limit 1;
  insert into public.player_inbox(user_id,profile_id,category,priority,title,message,metadata,action_type,action_data,related_entity_type,related_entity_id)
  values(v_user_id,v_profile_id,'social'::public.inbox_category,'normal'::public.inbox_priority,'VIP referral reward ready',coalesce(v_recruit_name,'Your recruit')||' became a paid VIP member and the 7-day hold has completed. Your VIP referral reward is ready to claim.',jsonb_build_object('event','referral_vip_ready','referral_id',v_row.id,'referred_user_id',v_row.referred_user_id,'profile_id',v_profile_id,'scope','character'),'navigate',jsonb_build_object('route','/social/referrals'),'referral',v_row.id);
  v_count:=v_count+1;
 end loop;
 return v_count;
end; $$;
revoke all on function public.refresh_referral_vip_eligibility() from public,anon;
grant execute on function public.refresh_referral_vip_eligibility() to authenticated;
