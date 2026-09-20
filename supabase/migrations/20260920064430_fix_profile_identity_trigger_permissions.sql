-- Fix profile identity validation for authenticated profile updates.
--
-- The trigger must inspect auth.users to prevent an account email address from
-- becoming a public username/display name. Authenticated clients cannot read
-- auth.users, so running this trigger as SECURITY INVOKER caused every
-- username/display_name update (including extra-character onboarding) to fail
-- with "permission denied for table users".
--
-- Keep the validation, but execute the narrow trigger function with the
-- privileges of its postgres owner. The row being changed is still protected
-- by profiles RLS; this function only reads the email for NEW.user_id.
CREATE OR REPLACE FUNCTION public.prevent_private_auth_contact_as_public_profile_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  account_email text;
BEGIN
  SELECT email
  INTO account_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF account_email IS NULL THEN
    RETURN NEW;
  END IF;

  IF lower(trim(coalesce(NEW.username, ''))) = lower(trim(account_email))
     AND (TG_OP = 'INSERT' OR OLD.username IS DISTINCT FROM NEW.username) THEN
    RAISE EXCEPTION 'Account email cannot be used as a public username'
      USING ERRCODE = '23514';
  END IF;

  IF lower(trim(coalesce(NEW.display_name, ''))) = lower(trim(account_email))
     AND (TG_OP = 'INSERT' OR OLD.display_name IS DISTINCT FROM NEW.display_name) THEN
    RAISE EXCEPTION 'Account email cannot be used as a public display name'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;
