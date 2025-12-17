-- Fix process_radio_submission to match current radio_stations schema
CREATE OR REPLACE FUNCTION public.process_radio_submission(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_submission RECORD;
BEGIN
  -- Get the submission + related station/song info (only columns that exist)
  SELECT rs.*, 
         s.title AS song_title,
         s.genre AS song_genre,
         s.quality_score AS song_quality_score,
         rst.name AS station_name,
         rst.accepted_genres,
         rst.quality_level AS station_quality_level
  INTO v_submission
  FROM radio_submissions rs
  JOIN songs s ON s.id = rs.song_id
  JOIN radio_stations rst ON rst.id = rs.station_id
  WHERE rs.id = p_submission_id;

  IF v_submission IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission not found');
  END IF;

  IF v_submission.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission already processed');
  END IF;

  -- No auto-acceptance logic here yet; just confirm the submission is queued.
  UPDATE radio_submissions
  SET submitted_at = COALESCE(submitted_at, NOW())
  WHERE id = p_submission_id;

  RETURN jsonb_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'song_title', v_submission.song_title,
    'station_name', v_submission.station_name,
    'status', 'pending'
  );
END;
$$;