-- Create the process_radio_submission function
CREATE OR REPLACE FUNCTION public.process_radio_submission(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_submission RECORD;
  v_result jsonb;
BEGIN
  -- Get the submission
  SELECT rs.*, s.title as song_title, s.genre as song_genre, s.quality_score,
         rst.name as station_name, rst.accepted_genres, rst.minimum_quality_level
  INTO v_submission
  FROM radio_submissions rs
  JOIN songs s ON s.id = rs.song_id
  JOIN radio_stations rst ON rst.id = rs.station_id
  WHERE rs.id = p_submission_id;
  
  IF v_submission IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission not found');
  END IF;
  
  -- Check if already processed
  IF v_submission.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission already processed');
  END IF;
  
  -- Update submission status to pending (it's already pending, but this confirms it was processed)
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