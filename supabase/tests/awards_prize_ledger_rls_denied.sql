-- Regression: a real authenticated band member cannot forge an award prize.
-- This intentionally attempts only a DENIED INSERT. Unexpected acceptance raises
-- an exception, aborting and rolling back the entire statement.
-- Requires a trusted SQL operator who may SET LOCAL ROLE authenticated.
DO $rls_awards$
DECLARE
  test_user uuid;
  test_band uuid;
  was_denied boolean := false;
BEGIN
  SELECT bm.user_id, bm.band_id INTO test_user, test_band
    FROM public.band_members bm
    WHERE bm.user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.bands b WHERE b.id=bm.band_id)
    ORDER BY bm.id LIMIT 1;
  IF test_user IS NULL THEN
    RAISE EXCEPTION 'No band member found to test awards source restriction';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',test_user::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'Test must execute with actual authenticated RLS role';
  END IF;

  BEGIN
    INSERT INTO public.band_earnings(band_id,amount,source,metadata)
    VALUES(test_band,1,'award_show_prize','{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN
    was_denied:=true;
  END;

  IF NOT was_denied THEN
    RAISE EXCEPTION 'SECURITY REGRESSION: forged award prize earnings accepted';
  END IF;
  RAISE NOTICE 'PASS: member cannot insert award_show_prize into band_earnings';
END $rls_awards$;
