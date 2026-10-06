-- Allow an already-existing account that followed a band recruitment referral link
-- to attach that band context after bind_referral_code succeeds.
create or replace function public.attach_my_referral_band(p_band_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_referral public.referrals%rowtype;
  v_existing_band text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_referral
  from public.referrals
  where referred_user_id = v_user_id
  for update;

  if not found then raise exception 'No referral is linked to this account'; end if;

  v_existing_band := nullif(v_referral.metadata ->> 'band_id', '');
  if v_existing_band is not null then
    if v_existing_band = p_band_id::text then
      return jsonb_build_object('attached', true, 'already_attached', true, 'band_id', p_band_id);
    end if;
    raise exception 'Referral band attribution is already fixed';
  end if;

  -- Recovery/late binding is intentionally limited to the same 30-day referral window.
  if v_referral.bound_at < now() - interval '30 days' then
    raise exception 'Band referral attribution window has expired';
  end if;

  -- The band is valid only if the actual referral owner is currently an active,
  -- non-touring member. The referred user cannot choose an unrelated band.
  if not exists (
    select 1
    from public.band_members bm
    join public.profiles p on p.id = bm.profile_id
    where bm.band_id = p_band_id
      and p.user_id = v_referral.referrer_user_id
      and coalesce(bm.member_status, 'active') = 'active'
      and coalesce(bm.is_touring_member, false) = false
  ) then
    raise exception 'The referrer is not an active member of that band';
  end if;

  update public.referrals
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('band_id', p_band_id, 'band_attribution_source', 'post_auth_link')
  where id = v_referral.id;

  return jsonb_build_object('attached', true, 'already_attached', false, 'band_id', p_band_id);
end;
$$;

revoke all on function public.attach_my_referral_band(uuid) from public, anon;
grant execute on function public.attach_my_referral_band(uuid) to authenticated;
