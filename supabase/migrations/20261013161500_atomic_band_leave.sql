-- Lock membership, adjust ownership, chemistry and history as one operation.
CREATE OR REPLACE FUNCTION public.leave_band_atomic(p_band_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_user uuid:=auth.uid();v_band public.bands%ROWTYPE;v_affected integer;v_delta integer:=-10;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO v_band FROM public.bands WHERE id=p_band_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BAND_NOT_FOUND';END IF;
 IF v_band.leader_id=v_user THEN RAISE EXCEPTION 'TRANSFER_LEADERSHIP_FIRST';END IF;
 IF coalesce(v_band.is_solo_artist,false) THEN RAISE EXCEPTION 'SOLO_ARTIST_CANNOT_LEAVE';END IF;
 DELETE FROM public.band_members WHERE band_id=p_band_id AND user_id=v_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOT_A_BAND_MEMBER';END IF;
 UPDATE public.band_song_ownership
 SET ownership_percentage=original_percentage*0.30,is_active_member=false,role='former_member'
 WHERE band_id=p_band_id AND user_id=v_user AND is_active_member IS DISTINCT FROM false;
 GET DIAGNOSTICS v_affected=ROW_COUNT;
 UPDATE public.bands SET chemistry_level=greatest(0,coalesce(chemistry_level,0)+v_delta),
 last_chemistry_update=now() WHERE id=p_band_id;
 INSERT INTO public.band_chemistry_events(band_id,event_type,chemistry_change,event_data)
 VALUES(p_band_id,'member_left',v_delta,jsonb_build_object('userId',v_user,'description','Member left the band'));
 INSERT INTO public.band_history(band_id,event_type,triggered_by,event_data)
 VALUES(p_band_id,'ownership_adjusted',v_user,
 jsonb_build_object('action','member_left','affected_songs',v_affected,'new_retention_rate',30));
 INSERT INTO public.band_history(band_id,event_type,triggered_by,event_data)
 VALUES(p_band_id,'member_left',v_user,jsonb_build_object('left_at',now()));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.leave_band_atomic(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.leave_band_atomic(uuid) TO authenticated;
