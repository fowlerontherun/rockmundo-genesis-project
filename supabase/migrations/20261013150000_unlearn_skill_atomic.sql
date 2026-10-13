CREATE OR REPLACE FUNCTION public.unlearn_skill_atomic(p_profile_id uuid,p_skill_slug text,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_skill public.skill_progress%ROWTYPE;v_refund integer;v_invested integer;v_requirements integer[]:=ARRAY[120,148,176,204,232,260,289,318,348,377,406,436,465,494,524,553,582,612,641,670];v_level integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'PROFILE_NOT_OWNED' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_METADATA';END IF;
 PERFORM 1 FROM public.player_xp_wallet WHERE profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'XP_WALLET_MISSING';END IF;
 SELECT * INTO v_skill FROM public.skill_progress WHERE profile_id=p_profile_id AND skill_slug=p_skill_slug FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SKILL_PROGRESS_NOT_FOUND'; END IF;
 v_invested:=greatest(0,coalesce(v_skill.current_xp,0));
 FOR v_level IN 0..least(greatest(0,coalesce(v_skill.current_level,0))-1,100) LOOP
   v_invested:=v_invested + v_requirements[least(v_level+1,20)];
 END LOOP;
 IF v_invested<=0 THEN RAISE EXCEPTION 'NOTHING_TO_UNLEARN'; END IF;
 v_refund:=floor(v_invested*0.8);
 UPDATE public.skill_progress SET current_xp=0,current_level=0,required_xp=120,
 last_practiced_at=now(),metadata=p_metadata || jsonb_build_object('unlearned_at',now(),'refunded_xp',v_refund)
 WHERE profile_id=p_profile_id AND skill_slug=p_skill_slug;
 UPDATE public.player_xp_wallet SET skill_xp_balance=coalesce(skill_xp_balance,0)+v_refund,
 xp_balance=coalesce(xp_balance,0)+v_refund,
 skill_xp_spent=greatest(0,coalesce(skill_xp_spent,0)-v_refund),
 xp_spent=greatest(0,coalesce(xp_spent,0)-v_refund),last_recalculated=now()
 WHERE profile_id=p_profile_id;
 RETURN v_refund;
END $$;
REVOKE ALL ON FUNCTION public.unlearn_skill_atomic(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.unlearn_skill_atomic(uuid,text,jsonb) TO authenticated;
