DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.band_members bm
  WHERE bm.band_id = '3b6c8c60-7e8e-456d-858a-d6f1dcb9a296'::uuid
    AND bm.profile_id IN (
      '69e017e7-8bfb-4eb6-ae45-a0c56f0b0a8e'::uuid,
      '08bde4fa-689b-486c-82e3-afd18c166deb'::uuid,
      '8c8a7d7c-8925-483b-ba3f-3be4df497e85'::uuid
    )
    AND bm.member_status = 'active';

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'War Dogs recovery verification failed: expected 3 linked members, found %', v_count;
  END IF;
END;
$$;