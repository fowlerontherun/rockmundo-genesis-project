WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
         ) AS position
  FROM public.profiles
  WHERE is_active = true
    AND died_at IS NULL
)
UPDATE public.profiles p
SET is_active = false,
    updated_at = now()
FROM ranked r
WHERE p.id = r.id
  AND r.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_active_living_character_per_user
ON public.profiles (user_id)
WHERE is_active = true AND died_at IS NULL;