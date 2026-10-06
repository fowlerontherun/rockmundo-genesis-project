CREATE OR REPLACE FUNCTION public.admin_revive_character(
  p_profile_id uuid,
  p_health integer DEFAULT 75,
  p_energy integer DEFAULT 75,
  p_grant_lives integer DEFAULT 0,
  p_make_active boolean DEFAULT true,
  p_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_profile.died_at IS NOT NULL
     AND COALESCE(v_profile.death_cause, '') <> 'Deleted by player' THEN
    INSERT INTO public.character_coma_events (
      profile_id,
      user_id,
      event_type,
      cause,
      source,
      coma_started_at,
      account_last_activity_at,
      actor_id,
      metadata
    )
    VALUES (
      p_profile_id,
      v_profile.user_id,
      'revived',
      v_profile.death_cause,
      'admin_recovery',
      COALESCE(v_profile.coma_started_at, v_profile.died_at),
      v_profile.coma_last_account_activity_at,
      v_admin,
      jsonb_build_object(
        'health_restored', v_health,
        'energy_restored', v_energy,
        'reason', NULLIF(btrim(COALESCE(p_reason, '')), '')
      )
    );
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
    coma_started_at = NULL,
    coma_last_account_activity_at = NULL,
    updated_at = now()
  WHERE id = p_profile_id;

  IF COALESCE(p_make_active, true) THEN
    UPDATE public.profiles
    SET is_active = false, updated_at = now()
    WHERE user_id = v_profile.user_id
      AND id <> p_profile_id
      AND is_active = true;

    UPDATE public.profiles
    SET is_active = true, last_login_at = now(), updated_at = now()
    WHERE id = p_profile_id;
  END IF;

  DELETE FROM public.hall_of_immortals
  WHERE profile_id = p_profile_id;

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

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id;

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
$function$;
