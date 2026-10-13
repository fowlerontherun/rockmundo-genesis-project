-- Make leadership, chemistry and audit history a single database transaction.
CREATE OR REPLACE FUNCTION public.transfer_band_leadership_atomic(
 p_band_id uuid, p_current_leader_id uuid, p_new_leader_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_band public.bands%ROWTYPE; v_new_chemistry numeric;
BEGIN
 IF auth.uid() IS NULL OR auth.uid()<>p_current_leader_id THEN
   RAISE EXCEPTION 'Only the signed-in current leader can transfer leadership';
 END IF;
 SELECT * INTO v_band FROM public.bands WHERE id=p_band_id FOR UPDATE;
 IF NOT FOUND OR v_band.leader_id IS DISTINCT FROM p_current_leader_id THEN
   RAISE EXCEPTION 'Only the current leader can transfer leadership';
 END IF;
 IF v_band.is_solo_artist THEN RAISE EXCEPTION 'Solo artist leadership cannot be transferred'; END IF;
 IF p_new_leader_id=p_current_leader_id OR NOT EXISTS (
   SELECT 1 FROM public.band_members
   WHERE band_id=p_band_id AND user_id=p_new_leader_id
     AND member_status='active' AND is_touring_member=false
 ) THEN RAISE EXCEPTION 'New leader must be a different active human band member'; END IF;
 v_new_chemistry:=greatest(0,least(100,coalesce(v_band.chemistry_level,0)-5));
 UPDATE public.bands SET leader_id=p_new_leader_id,
   chemistry_level=v_new_chemistry,last_chemistry_update=now() WHERE id=p_band_id;
 INSERT INTO public.band_chemistry_events(band_id,event_type,chemistry_change,event_data)
 VALUES(p_band_id,'conflict',-5,jsonb_build_object('from',p_current_leader_id,'to',p_new_leader_id,
   'description','New leader elected'));
 INSERT INTO public.band_history(band_id,event_type,triggered_by,event_data)
 VALUES(p_band_id,'leadership_transfer',p_current_leader_id,
   jsonb_build_object('new_leader_id',p_new_leader_id,'transferred_at',now()));
END $$;
REVOKE ALL ON FUNCTION public.transfer_band_leadership_atomic(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_band_leadership_atomic(uuid,uuid,uuid) TO authenticated;
