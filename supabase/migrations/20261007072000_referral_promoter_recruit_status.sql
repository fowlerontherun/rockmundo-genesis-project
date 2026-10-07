create or replace function public.get_my_referral_recruits(p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid:=auth.uid(); v_result jsonb;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.profiles where id=p_profile_id and user_id=v_user_id and coalesce(is_active,true)) then raise exception 'Invalid profile'; end if;
 perform public.refresh_referral_qualification();
 select coalesce(jsonb_agg(jsonb_build_object(
   'referral_id',r.id,'joined_at',r.bound_at,'qualified',r.signup_qualified_at is not null,
   'qualified_at',r.signup_qualified_at,'vip_paid',r.vip_paid_at is not null,
   'source',coalesce(nullif(r.metadata->>'source',''),'unknown'),
   'band',case when b.id is null then null else jsonb_build_object('band_id',b.id,'name',b.name) end,
   'recruit',jsonb_build_object('profile_id',rp.id,'name',coalesce(rp.display_name,rp.username,rp.name,'RockMundo recruit')),
   'progress',jsonb_build_object(
     'email_confirmed',au.email_confirmed_at is not null,
     'account_age_met',au.created_at<=now()-interval '24 hours',
     'activity_met',coalesce(rp.total_hours_played,0)>=1 or coalesce(rp.experience,0)>=100 or coalesce(rp.level,1)>=2,
     'steps_complete',(case when au.email_confirmed_at is not null then 1 else 0 end)+(case when au.created_at<=now()-interval '24 hours' then 1 else 0 end)+(case when coalesce(rp.total_hours_played,0)>=1 or coalesce(rp.experience,0)>=100 or coalesce(rp.level,1)>=2 then 1 else 0 end)
   )
 ) order by r.bound_at desc),'[]'::jsonb) into v_result
 from public.referrals r
 join auth.users au on au.id=r.referred_user_id
 left join lateral(select p.id,p.display_name,p.username,p.name,p.total_hours_played,p.experience,p.level from public.profiles p where p.user_id=r.referred_user_id and coalesce(p.is_active,true) order by p.created_at asc limit 1) rp on true
 left join public.bands b on b.id=case when coalesce(r.metadata->>'band_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (r.metadata->>'band_id')::uuid else null end
 where r.referrer_user_id=v_user_id;
 return v_result;
end; $$;
revoke all on function public.get_my_referral_recruits(uuid) from public,anon,authenticated;
grant execute on function public.get_my_referral_recruits(uuid) to authenticated;