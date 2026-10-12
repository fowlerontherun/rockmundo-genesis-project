-- Contracts no longer rely on a mounted browser and JS timeout for a reply.
-- Serializing on the contract row prevents stale counteroffers overwriting newer terms.
CREATE OR REPLACE FUNCTION public.submit_label_counteroffer_atomic(
 p_contract_id uuid,p_expected_counter_count integer,p_terms jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.artist_label_contracts%rowtype;v_profile uuid:=public._caller_profile_id();
 v_count integer;v_rate numeric;v_adv numeric;v_roy numeric;v_singles integer;v_albums integer;
 v_new_adv numeric;v_new_roy numeric;v_new_single integer;v_new_album integer;
BEGIN
 IF auth.uid() IS NULL OR v_profile IS NULL THEN RAISE EXCEPTION 'character_required'; END IF;
 SELECT * INTO v FROM public.artist_label_contracts WHERE id=p_contract_id FOR UPDATE;
 IF NOT FOUND OR v.status<>'offered' THEN RAISE EXCEPTION 'contract_not_available_for_counter'; END IF;
 IF v.band_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.bands b WHERE b.id=v.band_id AND
    (b.leader_id IN (auth.uid(),v_profile) OR EXISTS(SELECT 1 FROM public.band_members bm
     WHERE bm.band_id=b.id AND bm.user_id=auth.uid() AND lower(bm.role) IN ('founder','leader','manager'))))
  THEN RAISE EXCEPTION 'band_leadership_required'; END IF;
 ELSIF v.artist_profile_id IS DISTINCT FROM v_profile THEN RAISE EXCEPTION 'solo_artist_required'; END IF;
 IF coalesce(v.counter_count,0)<>p_expected_counter_count THEN RAISE EXCEPTION 'stale_contract_terms'; END IF;
 IF coalesce(v.counter_count,0)>=3 THEN RAISE EXCEPTION 'negotiation_limit_reached'; END IF;
 v_adv:=(p_terms->>'advance_amount')::numeric;
 v_roy:=(p_terms->>'royalty_artist_pct')::numeric;
 v_singles:=(p_terms->>'single_quota')::integer;
 v_albums:=(p_terms->>'album_quota')::integer;
 IF v_adv NOT BETWEEN 0 AND 100000000 OR v_roy NOT BETWEEN 0 AND 100
 OR v_singles NOT BETWEEN 0 AND 200 OR v_albums NOT BETWEEN 0 AND 200
 THEN RAISE EXCEPTION 'invalid_counter_terms'; END IF;
 v_count:=coalesce(v.counter_count,0)+1;
 IF v_count>=3 THEN
  UPDATE public.artist_label_contracts SET status='rejected',counter_count=v_count,last_action_by='label'
  WHERE id=v.id;
  RETURN jsonb_build_object('status','rejected','counterCount',v_count);
 END IF;
 v_rate:=CASE WHEN v_count=1 THEN 0.45 ELSE 0.30 END;
 v_new_adv:=round(coalesce(v.original_advance,v.advance_amount) +
  (v_adv-coalesce(v.original_advance,v.advance_amount))*v_rate);
 v_new_roy:=round(coalesce(v.original_royalty_pct,v.royalty_artist_pct) +
  (v_roy-coalesce(v.original_royalty_pct,v.royalty_artist_pct))*v_rate);
 v_new_single:=greatest(1,round(coalesce(v.original_single_quota,v.single_quota) +
  (v_singles-coalesce(v.original_single_quota,v.single_quota))*v_rate)::integer);
 v_new_album:=greatest(0,round(coalesce(v.original_album_quota,v.album_quota) +
  (v_albums-coalesce(v.original_album_quota,v.album_quota))*v_rate)::integer);
 UPDATE public.artist_label_contracts SET
  original_advance=coalesce(v.original_advance,v.advance_amount),
  original_royalty_pct=coalesce(v.original_royalty_pct,v.royalty_artist_pct),
  original_single_quota=coalesce(v.original_single_quota,v.single_quota),
  original_album_quota=coalesce(v.original_album_quota,v.album_quota),
  advance_amount=v_new_adv,royalty_artist_pct=v_new_roy,
  royalty_label_pct=100-v_new_roy,single_quota=v_new_single,
  album_quota=v_new_album,status='offered',last_action_by='label',
  counter_count=v_count WHERE id=v.id;
 RETURN jsonb_build_object('status','offered','counterCount',v_count);
END $$;

REVOKE ALL ON FUNCTION public.submit_label_counteroffer_atomic(uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_label_counteroffer_atomic(uuid,integer,jsonb) TO authenticated;
