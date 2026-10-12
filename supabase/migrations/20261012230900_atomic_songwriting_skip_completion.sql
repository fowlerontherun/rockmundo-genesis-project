-- Skipping final polish and completing the project are a single user action.
-- An exception in song creation rolls back the polish decision, leaving a clean retry.
CREATE OR REPLACE FUNCTION public.skip_and_complete_songwriting_project(
 p_profile_id uuid,p_project_id uuid,p_catalog_status text DEFAULT 'private',p_band_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
DECLARE v_skip jsonb;v_result jsonb;
BEGIN
 v_skip:=public.skip_songwriting_polish(p_profile_id,p_project_id);
 v_result:=public.complete_songwriting_project(p_profile_id,p_project_id,p_catalog_status,p_band_id);
 IF v_result IS NULL OR nullif(v_result->>'song_id','') IS NULL THEN
  RAISE EXCEPTION 'songwriting_conversion_not_confirmed';
 END IF;
 RETURN v_result||jsonb_build_object('polishSkipped',true);
END $$;
REVOKE ALL ON FUNCTION public.skip_and_complete_songwriting_project(uuid,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.skip_and_complete_songwriting_project(uuid,uuid,text,uuid) TO authenticated;
