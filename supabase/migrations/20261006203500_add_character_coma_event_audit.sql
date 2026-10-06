-- Keep authoritative history for automatic coma entry and revival.
-- The event table is append-only from SECURITY DEFINER functions; players can
-- read their own history and admins can read all history.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coma_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS coma_last_account_activity_at timestamptz;

CREATE TABLE IF NOT EXISTS public.character_coma_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('entered', 'revived')),
  cause text,
  source text NOT NULL,
  coma_started_at timestamptz,
  account_last_activity_at timestamptz,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_character_coma_events_profile_created
  ON public.character_coma_events(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_character_coma_events_user_created
  ON public.character_coma_events(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_character_coma_entered_event
  ON public.character_coma_events(profile_id, event_type, coma_started_at)
  WHERE event_type = 'entered' AND coma_started_at IS NOT NULL;

ALTER TABLE public.character_coma_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players read own coma history" ON public.character_coma_events;
CREATE POLICY "Players read own coma history"
  ON public.character_coma_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read coma history" ON public.character_coma_events;
CREATE POLICY "Admins read coma history"
  ON public.character_coma_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.character_coma_events TO authenticated;
GRANT ALL ON public.character_coma_events TO service_role;

-- Backfill the current coma snapshot so existing dormant characters get a
-- useful support trail. For old neglect comas there is no reliable account
-- activity snapshot, so only the coma start is retained.
WITH account_activity AS (
  SELECT
    u.id AS user_id,
    GREATEST(u.last_sign_in_at, MAX(p2.last_login_at)) AS last_activity_at
  FROM auth.users u
  JOIN public.profiles p2
    ON p2.user_id = u.id
   AND p2.deleted_at IS NULL
  GROUP BY u.id, u.last_sign_in_at
)
UPDATE public.profiles p
   SET coma_started_at = COALESCE(p.coma_started_at, p.died_at),
       coma_last_account_activity_at = CASE
         WHEN p.death_cause ILIKE '%inactivity%'
           THEN COALESCE(
             p.coma_last_account_activity_at,
             LEAST(a.last_activity_at, p.died_at),
             p.last_login_at
           )
         ELSE p.coma_last_account_activity_at
       END
  FROM account_activity a
 WHERE p.user_id = a.user_id
   AND p.deleted_at IS NULL
   AND p.died_at IS NOT NULL
   AND (p.death_cause ILIKE '%inactivity%' OR p.death_cause = 'neglect');

INSERT INTO public.character_coma_events (
  profile_id,
  user_id,
  event_type,
  cause,
  source,
  coma_started_at,
  account_last_activity_at,
  metadata,
  created_at
)
SELECT
  p.id,
  p.user_id,
  'entered',
  p.death_cause,
  CASE WHEN p.death_cause = 'neglect' THEN 'legacy_backfill' ELSE 'inactivity_backfill' END,
  COALESCE(p.coma_started_at, p.died_at),
  p.coma_last_account_activity_at,
  jsonb_build_object('backfilled', true),
  COALESCE(p.coma_started_at, p.died_at, now())
FROM public.profiles p
WHERE p.deleted_at IS NULL
  AND p.died_at IS NOT NULL
  AND (p.death_cause ILIKE '%inactivity%' OR p.death_cause = 'neglect')
ON CONFLICT DO NOTHING;

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
  candidates AS (
    SELECT
      p.id,
      p.user_id,
      a.last_activity_at
    FROM public.profiles p
    JOIN account_activity a ON a.user_id = p.user_id
    WHERE p.deleted_at IS NULL
      AND p.died_at IS NULL
      AND a.last_activity_at < now() - interval '30 days'
  ),
  updated AS (
    UPDATE public.profiles p
       SET died_at = now(),
           is_active = false,
           death_cause = 'Coma (30 days inactivity)',
           coma_started_at = now(),
           coma_last_account_activity_at = c.last_activity_at,
           updated_at = now()
      FROM candidates c
     WHERE p.id = c.id
    RETURNING
      p.id,
      p.user_id,
      p.died_at,
      p.death_cause,
      p.coma_last_account_activity_at
  ),
  logged AS (
    INSERT INTO public.character_coma_events (
      profile_id,
      user_id,
      event_type,
      cause,
      source,
      coma_started_at,
      account_last_activity_at,
      metadata
    )
    SELECT
      u.id,
      u.user_id,
      'entered',
      u.death_cause,
      'scheduled_inactivity_check',
      u.died_at,
      u.coma_last_account_activity_at,
      jsonb_build_object('threshold_days', 30, 'activity_scope', 'account')
    FROM updated u
    ON CONFLICT DO NOTHING
    RETURNING id
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

CREATE OR REPLACE FUNCTION public.resurrect_character(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
    INTO v_profile
    FROM public.profiles
   WHERE id = p_profile_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_profile.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not your profile';
  END IF;

  IF v_profile.died_at IS NULL THEN
    RAISE EXCEPTION 'Character is not in a coma';
  END IF;

  UPDATE public.profiles
     SET is_active = false,
         updated_at = now()
   WHERE user_id = v_profile.user_id
     AND id <> p_profile_id
     AND is_active = true;

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
    'player_revival',
    COALESCE(v_profile.coma_started_at, v_profile.died_at),
    v_profile.coma_last_account_activity_at,
    auth.uid(),
    jsonb_build_object('health_restored', 100, 'energy_restored', 100)
  );

  UPDATE public.profiles
     SET died_at = NULL,
         death_cause = NULL,
         is_active = true,
         health = 100,
         energy = 100,
         rest_required_until = NULL,
         resurrection_lives = GREATEST(COALESCE(resurrection_lives, 0), 3),
         last_login_at = now(),
         coma_started_at = NULL,
         coma_last_account_activity_at = NULL,
         updated_at = now()
   WHERE id = p_profile_id;

  DELETE FROM public.hall_of_immortals
   WHERE profile_id = p_profile_id;
END;
$function$;

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

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
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
$function$;
