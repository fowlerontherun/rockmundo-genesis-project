-- Fix auto_complete_manufacturing to handle null user_id by using band leader as fallback
CREATE OR REPLACE FUNCTION public.auto_complete_manufacturing()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed INTEGER := 0;
  v_release RECORD;
  v_user_id UUID;
BEGIN
  FOR v_release IN
    SELECT r.id, r.band_id, r.user_id, r.title, b.leader_id
    FROM releases r
    LEFT JOIN bands b ON r.band_id = b.id
    WHERE r.release_status = 'manufacturing'
      AND r.manufacturing_complete_at IS NOT NULL
      AND r.manufacturing_complete_at <= NOW()
      AND (r.scheduled_release_date IS NULL OR r.scheduled_release_date <= CURRENT_DATE)
  LOOP
    -- Use release user_id if available, otherwise use band leader_id
    v_user_id := COALESCE(v_release.user_id, v_release.leader_id);
    
    UPDATE releases
    SET release_status = 'released', updated_at = NOW()
    WHERE id = v_release.id;
    
    -- Only insert activity if we have a valid user_id
    IF v_user_id IS NOT NULL THEN
      INSERT INTO activity_feed (user_id, activity_type, message, metadata)
      VALUES (
        v_user_id,
        'release_complete',
        'Release "' || v_release.title || '" has completed manufacturing!',
        jsonb_build_object('release_id', v_release.id, 'title', v_release.title)
      );
    END IF;
    
    v_completed := v_completed + 1;
  END LOOP;
  
  RETURN v_completed;
END;
$$;