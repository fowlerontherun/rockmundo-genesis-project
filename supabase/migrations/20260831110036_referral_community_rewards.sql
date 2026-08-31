-- RockMundo community verification and referral rewards

create table if not exists public.reward_config (
  reward_key text primary key,
  xp_amount integer not null default 0 check (xp_amount >= 0),
  ap_amount integer not null default 0 check (ap_amount >= 0),
  cash_amount bigint not null default 0 check (cash_amount >= 0),
  player_fame_amount integer not null default 0 check (player_fame_amount >= 0),
  band_fame_amount integer not null default 0 check (band_fame_amount >= 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.reward_config (reward_key, xp_amount, ap_amount, cash_amount, player_fame_amount, band_fame_amount, enabled)
values
  ('discord_verified', 250, 1, 1000, 5, 5, true),
  ('referral_signup', 500, 2, 2500, 15, 15, true),
  ('referral_vip', 2000, 8, 10000, 75, 75, true)
on conflict (reward_key) do nothing;

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code = upper(code) and length(code) between 6 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  bound_at timestamptz not null default now(),
  signup_qualified_at timestamptz,
  signup_rewarded_at timestamptz,
  vip_paid_at timestamptz,
  vip_eligible_at timestamptz,
  vip_rewarded_at timestamptz,
  vip_invoice_id text,
  risk_score integer not null default 0,
  risk_flags jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint referrals_not_self check (referrer_user_id <> referred_user_id)
);

create unique index if not exists referrals_vip_invoice_id_key on public.referrals(vip_invoice_id) where vip_invoice_id is not null;
create index if not exists referrals_referrer_idx on public.referrals(referrer_user_id, bound_at desc);
create index if not exists referrals_signup_pending_idx on public.referrals(referrer_user_id, signup_rewarded_at) where signup_rewarded_at is null;
create index if not exists referrals_vip_pending_idx on public.referrals(referrer_user_id, vip_rewarded_at, vip_eligible_at) where vip_rewarded_at is null;

create table if not exists public.community_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('discord')),
  external_account_id text not null,
  status text not null default 'verified' check (status in ('verified', 'revoked')),
  verified_at timestamptz not null default now(),
  rewarded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, platform)
);

create unique index if not exists community_verifications_external_account_key
  on public.community_verifications(platform, external_account_id)
  where status = 'verified';

