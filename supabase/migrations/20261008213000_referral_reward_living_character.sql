-- Prevent referral/community rewards being assigned to a dead character.
create or replace function public._apply_game_reward(
 p_user_id uuid,p_profile_id uuid,p_reward_key text,p_idempotency_key text,
 p_referral_id uuid default null,p_metadata jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_reward public.reward_config%rowtype; v_grant_id uuid; v_band_id uuid;
begin
 if not exists(select 1 from public.profiles where id=p_profile_id and user_id=p_user_id and coalesce(is_active,true) and died_at is null) then raise exception 'Profile does not belong to a living active beneficiary'; end if;
 select * into v_reward from public.reward_config where reward_key=p_reward_key and enabled=true;
 if not found then raise exception 'Reward is not enabled: %',p_reward_key; end if;
 select bm.band_id into v_band_id from public.band_members bm where bm.profile_id=p_profile_id and coalesce(bm.member_status,'active')='active' and coalesce(bm.is_touring_member,false)=false order by bm.joined_at desc nulls last limit 1;
 insert into public.reward_grants(idempotency_key,beneficiary_user_id,beneficiary_profile_id,referral_id,reward_key,xp_amount,ap_amount,cash_amount,player_fame_amount,band_fame_amount,band_id,metadata)
 values(p_idempotency_key,p_user_id,p_profile_id,p_referral_id,p_reward_key,v_reward.xp_amount,v_reward.ap_amount,v_reward.cash_amount,v_reward.player_fame_amount,v_reward.band_fame_amount,v_band_id,coalesce(p_metadata,'{}'::jsonb))
 on conflict(idempotency_key) do nothing returning id into v_grant_id;
 if v_grant_id is null then return false; end if;
 insert into public.player_xp_wallet(profile_id,xp_balance,lifetime_xp,skill_xp_balance,skill_xp_lifetime,attribute_points_earned,attribute_points_balance,attribute_points_lifetime,last_recalculated)
 values(p_profile_id,v_reward.xp_amount,v_reward.xp_amount,v_reward.xp_amount,v_reward.xp_amount,v_reward.ap_amount,v_reward.ap_amount,v_reward.ap_amount,now())
 on conflict(profile_id) do update set xp_balance=coalesce(public.player_xp_wallet.xp_balance,0)+excluded.xp_balance,lifetime_xp=coalesce(public.player_xp_wallet.lifetime_xp,0)+excluded.lifetime_xp,skill_xp_balance=coalesce(public.player_xp_wallet.skill_xp_balance,0)+excluded.skill_xp_balance,skill_xp_lifetime=coalesce(public.player_xp_wallet.skill_xp_lifetime,0)+excluded.skill_xp_lifetime,attribute_points_earned=coalesce(public.player_xp_wallet.attribute_points_earned,0)+excluded.attribute_points_earned,attribute_points_balance=coalesce(public.player_xp_wallet.attribute_points_balance,0)+excluded.attribute_points_balance,attribute_points_lifetime=coalesce(public.player_xp_wallet.attribute_points_lifetime,0)+excluded.attribute_points_lifetime,last_recalculated=now();
 update public.profiles set cash=cash+v_reward.cash_amount,fame=fame+v_reward.player_fame_amount where id=p_profile_id;
 if v_band_id is not null and v_reward.band_fame_amount>0 then update public.bands set fame=fame+v_reward.band_fame_amount where id=v_band_id; end if;
 return true;
end; $$;
revoke all on function public._apply_game_reward(uuid,uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public._apply_game_reward(uuid,uuid,text,text,uuid,jsonb) to service_role;
