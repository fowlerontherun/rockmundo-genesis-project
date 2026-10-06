WITH corrected AS (
  SELECT
    p.id AS profile_id,
    MAX(s.last_login_at) FILTER (WHERE s.last_login_at <= p.died_at) AS last_activity_before_coma
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN public.profiles s
    ON s.user_id = p.user_id
   AND s.deleted_at IS NULL
  WHERE p.deleted_at IS NULL
    AND p.died_at IS NOT NULL
    AND p.death_cause = 'Coma (extended inactivity)'
    AND u.last_sign_in_at > p.died_at
  GROUP BY p.id
),
updated_profiles AS (
  UPDATE public.profiles p
     SET coma_last_account_activity_at = c.last_activity_before_coma,
         updated_at = now()
    FROM corrected c
   WHERE p.id = c.profile_id
     AND c.last_activity_before_coma IS NOT NULL
  RETURNING p.id, p.coma_started_at, p.coma_last_account_activity_at
)
UPDATE public.character_coma_events e
   SET account_last_activity_at = u.coma_last_account_activity_at
  FROM updated_profiles u
 WHERE e.profile_id = u.id
   AND e.event_type = 'entered'
   AND e.source = 'inactivity_backfill'
   AND e.coma_started_at = u.coma_started_at;