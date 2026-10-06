CREATE OR REPLACE FUNCTION public.process_inactive_character_comas()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  WITH account_activity AS (
    SELECT
      u.id AS user_id,
      GREATEST(
        COALESCE(u.last_sign_in_at, '-infinity'::timestamptz),
        COALESCE(MAX(p2.last_login_at), '-infinity'::timestamptz)
      ) AS last_activity_at
    FROM auth.users u
    JOIN public.profiles p2
      ON p2.user_id = u.id
     AND p2.deleted_at IS NULL
    GROUP BY u.id, u.last_sign_in_at
  ),
  updated AS (
    UPDATE public.profiles p
       SET died_at = now(),
           is_active = false,
           death_cause = 'Coma (30 days inactivity)'
      FROM account_activity a
     WHERE p.user_id = a.user_id
       AND p.deleted_at IS NULL
       AND p.died_at IS NULL
       AND a.last_activity_at < now() - interval '30 days'
    RETURNING p.id
  )
  SELECT count(*)::integer INTO v_count FROM updated;

  RETURN jsonb_build_object(
    'comatose', COALESCE(v_count, 0),
    'threshold_days', 30,
    'activity_scope', 'account'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.process_inactive_character_comas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_inactive_character_comas() FROM anon;
REVOKE ALL ON FUNCTION public.process_inactive_character_comas() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_inactive_character_comas() TO service_role;

CREATE OR REPLACE FUNCTION public.switch_active_character(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_comatose boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (p.died_at IS NOT NULL)
    INTO v_is_comatose
    FROM public.profiles p
   WHERE p.id = p_profile_id
     AND p.user_id = v_user
     AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found';
  END IF;

  IF v_is_comatose THEN
    RAISE EXCEPTION 'Character is in a coma; revive it before switching';
  END IF;

  UPDATE public.profiles
     SET is_active = false
   WHERE user_id = v_user
     AND id <> p_profile_id
     AND is_active = true;

  UPDATE public.profiles
     SET is_active = true,
         last_login_at = now()
   WHERE id = p_profile_id
     AND user_id = v_user
     AND died_at IS NULL
     AND deleted_at IS NULL;
END;
$function$;

WITH repairable AS (
  SELECT p.id, p.user_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
   WHERE p.died_at IS NOT NULL
     AND p.death_cause = 'Coma (extended inactivity)'
     AND (
       (
         u.last_sign_in_at >= p.died_at - interval '30 days'
         AND u.last_sign_in_at < p.died_at
       )
       OR EXISTS (
         SELECT 1
           FROM public.profiles sibling
          WHERE sibling.user_id = p.user_id
            AND sibling.id <> p.id
            AND sibling.last_login_at >= p.died_at - interval '30 days'
            AND sibling.last_login_at < p.died_at
       )
     )
),
restored AS (
  UPDATE public.profiles p
     SET died_at = NULL,
         death_cause = NULL,
         updated_at = now()
    FROM repairable r
   WHERE p.id = r.id
  RETURNING p.id, p.user_id, p.last_login_at, p.slot_number
),
users_without_active AS (
  SELECT DISTINCT r.user_id
    FROM restored r
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.profiles current_active
      WHERE current_active.user_id = r.user_id
        AND current_active.deleted_at IS NULL
        AND current_active.died_at IS NULL
        AND current_active.is_active = true
   )
),
ranked AS (
  SELECT
    r.id,
    r.user_id,
    ROW_NUMBER() OVER (
      PARTITION BY r.user_id
      ORDER BY r.last_login_at DESC NULLS LAST, r.slot_number ASC NULLS LAST, r.id
    ) AS rn
  FROM restored r
  JOIN users_without_active u ON u.user_id = r.user_id
)
UPDATE public.profiles p
   SET is_active = true,
       updated_at = now()
  FROM ranked r
 WHERE p.id = r.id
   AND r.rn = 1;
