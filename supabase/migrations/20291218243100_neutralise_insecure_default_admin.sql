-- Neutralise the historical default admin account without deleting its profile
-- or cascading through game data. Any legitimate administrator must be granted
-- access again through a secure, audited role-assignment process.
DO $$
DECLARE
  v_seeded_admin_id uuid;
BEGIN
  SELECT users.id
  INTO v_seeded_admin_id
  FROM auth.users AS users
  WHERE lower(users.email) = 'admin@rockmundo.com'
    AND coalesce(users.raw_user_meta_data->>'username', '') = 'admin'
    AND coalesce(users.raw_user_meta_data->>'display_name', '') = 'Admin User'
  ORDER BY users.created_at
  LIMIT 1;

  IF v_seeded_admin_id IS NULL THEN
    RAISE NOTICE 'No legacy seeded default admin account found';
    RETURN;
  END IF;

  UPDATE auth.users
  SET banned_until = 'infinity'::timestamptz,
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('seeded_default_admin_disabled', true),
      updated_at = now()
  WHERE id = v_seeded_admin_id;

  DELETE FROM public.user_roles
  WHERE user_id = v_seeded_admin_id
    AND role = 'admin'::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_seeded_admin_id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE WARNING 'Legacy seeded default admin account was banned and its admin role revoked';
END
$$;