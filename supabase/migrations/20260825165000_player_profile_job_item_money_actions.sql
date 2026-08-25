BEGIN;

CREATE OR REPLACE FUNCTION public.is_company_manager(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.companies c WHERE c.id=p_company_id AND c.owner_id=auth.uid())
  OR EXISTS(
    SELECT 1 FROM public.company_employees ce
    JOIN public.profiles p ON p.id=ce.profile_id
    WHERE ce.company_id=p_company_id AND p.user_id=auth.uid() AND ce.status='active'
      AND lower(coalesce(ce.role,'')) IN ('manager','assistant_manager','owner','director')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_company_manager(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.player_social_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transfer_type text NOT NULL CHECK (transfer_type IN ('money','equipment')),
  amount bigint,
  equipment_inventory_id uuid,
  equipment_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_social_transfers_not_self CHECK (sender_profile_id <> recipient_profile_id),
  CONSTRAINT player_social_transfers_payload_check CHECK (
    (transfer_type='money' AND amount IS NOT NULL AND amount>0)
    OR (transfer_type='equipment' AND equipment_inventory_id IS NOT NULL AND equipment_id IS NOT NULL)
  )
);
ALTER TABLE public.player_social_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players view their social transfers" ON public.player_social_transfers;
CREATE POLICY "Players view their social transfers" ON public.player_social_transfers FOR SELECT TO authenticated
USING (
  sender_profile_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid())
  OR recipient_profile_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid())
);
GRANT SELECT ON public.player_social_transfers TO authenticated;
GRANT ALL ON public.player_social_transfers TO service_role;

CREATE OR REPLACE FUNCTION public.send_money_to_player(target_profile_id uuid, amount bigint, sender_profile_id uuid DEFAULT NULL, note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sender uuid:=coalesce(sender_profile_id,public.current_profile_id()); v_sender_cash bigint; v_recipient_user uuid; v_transfer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_sender IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_sender AND p.user_id=auth.uid() AND p.died_at IS NULL) THEN RAISE EXCEPTION 'Active character is not available'; END IF;
  IF target_profile_id IS NULL OR target_profile_id=v_sender THEN RAISE EXCEPTION 'Choose another player'; END IF;
  SELECT user_id INTO v_recipient_user FROM public.profiles WHERE id=target_profile_id AND died_at IS NULL AND deleted_at IS NULL;
  IF v_recipient_user IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF public.are_profiles_blocked(v_sender,target_profile_id) THEN RAISE EXCEPTION 'This player is unavailable'; END IF;
  IF amount IS NULL OR amount<1 THEN RAISE EXCEPTION 'Amount must be at least 1'; END IF;
  IF amount>1000000 THEN RAISE EXCEPTION 'A single player transfer cannot exceed 1,000,000'; END IF;
  PERFORM 1 FROM public.profiles WHERE id IN(v_sender,target_profile_id) ORDER BY id FOR UPDATE;
  SELECT cash INTO v_sender_cash FROM public.profiles WHERE id=v_sender;
  IF coalesce(v_sender_cash,0)<amount THEN RAISE EXCEPTION 'Insufficient personal funds'; END IF;
  UPDATE public.profiles SET cash=cash-amount WHERE id=v_sender;
  UPDATE public.profiles SET cash=cash+amount WHERE id=target_profile_id;
  INSERT INTO public.player_social_transfers(sender_profile_id,recipient_profile_id,transfer_type,amount,note)
  VALUES(v_sender,target_profile_id,'money',amount,nullif(btrim(note),'')) RETURNING id INTO v_transfer_id;
  RETURN jsonb_build_object('transfer_id',v_transfer_id,'amount',amount,'sender_balance',v_sender_cash-amount);
