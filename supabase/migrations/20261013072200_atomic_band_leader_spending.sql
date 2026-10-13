-- Paid recruitment advertisements: lock and debit band funds in the same transaction as the ad.
CREATE OR REPLACE FUNCTION public.post_band_recruitment_ad_atomic(
  p_band_id uuid, p_profile_id uuid, p_budget integer,
  p_instrument text, p_vocal text DEFAULT NULL, p_description text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_balance bigint; v_ad uuid; v_boost numeric;
BEGIN
 IF auth.uid() IS NULL OR p_profile_id IS NULL OR p_band_id IS NULL OR
   p_budget IS NULL OR p_budget <= 0 OR p_budget > 100000 OR
   NULLIF(btrim(p_instrument),'') IS NULL THEN
   RAISE EXCEPTION 'Invalid recruitment advertisement request';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id AND p.user_id=auth.uid()) THEN
   RAISE EXCEPTION 'Character is not owned by user';
 END IF;
 SELECT COALESCE(b.band_balance,0) INTO v_balance FROM public.bands b
   WHERE b.id=p_band_id AND b.leader_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only the band leader can purchase recruitment adverts'; END IF;
 IF v_balance < p_budget THEN RAISE EXCEPTION 'Insufficient band funds'; END IF;
 v_boost := CASE WHEN p_budget>=2000 THEN 3.0 WHEN p_budget>=1000 THEN 2.0
                 WHEN p_budget>=500 THEN 1.5 ELSE 1.0 END;
 -- Band balance is a projection of band_earnings: charge through its ledger trigger.
 INSERT INTO public.band_earnings(band_id,amount,source,description,earned_by_user_id,profile_id)
 VALUES(p_band_id,-p_budget,'recruitment_ad','Paid recruitment advert',p_profile_id,p_profile_id);
 INSERT INTO public.band_member_ads(band_id,posted_by_profile_id,instrument_role,vocal_role,
   description,budget_spent,visibility_boost)
 VALUES(p_band_id,p_profile_id,p_instrument,NULLIF(p_vocal,'none'),NULLIF(p_description,''),
   p_budget,v_boost) RETURNING id INTO v_ad;
 RETURN v_ad;
END; $$;
REVOKE ALL ON FUNCTION public.post_band_recruitment_ad_atomic(uuid,uuid,integer,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_band_recruitment_ad_atomic(uuid,uuid,integer,text,text,text) TO authenticated;

-- Leader manual fund transfers: the band_earnings trigger manages band_balance.
-- Any failure rolls back both the wallet change and ledger entry.
CREATE OR REPLACE FUNCTION public.transfer_band_leader_funds_atomic(
  p_band_id uuid, p_profile_id uuid, p_amount integer,
  p_direction text, p_note text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_balance bigint; v_cash bigint; v_delta bigint;
BEGIN
 IF auth.uid() IS NULL OR p_band_id IS NULL OR p_profile_id IS NULL
   OR p_amount IS NULL OR p_amount<=0 OR p_amount>100000000
   OR p_direction NOT IN ('deposit','withdraw') THEN
   RAISE EXCEPTION 'Invalid band transfer request';
 END IF;
 SELECT COALESCE(b.band_balance,0) INTO v_balance FROM public.bands b
   WHERE b.id=p_band_id AND b.leader_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only the band leader can manage band funds'; END IF;
 SELECT cash INTO v_cash FROM public.profiles
   WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Character not found'; END IF;
 v_delta:=CASE WHEN p_direction='deposit' THEN p_amount ELSE -p_amount END;
 IF p_direction='deposit' AND v_cash<p_amount THEN
   RAISE EXCEPTION 'Insufficient personal funds';
 END IF;
 IF p_direction='withdraw' AND v_balance<p_amount THEN
   RAISE EXCEPTION 'Insufficient band funds';
 END IF;
 UPDATE public.profiles SET cash=cash-v_delta WHERE id=p_profile_id;
 INSERT INTO public.band_earnings(band_id,amount,source,description,earned_by_user_id,profile_id)
 VALUES(p_band_id,v_delta,
        CASE WHEN p_direction='deposit' THEN 'leader_deposit' ELSE 'leader_withdrawal' END,
        LEFT(NULLIF(p_note,''),400),p_profile_id,p_profile_id);
 RETURN (SELECT COALESCE(band_balance,0) FROM public.bands WHERE id=p_band_id);
END; $$;
REVOKE ALL ON FUNCTION public.transfer_band_leader_funds_atomic(uuid,uuid,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_band_leader_funds_atomic(uuid,uuid,integer,text,text) TO authenticated;
