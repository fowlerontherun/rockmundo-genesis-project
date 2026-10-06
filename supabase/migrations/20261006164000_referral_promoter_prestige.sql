-- Referral promoter prestige: reuse canonical profile titles and bridge public profile badges.

create or replace function public._grant_referral_promoter_prestige(
  p_profile_id uuid,
  p_milestone integer
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_badge_key text;
  v_badge_label text;
  v_description text;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and user_id = auth.uid() and coalesce(is_active, true)
  ) then
    raise exception 'Invalid profile';
  end if;

  select
    case p_milestone when 5 then 'Street Promoter' when 10 then 'Scene Builder' when 25 then 'RockMundo Ambassador' end,
    case p_milestone when 5 then 'referral-promoter-5' when 10 then 'referral-promoter-10' when 25 then 'referral-promoter-25' end,
    case p_milestone when 5 then 'Street Promoter' when 10 then 'Scene Builder' when 25 then 'RockMundo Ambassador' end,
    case p_milestone
      when 5 then 'Recruited 5 qualified RockMundo players.'
      when 10 then 'Recruited 10 qualified RockMundo players.'
      when 25 then 'Recruited 25 qualified RockMundo players.'
    end
  into v_title, v_badge_key, v_badge_label, v_description;

  if v_title is null then raise exception 'Unsupported promoter milestone'; end if;

  insert into public.profile_titles(profile_id, title)
  values (p_profile_id, v_title)
  on conflict (profile_id, title) do nothing;

  insert into public.player_profile_badges(profile_id, badge_key, label, description)
  values (p_profile_id, v_badge_key, v_badge_label, v_description)
  on conflict (profile_id, badge_key) do update
    set label = excluded.label, description = excluded.description;

  insert into public.profile_badges(profile_id, badge_key, tier)
  values (
    p_profile_id,
    v_badge_key,
    case p_milestone when 5 then 'bronze'::public.achievement_tier when 10 then 'silver'::public.achievement_tier else 'gold'::public.achievement_tier end
  )
  on conflict (profile_id, badge_key) do nothing;
end;
$$;

revoke all on function public._grant_referral_promoter_prestige(uuid, integer) from public, anon, authenticated;

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
  v_rewarded boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and user_id = v_user_id and coalesce(is_active, true)) then
    raise exception 'Invalid profile';
  end if;

  select count(*)::int into v_qualified
  from public.referrals
  where referrer_user_id = v_user_id and signup_qualified_at is not null;

  if v_qualified >= 5 then
    v_rewarded := public._apply_game_reward(v_user_id, p_profile_id, 'referral_milestone_5', 'referral-milestone:' || v_user_id::text || ':5', null, jsonb_build_object('qualified', v_qualified));
    perform public._grant_referral_promoter_prestige(p_profile_id, 5);
    if v_rewarded then v_claimed := array_append(v_claimed, '5'); end if;
  end if;
  if v_qualified >= 10 then
    v_rewarded := public._apply_game_reward(v_user_id, p_profile_id, 'referral_milestone_10', 'referral-milestone:' || v_user_id::text || ':10', null, jsonb_build_object('qualified', v_qualified));
    perform public._grant_referral_promoter_prestige(p_profile_id, 10);
    if v_rewarded then v_claimed := array_append(v_claimed, '10'); end if;
  end if;
  if v_qualified >= 25 then
    v_rewarded := public._apply_game_reward(v_user_id, p_profile_id, 'referral_milestone_25', 'referral-milestone:' || v_user_id::text || ':25', null, jsonb_build_object('qualified', v_qualified));
    perform public._grant_referral_promoter_prestige(p_profile_id, 25);
    if v_rewarded then v_claimed := array_append(v_claimed, '25'); end if;
  end if;

  return jsonb_build_object('qualified', v_qualified, 'claimed', to_jsonb(v_claimed));
end;
$$;

revoke all on function public.claim_referral_milestones(uuid) from public, anon;
grant execute on function public.claim_referral_milestones(uuid) to authenticated;
