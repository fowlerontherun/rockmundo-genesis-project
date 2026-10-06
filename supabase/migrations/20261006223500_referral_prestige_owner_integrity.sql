-- Keep promoter prestige on the same character that owns the milestone reward grant.
-- An account-level idempotency key prevents moving/duplicating milestone rewards between characters.
create or replace function public.claim_referral_milestones(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_qualified integer := 0;
  v_claimed text[] := '{}';
  v_rewarded boolean;
  v_owner_profile_id uuid;
  v_threshold integer;
  v_reward_key text;
  v_idempotency_key text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and user_id = v_user_id and coalesce(is_active, true)
  ) then raise exception 'Invalid profile'; end if;

  select count(*)::int into v_qualified
  from public.referrals
  where referrer_user_id = v_user_id and signup_qualified_at is not null;

  foreach v_threshold in array array[5,10,25]
  loop
    if v_qualified < v_threshold then continue; end if;

    v_reward_key := 'referral_milestone_' || v_threshold::text;
    v_idempotency_key := 'referral-milestone:' || v_user_id::text || ':' || v_threshold::text;

    v_rewarded := public._apply_game_reward(
      v_user_id, p_profile_id, v_reward_key, v_idempotency_key, null,
      jsonb_build_object('qualified', v_qualified)
    );

    -- Resolve the canonical reward owner after the idempotent grant attempt.
    -- Prestige is granted only to that character, never whichever character happens to claim later.
    select rg.beneficiary_profile_id into v_owner_profile_id
    from public.reward_grants rg
    where rg.beneficiary_user_id = v_user_id
      and rg.idempotency_key = v_idempotency_key
    limit 1;

    if v_owner_profile_id is not null then
      perform public._grant_referral_promoter_prestige(v_owner_profile_id, v_threshold);
    end if;

    if v_rewarded then v_claimed := array_append(v_claimed, v_threshold::text); end if;
  end loop;

  return jsonb_build_object(
    'qualified', v_qualified,
    'claimed', to_jsonb(v_claimed),
    'profile_id', p_profile_id
  );
end;
$$;

revoke all on function public.claim_referral_milestones(uuid) from public, anon;
grant execute on function public.claim_referral_milestones(uuid) to authenticated;
