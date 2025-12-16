-- Drop and recreate auto_complete_manufacturing with correct return type
DROP FUNCTION IF EXISTS public.auto_complete_manufacturing();

CREATE FUNCTION public.auto_complete_manufacturing()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed INTEGER := 0;
  v_release RECORD;
BEGIN
  FOR v_release IN
    SELECT id, band_id, user_id, title
    FROM releases
    WHERE release_status = 'manufacturing'
      AND manufacturing_complete_at IS NOT NULL
      AND manufacturing_complete_at <= NOW()
      AND (scheduled_release_date IS NULL OR scheduled_release_date <= CURRENT_DATE)
  LOOP
    UPDATE releases
    SET release_status = 'released', updated_at = NOW()
    WHERE id = v_release.id;
    
    INSERT INTO activity_feed (user_id, activity_type, message, metadata)
    VALUES (
      v_release.user_id,
      'release_complete',
      'Release "' || v_release.title || '" has completed manufacturing!',
      jsonb_build_object('release_id', v_release.id, 'title', v_release.title)
    );
    
    v_completed := v_completed + 1;
  END LOOP;
  
  RETURN v_completed;
END;
$$;