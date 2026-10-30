-- Live RLS/grant smoke: ordinary band members must never create arbitrary
-- earnings rows. Run as a trusted SQL operator; any unexpected acceptance is
-- deliberately rolled back by the nested exception block and fails the test.
DO $finance_rls$
DECLARE
  v_account uuid;
  v_band uuid;
  v_denied boolean := false;
BEGIN
  SELECT m.user_id,m.band_id INTO v_account,v_band
    FROM public.band_members m
    WHERE m.user_id IS NOT NULL AND m.member_status='active'
    ORDER BY m.band_id,m.user_id LIMIT 1;
  IF v_account IS NULL OR v_band IS NULL THEN
    RAISE EXCEPTION 'No active band-member account for finance RLS test';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_account::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF current_user<>'authenticated' THEN
    RAISE EXCEPTION 'RLS test must impersonate the real authenticated SQL role';
  END IF;

  BEGIN
    INSERT INTO public.band_earnings(
      band_id,amount,source,description,metadata
    ) VALUES (
      v_band,1,'streaming','forged browser earning','{}'::jsonb
    );
    RAISE EXCEPTION 'Client forged earning INSERT was accepted'
      USING ERRCODE='PZX01';
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;

  IF NOT v_denied THEN
    RAISE EXCEPTION 'Direct client band-earnings INSERT must be denied';
  END IF;
END $finance_rls$;
