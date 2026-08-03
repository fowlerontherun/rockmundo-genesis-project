CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY (COALESCE(p.is_active, false)) DESC, p.created_at DESC
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public._caller_profile_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_pid UUID;
BEGIN
  SELECT p.id INTO v_pid
  FROM public.profiles p
  WHERE p.user_id = auth.uid() AND COALESCE(p.is_active, false)
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_pid IS NULL THEN
    SELECT p.id INTO v_pid
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  RETURN v_pid;
END; $function$;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._caller_profile_id() TO authenticated, service_role;