create or replace function public.get_my_referral_welcome(p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid:=auth.uid(); v_result jsonb;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.profiles where id=p_profile_id and user_id=v_user_id and coalesce(is_active,true)) then raise exception 'Invalid profile'; end if;
 select jsonb_build_object(
  'referred',true,'bound_at',r.bound_at,'source',coalesce(r.metadata->>'source','unknown'),'qualified',r.signup_qualified_at is not null,
  'qualification',jsonb_build_object('email_confirmed',au.email_confirmed_at is not null,'account_age_met',au.created_at<=now()-interval '24 hours',
   'activity_met',coalesce(p.total_hours_played,0)>=1 or coalesce(p.experience,0)>=100 or coalesce(p.level,1)>=2,
   'hours_played',coalesce(p.total_hours_played,0),'experience',coalesce(p.experience,0),'level',coalesce(p.level,1)),
  'referrer',jsonb_build_object('profile_id',rp.id,'name',coalesce(rp.display_name,rp.username,rp.name,'Another RockMundo player')),
  'band',case when b.id is null then null else jsonb_build_object('band_id',b.id,'name',b.name) end
 ) into v_result
 from public.referrals r join auth.users au on au.id=r.referred_user_id join public.profiles p on p.id=p_profile_id and p.user_id=r.referred_user_id
 left join lateral(select x.id,x.display_name,x.username,x.name from public.profiles x where x.user_id=r.referrer_user_id and coalesce(x.is_active,true) order by x.created_at asc limit 1) rp on true
 left join public.bands b on b.id=case when coalesce(r.metadata->>'band_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (r.metadata->>'band_id')::uuid else null end
 where r.referred_user_id=v_user_id limit 1;
 return coalesce(v_result,jsonb_build_object('referred',false));
end; $$;
revoke all on function public.get_my_referral_welcome(uuid) from public,anon,authenticated;
grant execute on function public.get_my_referral_welcome(uuid) to authenticated;