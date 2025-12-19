-- Drop and recreate admin_force_complete_release function
-- to bypass manufacturing date check during force completion
DROP FUNCTION IF EXISTS public.admin_force_complete_release(UUID);

CREATE FUNCTION public.admin_force_complete_release(p_release_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE releases
  SET 
    release_status = 'released',
    manufacturing_complete_at = NOW(), -- Always set to NOW() to bypass trigger check
    updated_at = NOW()
  WHERE id = p_release_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Release not found: %', p_release_id;
  END IF;
END;
$$;