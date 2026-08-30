create or replace function public.progression_spend_skill_xp(
  p_profile_id uuid,
  p_skill_slug text,
  p_xp integer,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_wallet public.player_xp_wallet%rowtype;
  v_skill public.skill_progress%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_max integer := 20;
  v_level integer;
  v_xp integer;
  v_req integer;
  v_wallet_before integer;
  v_spend integer;
  v_to_max integer := 0;
  v_levels integer := 0;
  v_level_before integer;
  v_xp_before integer;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, p_metadata->>'idempotency_key')), '');
  v_existing jsonb;
  v_result jsonb;
  i integer;
begin
  if auth.uid() is null then raise exception 'skill_xp_unauthorised' using errcode='P0001'; end if;
  if v_key is null then raise exception 'skill_xp_missing_idempotency_key' using errcode='P0001'; end if;
  if p_xp is null or p_xp <= 0 then raise exception 'skill_xp_invalid_amount' using errcode='P0001'; end if;
  if p_skill_slug is null or btrim(p_skill_slug) = '' then raise exception 'skill_xp_skill_not_found' using errcode='P0001'; end if;

  select result into v_existing
  from public.skill_xp_spend_ledger
  where profile_id = p_profile_id and idempotency_key = v_key;
  if found then return v_existing || jsonb_build_object('duplicate', true); end if;

  perform 1 from public.profiles
  where id = p_profile_id and user_id = auth.uid() and is_active is true and died_at is null;
  if not found then raise exception 'skill_xp_profile_not_authorised' using errcode='P0001'; end if;

  perform 1 from public.skill_definitions where slug::text = p_skill_slug;
  if not found then raise exception 'skill_xp_skill_not_found' using errcode='P0001'; end if;

  if public.skill_tier_unlocked(p_profile_id, p_skill_slug) is false then
    raise exception 'skill_xp_skill_locked' using errcode='P0001';
  end if;

  select * into v_wallet from public.player_xp_wallet where profile_id = p_profile_id for update;
  if not found then
    insert into public.player_xp_wallet (profile_id)
    values (p_profile_id)
    on conflict (profile_id) do nothing;
    select * into v_wallet from public.player_xp_wallet where profile_id = p_profile_id for update;
    if not found then raise exception 'skill_xp_wallet_missing' using errcode='P0001'; end if;
  end if;
  v_wallet_before := greatest(0, coalesce(v_wallet.skill_xp_balance, v_wallet.xp_balance, 0));

  select * into v_skill from public.skill_progress
  where profile_id = p_profile_id and skill_slug = p_skill_slug for update;
  if not found then
    insert into public.skill_progress (profile_id, skill_slug, current_level, current_xp, required_xp)
    values (p_profile_id, p_skill_slug, 0, 0, public.progression_skill_required_xp(0))
    on conflict (profile_id, skill_slug) do nothing;
    select * into v_skill from public.skill_progress
    where profile_id = p_profile_id and skill_slug = p_skill_slug for update;
    if not found then raise exception 'skill_xp_skill_locked' using errcode='P0001'; end if;
  end if;

  v_level := least(greatest(coalesce(v_skill.current_level,0),0), v_max);
  v_xp := greatest(coalesce(v_skill.current_xp,0),0);
  v_level_before := v_level;
  v_xp_before := v_xp;
  if v_level >= v_max then raise exception 'skill_xp_max_level_reached' using errcode='P0001'; end if;

  v_req := coalesce(nullif(v_skill.required_xp,0), public.progression_skill_required_xp(v_level));
  v_to_max := greatest(v_req - least(v_xp, v_req), 0);
  if v_level + 1 <= v_max - 1 then
    for i in (v_level + 1)..(v_max - 1) loop
      v_to_max := v_to_max + public.progression_skill_required_xp(i);
    end loop;
  end if;

  if v_wallet_before < p_xp then raise exception 'skill_xp_insufficient_funds' using errcode='P0001'; end if;
  v_spend := least(p_xp, v_to_max);
  if v_spend <= 0 then raise exception 'skill_xp_invalid_amount' using errcode='P0001'; end if;

  v_xp := least(v_xp, v_req) + v_spend;
  while v_level < v_max and v_xp >= v_req loop
    v_xp := v_xp - v_req;
    v_level := v_level + 1;
    v_levels := v_levels + 1;
    if v_level < v_max then
      v_req := public.progression_skill_required_xp(v_level);
    end if;
  end loop;

  if v_level >= v_max then v_level := v_max; v_xp := 0; v_req := 0; end if;

  update public.player_xp_wallet
  set skill_xp_balance = v_wallet_before - v_spend,
      xp_balance = v_wallet_before - v_spend,
      skill_xp_spent = coalesce(skill_xp_spent, xp_spent, 0) + v_spend,
      xp_spent = coalesce(xp_spent, skill_xp_spent, 0) + v_spend,
      last_recalculated = v_now
  where profile_id = p_profile_id;

  update public.skill_progress
  set current_level = v_level,
      current_xp = v_xp,
      required_xp = v_req,
      updated_at = v_now,
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('balance_version','progression_v2.0.0')
  where id = v_skill.id
  returning * into v_skill;

  v_result := jsonb_build_object(
    'skill_slug', p_skill_slug,
    'xp_spent', v_spend,
    'levels_gained', v_levels,
    'wallet_after', v_wallet_before - v_spend,
    'current_level', v_skill.current_level,
    'current_xp', v_skill.current_xp,
    'required_xp', v_skill.required_xp,
    'skill_progress', to_jsonb(v_skill)
  );

  insert into public.skill_xp_spend_ledger(
    profile_id, skill_slug, xp_spent, level_before, level_after,
    xp_progress_before, xp_progress_after, wallet_before, wallet_after,
    balance_version, idempotency_key, result
  ) values (
    p_profile_id, p_skill_slug, v_spend, v_level_before, v_level,
    v_xp_before, v_xp, v_wallet_before, v_wallet_before-v_spend,
    'progression_v2.0.0', v_key, v_result
  );

  return v_result;
end;
$function$;