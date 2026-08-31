create or replace function public.capture_referral_from_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_referrer uuid;
begin
  v_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  if v_code = '' then
    return new;
  end if;

  select user_id into v_referrer
  from public.referral_codes
  where code = v_code;

  if v_referrer is null or v_referrer = new.id then
    return new;
  end if;

  insert into public.referrals(referrer_user_id, referred_user_id, referral_code, metadata)
  values (v_referrer, new.id, v_code, jsonb_build_object('source', 'signup_metadata'))
  on conflict (referred_user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.capture_referral_from_signup() from public, anon, authenticated;

drop trigger if exists capture_referral_from_signup_trigger on auth.users;
create trigger capture_referral_from_signup_trigger
after insert on auth.users
for each row execute function public.capture_referral_from_signup();
