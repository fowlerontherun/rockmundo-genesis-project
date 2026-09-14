CREATE OR REPLACE FUNCTION public.auto_complete_manufacturing()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_completed INTEGER := 0;
  v_release RECORD;
  v_user_id UUID;
BEGIN
  -- Complete additional/reordered formats on releases that are already released.
  UPDATE public.release_formats rf
  SET
    manufacturing_status = 'completed',
    manufacturing_completion_date = COALESCE(rf.manufacturing_completion_date, rf.release_date, NOW())
  FROM public.releases r
  WHERE r.id = rf.release_id
    AND r.release_status = 'released'
    AND rf.manufacturing_status IN ('pending', 'in_progress', 'manufacturing')
    AND COALESCE(rf.manufacturing_completion_date, rf.release_date) IS NOT NULL
    AND COALESCE(rf.manufacturing_completion_date, rf.release_date) <= NOW();

  FOR v_release IN
    SELECT r.id, r.band_id, r.user_id, r.title, b.leader_id
    FROM public.releases r
    LEFT JOIN public.bands b ON r.band_id = b.id
    WHERE r.release_status = 'manufacturing'
      AND r.manufacturing_complete_at IS NOT NULL
      AND r.manufacturing_complete_at <= NOW()
      AND (r.scheduled_release_date IS NULL OR r.scheduled_release_date <= CURRENT_DATE)
    FOR UPDATE OF r
  LOOP
    v_user_id := COALESCE(v_release.user_id, v_release.leader_id);

    UPDATE public.releases
    SET release_status = 'released', updated_at = NOW()
    WHERE id = v_release.id;

    -- The parent release only becomes released once its manufacturing window is complete,
    -- so all formats created as part of that release are now complete as well.
    UPDATE public.release_formats
    SET
      manufacturing_status = 'completed',
      manufacturing_completion_date = COALESCE(manufacturing_completion_date, NOW())
    WHERE release_id = v_release.id
      AND manufacturing_status IN ('pending', 'in_progress', 'manufacturing');

    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.activity_feed (user_id, activity_type, message, metadata)
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
$function$;

-- Repair legacy rows that are already overdue on released parent releases.
UPDATE public.release_formats rf
SET
  manufacturing_status = 'completed',
  manufacturing_completion_date = COALESCE(rf.manufacturing_completion_date, rf.release_date, NOW())
FROM public.releases r
WHERE r.id = rf.release_id
  AND r.release_status = 'released'
  AND rf.manufacturing_status IN ('pending', 'in_progress', 'manufacturing')
  AND COALESCE(rf.manufacturing_completion_date, rf.release_date) IS NOT NULL
  AND COALESCE(rf.manufacturing_completion_date, rf.release_date) <= NOW();
