-- Owner-only reward history for the City Scene board.
-- No claim mutation endpoint; this only displays issued/pending/expired XP.
begin;
create or replace function public.get_my_scene_reward_history(
  p_city_id uuid,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_data jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_city_id is null or p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'INVALID_SCENE_REWARD_QUERY';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cycle_id', result.cycle_id,
      'cadence', result.cadence,
      'reward_key', result.reward_key,
      'reward_kind', result.reward_kind,
      'reward_amount', result.reward_amount,
      'status', result.status,
      'entitled_at', result.entitled_at,
      'expires_at', result.expires_at,
      'granted_at', result.claimed_at
    ) order by result.entitled_at desc,result.reward_key
  ),'[]'::jsonb) into v_data
  from (
    select c.cycle_id,cyc.cadence,c.reward_key,c.reward_kind,
      c.reward_amount,c.status,c.entitled_at,c.expires_at,c.claimed_at
    from public.scene_reward_claims c
    join public.scene_challenge_cycles cyc on cyc.id = c.cycle_id
    where cyc.city_id=p_city_id and c.account_id = (select auth.uid())
    order by c.entitled_at desc,c.id
    limit p_limit
  ) result;
  return v_data;
end;
$$;

revoke all on function public.get_my_scene_reward_history(uuid,integer)
  from public, anon;
grant execute on function public.get_my_scene_reward_history(uuid,integer)
  to authenticated, service_role;
commit;