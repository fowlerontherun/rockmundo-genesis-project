
CREATE OR REPLACE FUNCTION public.admin_search_characters(
  p_search text DEFAULT NULL,
  p_only_dead boolean DEFAULT false,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  profile_id uuid,
  user_id uuid,
  username text,
  display_name text,
  slot_number integer,
  level integer,
  fame integer,
  cash bigint,
  health integer,
  energy integer,
  is_active boolean,
  died_at timestamptz,
  death_cause text,
  deleted_at timestamptz,
  resurrection_lives integer,
  last_login_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.user_id,
    p.username::text,
    p.display_name::text,
    p.slot_number,
    p.level,
    p.fame,
    p.cash,
    p.health,
    p.energy,
    p.is_active,
    p.died_at,
    p.death_cause,
    p.deleted_at,
    p.resurrection_lives,
    p.last_login_at,
    p.created_at
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin')
    AND (
      NOT COALESCE(p_only_dead, false)
      OR p.died_at IS NOT NULL
      OR p.deleted_at IS NOT NULL
    )
    AND (
      p_search IS NULL
      OR btrim(p_search) = ''
      OR p.username ILIKE '%' || btrim(p_search) || '%'
      OR COALESCE(p.display_name, '') ILIKE '%' || btrim(p_search) || '%'
      OR p.id::text = btrim(p_search)
      OR p.user_id::text = btrim(p_search)
    )
  ORDER BY (p.died_at IS NOT NULL OR p.deleted_at IS NOT NULL) DESC, p.fame DESC, p.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.admin_search_characters(text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_characters(text, boolean, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revive_character(
  p_profile_id uuid,
  p_health integer DEFAULT 75,
  p_energy integer DEFAULT 75,
  p_grant_lives integer DEFAULT 0,
  p_make_active boolean DEFAULT true,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_profile public.profiles;
  v_health integer := LEAST(GREATEST(COALESCE(p_health, 75), 1), 100);
  v_energy integer := LEAST(GREATEST(COALESCE(p_energy, 75), 1), 100);
  v_lives integer := GREATEST(COALESCE(p_grant_lives, 0), 0);
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles
  SET
    died_at = NULL,
    death_cause = NULL,
    deleted_at = NULL,
    health = v_health,
    energy = v_energy,
    physical_health = GREATEST(COALESCE(physical_health, 0), v_health),
    mood = GREATEST(COALESCE(mood, 0), 50),
    stress = LEAST(COALESCE(stress, 0), 40),
    fatigue = LEAST(COALESCE(fatigue, 0), 40),
    burnout_risk = LEAST(COALESCE(burnout_risk, 0), 40),
    happiness = GREATEST(COALESCE(happiness, 0), 50),
    motivation = GREATEST(COALESCE(motivation, 0), 50),
    overall_wellness = GREATEST(COALESCE(overall_wellness, 0), 50),
    rest_required_until = NULL,
    resurrection_lives = COALESCE(resurrection_lives, 0) + v_lives,
    last_health_update = now(),
    updated_at = now()
  WHERE id = p_profile_id;

  IF COALESCE(p_make_active, true) THEN
    UPDATE public.profiles
    SET is_active = false, updated_at = now()
    WHERE user_id = v_profile.user_id
      AND id <> p_profile_id
      AND is_active = true;

    UPDATE public.profiles
    SET is_active = true, updated_at = now()
    WHERE id = p_profile_id;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, payload)
  VALUES (
    v_admin,
    'admin_revive_character',
    jsonb_build_object(
      'profile_id', p_profile_id,
      'owner_user_id', v_profile.user_id,
      'username', v_profile.username,
      'previous_died_at', v_profile.died_at,
      'previous_death_cause', v_profile.death_cause,
      'previous_deleted_at', v_profile.deleted_at,
      'health', v_health,
      'energy', v_energy,
      'granted_lives', v_lives,
      'made_active', COALESCE(p_make_active, true),
      'reason', NULLIF(btrim(COALESCE(p_reason, '')), '')
    )
  );

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_profile.id,
    'username', v_profile.username,
    'display_name', v_profile.display_name,
    'health', v_profile.health,
    'energy', v_profile.energy,
    'is_active', v_profile.is_active,
    'resurrection_lives', v_profile.resurrection_lives
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revive_character(uuid, integer, integer, integer, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revive_character(uuid, integer, integer, integer, boolean, text) TO authenticated;
