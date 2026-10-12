-- Legacy inventory book completion must never be committed before its XP award.
CREATE OR REPLACE FUNCTION public.complete_legacy_skill_book_atomic(p_profile_id uuid,p_book_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_profile public.profiles%rowtype;v_book public.player_skill_books%rowtype;
 v_event jsonb;v_reward integer;
BEGIN
 SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'legacy_book_profile_not_owned'; END IF;
 SELECT * INTO v_book FROM public.player_skill_books WHERE id=p_book_id AND profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'legacy_book_not_owned'; END IF;
 IF v_book.completed_at IS NOT NULL THEN RAISE EXCEPTION 'legacy_book_already_completed'; END IF;
 v_reward:=coalesce(v_book.xp_reward,0);
 IF v_reward<=0 OR v_reward>5000 THEN RAISE EXCEPTION 'legacy_book_xp_invalid'; END IF;
 -- Both the progression event and completion marker share one SQL transaction.
 v_event:=public.progression_award_action_xp(p_profile_id,v_reward,'education','book_reading',
 jsonb_build_object('book_id',v_book.book_id,'book_title',v_book.book_title,
 'skill_focus',v_book.skill_focus,'unique_event_id','legacy-book:'||v_book.id::text));
 UPDATE public.player_skill_books SET completed_at=now(),progress_percentage=100
 WHERE id=v_book.id AND completed_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'legacy_book_completion_race'; END IF;
 RETURN jsonb_build_object('success',true,'xpAwarded',v_reward,'bookId',v_book.book_id);
END $$;
REVOKE ALL ON FUNCTION public.complete_legacy_skill_book_atomic(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_legacy_skill_book_atomic(uuid,uuid) TO authenticated;