END $$;
GRANT EXECUTE ON FUNCTION public.send_money_to_player(uuid,bigint,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_transferable_equipment(sender_profile_id uuid DEFAULT NULL)
RETURNS TABLE(inventory_id uuid,equipment_id uuid,name text,category text,condition integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sender uuid:=coalesce(sender_profile_id,public.current_profile_id()); v_user uuid;
BEGIN
  SELECT p.user_id INTO v_user FROM public.profiles p WHERE p.id=v_sender AND p.user_id=auth.uid() AND p.died_at IS NULL;
  IF v_user IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT pei.id,pei.equipment_id,ec.name,ec.category,coalesce(pei.condition,100)
    FROM public.player_equipment_inventory pei JOIN public.equipment_catalog ec ON ec.id=pei.equipment_id
    WHERE pei.user_id=v_user AND coalesce(pei.is_equipped,false)=false
    ORDER BY ec.name,pei.created_at;
END $$;
GRANT EXECUTE ON FUNCTION public.list_transferable_equipment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_equipment_to_player(target_profile_id uuid, inventory_id uuid, sender_profile_id uuid DEFAULT NULL, note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sender uuid:=coalesce(sender_profile_id,public.current_profile_id()); v_sender_user uuid; v_recipient_user uuid; v_equipment uuid; v_equipment_name text; v_transfer_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT p.user_id INTO v_sender_user FROM public.profiles p WHERE p.id=v_sender AND p.user_id=auth.uid() AND p.died_at IS NULL;
  IF v_sender_user IS NULL THEN RAISE EXCEPTION 'Active character is not available'; END IF;
  IF target_profile_id IS NULL OR target_profile_id=v_sender THEN RAISE EXCEPTION 'Choose another player'; END IF;
  SELECT p.user_id INTO v_recipient_user FROM public.profiles p WHERE p.id=target_profile_id AND p.died_at IS NULL AND p.deleted_at IS NULL;
  IF v_recipient_user IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF v_recipient_user=v_sender_user THEN RAISE EXCEPTION 'Equipment is shared between characters on the same account'; END IF;
  IF public.are_profiles_blocked(v_sender,target_profile_id) THEN RAISE EXCEPTION 'This player is unavailable'; END IF;
  SELECT pei.equipment_id,ec.name INTO v_equipment,v_equipment_name
  FROM public.player_equipment_inventory pei JOIN public.equipment_catalog ec ON ec.id=pei.equipment_id
  WHERE pei.id=inventory_id AND pei.user_id=v_sender_user AND coalesce(pei.is_equipped,false)=false FOR UPDATE;
  IF v_equipment IS NULL THEN RAISE EXCEPTION 'That item is no longer available to send'; END IF;
  UPDATE public.player_equipment_inventory SET user_id=v_recipient_user,is_equipped=false,updated_at=now() WHERE id=inventory_id;
  INSERT INTO public.player_social_transfers(sender_profile_id,recipient_profile_id,transfer_type,equipment_inventory_id,equipment_id,note)
  VALUES(v_sender,target_profile_id,'equipment',inventory_id,v_equipment,nullif(btrim(note),'')) RETURNING id INTO v_transfer_id;
  RETURN jsonb_build_object('transfer_id',v_transfer_id,'inventory_id',inventory_id,'equipment_id',v_equipment,'name',v_equipment_name);
END $$;
GRANT EXECUTE ON FUNCTION public.send_equipment_to_player(uuid,uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_manageable_job_vacancies(actor_profile_id uuid DEFAULT NULL)
RETURNS TABLE(vacancy_id uuid,company_id uuid,company_name text,job_title text,weekly_wage numeric,employment_type text,positions_available integer,positions_filled integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT v.id,c.id,c.name,v.job_title,v.weekly_wage,v.employment_type,v.positions_available,v.positions_filled
  FROM public.company_vacancies v JOIN public.companies c ON c.id=v.company_id
  WHERE v.status='open' AND coalesce(v.positions_filled,0)<coalesce(v.positions_available,1)
    AND public.is_company_manager(v.company_id)
  ORDER BY c.name,v.job_title;
$$;
GRANT EXECUTE ON FUNCTION public.list_manageable_job_vacancies(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.offer_company_vacancy_to_player(p_vacancy_id uuid,p_target_profile_id uuid,p_message text DEFAULT NULL)
RETURNS public.company_job_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.company_vacancies%rowtype; app public.company_job_applications%rowtype; v_target_user uuid; v_score integer:=50;
BEGIN
  SELECT * INTO v FROM public.company_vacancies WHERE id=p_vacancy_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Vacancy not found'; END IF;
  IF NOT public.is_company_manager(v.company_id) THEN RAISE EXCEPTION 'Not authorised to offer this job'; END IF;
  IF v.status<>'open' OR coalesce(v.positions_filled,0)>=coalesce(v.positions_available,1) THEN RAISE EXCEPTION 'Vacancy has no available positions'; END IF;
  SELECT user_id INTO v_target_user FROM public.profiles WHERE id=p_target_profile_id AND died_at IS NULL AND deleted_at IS NULL;
  IF v_target_user IS NULL THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF v_target_user=auth.uid() THEN RAISE EXCEPTION 'You cannot offer a company job to your own character'; END IF;
  IF public.are_profiles_blocked(public.current_profile_id(),p_target_profile_id) THEN RAISE EXCEPTION 'This player is unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.company_employees ce WHERE ce.company_id=v.company_id AND ce.profile_id=p_target_profile_id AND ce.status='active') THEN RAISE EXCEPTION 'This player already works for the company'; END IF;
  SELECT * INTO app FROM public.company_job_applications
  WHERE vacancy_id=p_vacancy_id AND applicant_profile_id=p_target_profile_id AND status IN('pending','application_submitted','offer_made','offered')
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF app.id IS NULL THEN
    INSERT INTO public.company_job_applications(vacancy_id,applicant_profile_id,status,suitability_score,message,offer_expires_at)
    VALUES(p_vacancy_id,p_target_profile_id,'offer_made',v_score,nullif(btrim(p_message),''),now()+interval '7 days') RETURNING * INTO app;
  ELSE
    UPDATE public.company_job_applications SET status='offer_made',message=coalesce(nullif(btrim(p_message),''),message),offer_expires_at=now()+interval '7 days',updated_at=now()
    WHERE id=app.id RETURNING * INTO app;
  END IF;
  RETURN app;
END $$;
GRANT EXECUTE ON FUNCTION public.offer_company_vacancy_to_player(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_company_application(p_application_id uuid,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_company uuid;
BEGIN
  SELECT v.company_id INTO v_company FROM public.company_job_applications a JOIN public.company_vacancies v ON v.id=a.vacancy_id WHERE a.id=p_application_id;
  IF v_company IS NULL OR NOT public.is_company_manager(v_company) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF p_action='offer' THEN UPDATE public.company_job_applications SET status='offer_made',offer_expires_at=now()+interval '7 days',updated_at=now() WHERE id=p_application_id;
  ELSIF p_action='reject' THEN UPDATE public.company_job_applications SET status='rejected',updated_at=now() WHERE id=p_application_id;
  ELSE RAISE EXCEPTION 'Unknown action %',p_action; END IF;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
