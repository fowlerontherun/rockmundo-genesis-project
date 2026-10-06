-- Referral System V2: wider recovery window and durable promoter milestones.
-- Existing anti-farm qualification remains the source of truth; milestones count only qualified recruits.

insert into public.reward_config (reward_key, xp_amount, ap_amount, cash_amount, player_fame_amount, band_fame_amount, enabled)
values
  ('referral_milestone_5', 1000, 3, 5000, 25, 25, true),
  ('referral_milestone_10', 2500, 5, 10000, 50, 50, true),
  ('referral_milestone_25', 5000, 10, 25000, 100, 100, true)
on conflict (reward_key) do update set
  xp_amount = excluded.xp_amount,
  ap_amount = excluded.ap_amount,
  cash_amount = excluded.cash_amount,
  player_fame_amount = excluded.player_fame_amount,
  band_fame_amount = excluded.band_fame_amount,
  enabled = excluded.enabled,
  updated_at = now();

create or replace function public.bind_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_referrer uuid;
  v_created_at timestamptz;
  v_existing public.referrals%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select created_at into v_created_at from auth.users where id = v_user_id;
  if v_created_at is null then raise exception 'User not found'; end if;
  select * into v_existing from public.referrals where referred_user_id = v_user_id;
  if found then return jsonb_build_object('bound', true, 'already_bound', true, 'referral_id', v_existing.id); end if;
  if v_created_at < now() - interval '30 days' then raise exception 'Referral codes can only be linked to accounts less than 30 days old'; end if;
  select user_id into v_referrer from public.referral_codes where code = upper(trim(p_code));
  if v_referrer is null then raise exception 'Invalid referral code'; end if;
  if v_referrer = v_user_id then raise exception 'You cannot refer yourself'; end if;
  insert into public.referrals(referrer_user_id, referred_user_id, referral_code, metadata)
  values (v_referrer, v_user_id, upper(trim(p_code)), jsonb_build_object('source', 'manual_code'))
  returning * into v_existing;
  return jsonb_build_object('bound', true, 'already_bound', false, 'referral_id', v_existing.id);
end;
$$;

create or replace function public.claim_referral_milestones(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_qualified integer := 0;
  v_claimed text[] := '{}';
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and user_id = v_user_id and coalesce(is_active, true)) then
    raise exception 'Invalid profile';
  end if;

  select count(*)::int into v_qualified
  from public.referrals
  where referrer_user_id = v_user_id and signup_qualified_at is not null;

  if v_qualified >= 5 and public._apply_game_reward(v_user_id, p_profile_id, 'referral_milestone_5', 'referral-milestone:' || v_user_id::text || ':5', null, jsonb_build_object('qualified', v_qualified)) then
    v_claimed := array_append(v_claimed, '5');
  end if;
  if v_qualified >= 10 and public._apply_game_reward(v_user_id, p_profile_id, 'referral_milestone_10', 'referral-milestone:' || v_user_id::text || ':10', null, jsonb_build_object('qualified', v_qualified)) then
    v_claimed := array_append(v_claimed, '10');
  end if;
  if v_qualified >= 25 and public._apply_game_reward(v_user_id, p_profile_id, 'referral_milestone_25', 'referral-milestone:' || v_user_id::text || ':25', null, jsonb_build_object('qualified', v_qualified)) then
    v_claimed := array_append(v_claimed, '25');
  end if;

  return jsonb_build_object('qualified', v_qualified, 'claimed', to_jsonb(v_claimed));
end;
$$;

revoke all on function public.claim_referral_milestones(uuid) from public, anon;
grant execute on function public.claim_referral_milestones(uuid) to authenticated;
grant execute on function public.bind_referral_code(text) to authenticated;