create table if not exists public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  beneficiary_user_id uuid not null references auth.users(id) on delete cascade,
  beneficiary_profile_id uuid not null references public.profiles(id) on delete cascade,
  referral_id uuid references public.referrals(id) on delete set null,
  reward_key text not null references public.reward_config(reward_key),
  xp_amount integer not null default 0,
  ap_amount integer not null default 0,
  cash_amount bigint not null default 0,
  player_fame_amount integer not null default 0,
  band_fame_amount integer not null default 0,
  band_id uuid references public.bands(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists reward_grants_user_idx on public.reward_grants(beneficiary_user_id, created_at desc);

alter table public.reward_config enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.community_verifications enable row level security;
alter table public.reward_grants enable row level security;

create policy "Authenticated users can view reward config" on public.reward_config for select to authenticated using (enabled = true);
create policy "Users can view own referral code" on public.referral_codes for select to authenticated using (user_id = auth.uid());
create policy "Users can view related referrals" on public.referrals for select to authenticated using (referrer_user_id = auth.uid() or referred_user_id = auth.uid());
create policy "Users can view own community verification" on public.community_verifications for select to authenticated using (user_id = auth.uid());
create policy "Users can view own reward grants" on public.reward_grants for select to authenticated using (beneficiary_user_id = auth.uid());

create or replace function public._ensure_referral_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_attempt integer := 0;
begin
  select code into v_code from public.referral_codes where user_id = p_user_id;
  if v_code is not null then return v_code; end if;
  loop
    v_attempt := v_attempt + 1;
    v_code := 'RM' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.referral_codes(user_id, code) values (p_user_id, v_code);
      return v_code;
    exception when unique_violation then
      if v_attempt >= 5 then raise exception 'Unable to allocate referral code'; end if;
    end;
  end loop;
end;
$$;

create or replace function public._apply_game_reward(
  p_user_id uuid,
  p_profile_id uuid,
  p_reward_key text,
  p_idempotency_key text,
  p_referral_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reward public.reward_config%rowtype;
  v_grant_id uuid;
  v_band_id uuid;
begin
  if not exists (select 1 from public.profiles where id = p_profile_id and user_id = p_user_id and coalesce(is_active, true)) then
    raise exception 'Profile does not belong to beneficiary';
  end if;
  select * into v_reward from public.reward_config where reward_key = p_reward_key and enabled = true;
  if not found then raise exception 'Reward is not enabled: %', p_reward_key; end if;

  select bm.band_id into v_band_id
  from public.band_members bm
  where bm.profile_id = p_profile_id
    and coalesce(bm.member_status, 'active') = 'active'
    and coalesce(bm.is_touring_member, false) = false
  order by bm.joined_at desc nulls last
  limit 1;

  insert into public.reward_grants(
    idempotency_key, beneficiary_user_id, beneficiary_profile_id, referral_id,
    reward_key, xp_amount, ap_amount, cash_amount, player_fame_amount,
    band_fame_amount, band_id, metadata
  ) values (
    p_idempotency_key, p_user_id, p_profile_id, p_referral_id,
    p_reward_key, v_reward.xp_amount, v_reward.ap_amount, v_reward.cash_amount,
    v_reward.player_fame_amount, v_reward.band_fame_amount, v_band_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (idempotency_key) do nothing
  returning id into v_grant_id;

  if v_grant_id is null then return false; end if;

  insert into public.player_xp_wallet(
    profile_id, xp_balance, lifetime_xp, skill_xp_balance, skill_xp_lifetime,
    attribute_points_earned, attribute_points_balance, attribute_points_lifetime,
    last_recalculated
  ) values (
    p_profile_id, v_reward.xp_amount, v_reward.xp_amount,
    v_reward.xp_amount, v_reward.xp_amount,
    v_reward.ap_amount, v_reward.ap_amount, v_reward.ap_amount, now()
  )
  on conflict (profile_id) do update set
    xp_balance = coalesce(public.player_xp_wallet.xp_balance, 0) + excluded.xp_balance,
    lifetime_xp = coalesce(public.player_xp_wallet.lifetime_xp, 0) + excluded.lifetime_xp,
    skill_xp_balance = coalesce(public.player_xp_wallet.skill_xp_balance, 0) + excluded.skill_xp_balance,
    skill_xp_lifetime = coalesce(public.player_xp_wallet.skill_xp_lifetime, 0) + excluded.skill_xp_lifetime,
    attribute_points_earned = coalesce(public.player_xp_wallet.attribute_points_earned, 0) + excluded.attribute_points_earned,
    attribute_points_balance = coalesce(public.player_xp_wallet.attribute_points_balance, 0) + excluded.attribute_points_balance,
    attribute_points_lifetime = coalesce(public.player_xp_wallet.attribute_points_lifetime, 0) + excluded.attribute_points_lifetime,
    last_recalculated = now();

  update public.profiles set cash = cash + v_reward.cash_amount, fame = fame + v_reward.player_fame_amount where id = p_profile_id;
  if v_band_id is not null and v_reward.band_fame_amount > 0 then
    update public.bands set fame = fame + v_reward.band_fame_amount where id = v_band_id;
  end if;
  return true;
end;
$$;

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
  if v_created_at < now() - interval '7 days' then raise exception 'Referral codes can only be linked to accounts less than 7 days old'; end if;
  select user_id into v_referrer from public.referral_codes where code = upper(trim(p_code));
  if v_referrer is null then raise exception 'Invalid referral code'; end if;
  if v_referrer = v_user_id then raise exception 'You cannot refer yourself'; end if;
  insert into public.referrals(referrer_user_id, referred_user_id, referral_code)
  values (v_referrer, v_user_id, upper(trim(p_code))) returning * into v_existing;
  return jsonb_build_object('bound', true, 'already_bound', false, 'referral_id', v_existing.id);
end;
$$;

create or replace function public.get_referral_dashboard(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and user_id = v_user_id) then raise exception 'Invalid profile'; end if;
  v_code := public._ensure_referral_code(v_user_id);
  select jsonb_build_object(
    'code', v_code,
    'stats', jsonb_build_object(
      'joined', count(*)::int,
      'qualified', count(*) filter (where signup_qualified_at is not null)::int,
      'signup_rewarded', count(*) filter (where signup_rewarded_at is not null)::int,
      'vip_paid', count(*) filter (where vip_paid_at is not null)::int,
      'vip_rewarded', count(*) filter (where vip_rewarded_at is not null)::int
    ),
    'pending', jsonb_build_object(
      'signup', count(*) filter (where signup_qualified_at is not null and signup_rewarded_at is null)::int,
      'vip', count(*) filter (where vip_eligible_at <= now() and vip_rewarded_at is null)::int
    ),
    'rewards', (
      select coalesce(jsonb_object_agg(reward_key, jsonb_build_object(
        'xp', xp_amount, 'ap', ap_amount, 'cash', cash_amount,
        'player_fame', player_fame_amount, 'band_fame', band_fame_amount
      )), '{}'::jsonb)
      from public.reward_config where enabled = true
    ),
    'discord', coalesce((
      select jsonb_build_object('verified', status = 'verified', 'rewarded', rewarded_at is not null, 'verified_at', verified_at)
      from public.community_verifications where user_id = v_user_id and platform = 'discord'
    ), jsonb_build_object('verified', false, 'rewarded', false))
  ) into v_result
  from public.referrals where referrer_user_id = v_user_id;
  return v_result;
end;
$$;

create or replace function public.claim_referral_rewards(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_referral record;
  v_verification record;
  v_signup_count integer := 0;
  v_vip_count integer := 0;
  v_discord_count integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and user_id = v_user_id and coalesce(is_active, true)) then raise exception 'Invalid profile'; end if;

  update public.referrals r
  set signup_qualified_at = now()
  where r.referrer_user_id = v_user_id
    and r.signup_qualified_at is null
    and exists (
      select 1 from auth.users au
      where au.id = r.referred_user_id
        and au.email_confirmed_at is not null
        and au.created_at <= now() - interval '24 hours'
    )
    and exists (
      select 1 from public.profiles p
      where p.user_id = r.referred_user_id
        and coalesce(p.is_active, true)
        and (coalesce(p.total_hours_played, 0) >= 1 or coalesce(p.experience, 0) >= 100 or coalesce(p.level, 1) >= 2)
    );

  for v_referral in select id from public.referrals where referrer_user_id = v_user_id and signup_qualified_at is not null and signup_rewarded_at is null order by signup_qualified_at for update
  loop
    if public._apply_game_reward(v_user_id, p_profile_id, 'referral_signup', 'referral:' || v_referral.id::text || ':signup', v_referral.id, jsonb_build_object('source', 'qualified_referral')) then
      update public.referrals set signup_rewarded_at = now() where id = v_referral.id;
      v_signup_count := v_signup_count + 1;
    end if;
  end loop;

  for v_referral in select id from public.referrals where referrer_user_id = v_user_id and vip_eligible_at is not null and vip_eligible_at <= now() and vip_rewarded_at is null order by vip_eligible_at for update
  loop
    if public._apply_game_reward(v_user_id, p_profile_id, 'referral_vip', 'referral:' || v_referral.id::text || ':vip', v_referral.id, jsonb_build_object('source', 'paid_vip_referral')) then
      update public.referrals set vip_rewarded_at = now() where id = v_referral.id;
      v_vip_count := v_vip_count + 1;
    end if;
  end loop;

  select id into v_verification from public.community_verifications
  where user_id = v_user_id and platform = 'discord' and status = 'verified' and rewarded_at is null for update;
  if v_verification.id is not null then
    if public._apply_game_reward(v_user_id, p_profile_id, 'discord_verified', 'discord:' || v_user_id::text, null, jsonb_build_object('source', 'discord_membership')) then
      update public.community_verifications set rewarded_at = now() where id = v_verification.id;
      v_discord_count := 1;
    end if;
  end if;
  return jsonb_build_object('claimed', jsonb_build_object('signup', v_signup_count, 'vip', v_vip_count, 'discord', v_discord_count));
end;
$$;

create or replace function public.mark_referral_vip_paid(p_referred_user_id uuid, p_invoice_id text, p_paid_at timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  update public.referrals
  set vip_paid_at = coalesce(vip_paid_at, p_paid_at),
      vip_eligible_at = coalesce(vip_eligible_at, p_paid_at + interval '7 days'),
      vip_invoice_id = coalesce(vip_invoice_id, p_invoice_id)
  where referred_user_id = p_referred_user_id and vip_paid_at is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

create or replace function public.mark_community_verified(p_user_id uuid, p_platform text, p_external_account_id text, p_metadata jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_platform <> 'discord' then raise exception 'Unsupported verification platform'; end if;
  insert into public.community_verifications(user_id, platform, external_account_id, status, verified_at, metadata)
  values (p_user_id, p_platform, p_external_account_id, 'verified', now(), coalesce(p_metadata, '{}'::jsonb))
  on conflict (user_id, platform) do update set
    external_account_id = excluded.external_account_id,
    status = 'verified',
    verified_at = now(),
    metadata = excluded.metadata;
  return true;
end;
$$;

revoke all on function public._ensure_referral_code(uuid) from public, anon, authenticated;
revoke all on function public._apply_game_reward(uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mark_referral_vip_paid(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_community_verified(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public._ensure_referral_code(uuid) to service_role;
grant execute on function public._apply_game_reward(uuid, uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.mark_referral_vip_paid(uuid, text, timestamptz) to service_role;
grant execute on function public.mark_community_verified(uuid, text, text, jsonb) to service_role;

revoke all on function public.bind_referral_code(text) from public, anon;
revoke all on function public.get_referral_dashboard(uuid) from public, anon;
revoke all on function public.claim_referral_rewards(uuid) from public, anon;
grant execute on function public.bind_referral_code(text) to authenticated;
grant execute on function public.get_referral_dashboard(uuid) to authenticated;
grant execute on function public.claim_referral_rewards(uuid) to authenticated;
