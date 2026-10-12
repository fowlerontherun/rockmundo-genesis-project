-- Single character lock guards new and resumed reading sessions.
CREATE OR REPLACE FUNCTION public.start_book_reading_atomic(
 p_profile_id uuid,p_purchase_id uuid,p_book_id uuid,p_auto_read boolean DEFAULT false)
RETURNS public.player_book_reading_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile public.profiles%rowtype;v_book public.skill_books%rowtype;
 v_previous public.player_book_reading_sessions%rowtype;v_result public.player_book_reading_sessions%rowtype;
 v_remaining integer;
BEGIN
 SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reading_profile_not_owned'; END IF;
 SELECT * INTO v_book FROM public.skill_books WHERE id=p_book_id AND is_active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'reading_book_not_available'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.player_book_purchases
 WHERE id=p_purchase_id AND book_id=p_book_id AND profile_id=p_profile_id AND is_read=false)
 THEN RAISE EXCEPTION 'reading_book_not_owned_or_completed'; END IF;
 IF NOT public.skill_tier_unlocked(p_profile_id,v_book.skill_slug)
 THEN RAISE EXCEPTION 'reading_skill_tier_locked'; END IF;
 IF EXISTS (SELECT 1 FROM public.player_book_reading_sessions WHERE profile_id=p_profile_id
 AND status='reading') THEN RAISE EXCEPTION 'already_reading_another_book'; END IF;
 SELECT * INTO v_previous FROM public.player_book_reading_sessions
 WHERE profile_id=p_profile_id AND purchase_id=p_purchase_id AND book_id=p_book_id
 AND status='abandoned' ORDER BY started_at DESC,id LIMIT 1 FOR UPDATE;
 v_remaining:=greatest(1,coalesce(v_book.base_reading_days,1)-greatest(0,coalesce(v_previous.days_read,0)));
 IF v_previous.id IS NOT NULL THEN
  UPDATE public.player_book_reading_sessions SET status='reading',auto_read=p_auto_read,
   scheduled_end_date=now()+make_interval(days=>v_remaining),updated_at=now()
   WHERE id=v_previous.id RETURNING * INTO v_result;
 ELSE
  INSERT INTO public.player_book_reading_sessions
  (user_id,profile_id,book_id,purchase_id,scheduled_end_date,auto_read)
  VALUES(v_profile.user_id,p_profile_id,p_book_id,p_purchase_id,
  now()+make_interval(days=>v_remaining),p_auto_read) RETURNING * INTO v_result;
 END IF;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.start_book_reading_atomic(uuid,uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_book_reading_atomic(uuid,uuid,uuid,boolean) TO authenticated;
