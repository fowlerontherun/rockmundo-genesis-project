create or replace function public.prevent_private_auth_contact_as_public_profile_identity()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  account_email text;
begin
  select email into account_email
  from auth.users
  where id = new.user_id;

  if account_email is null then
    return new;
  end if;

  if lower(trim(coalesce(new.username, ''))) = lower(trim(account_email))
     and (tg_op = 'INSERT' or old.username is distinct from new.username) then
    raise exception 'Account email cannot be used as a public username'
      using errcode = '23514';
  end if;

  if lower(trim(coalesce(new.display_name, ''))) = lower(trim(account_email))
     and (tg_op = 'INSERT' or old.display_name is distinct from new.display_name) then
    raise exception 'Account email cannot be used as a public display name'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_private_auth_contact_as_public_profile_identity on public.profiles;
create trigger prevent_private_auth_contact_as_public_profile_identity
before insert or update of username, display_name on public.profiles
for each row
execute function public.prevent_private_auth_contact_as_public_profile_identity();
