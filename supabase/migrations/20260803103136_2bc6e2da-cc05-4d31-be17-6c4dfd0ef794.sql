UPDATE public.profiles
SET is_active = false,
    updated_at = now()
WHERE user_id = 'eddd663a-ab81-4c39-bc03-4ac3a347095e'::uuid
  AND id <> '08bde4fa-689b-486c-82e3-afd18c166deb'::uuid;

UPDATE public.profiles
SET is_active = true,
    last_login_at = now(),
    updated_at = now()
WHERE id = '08bde4fa-689b-486c-82e3-afd18c166deb'::uuid
  AND user_id = 'eddd663a-ab81-4c39-bc03-4ac3a347095e'::uuid
  AND died_at IS NULL;