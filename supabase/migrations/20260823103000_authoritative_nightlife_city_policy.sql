-- Make player nightlife actions server-authoritative and enforce City Hall alcohol/drug policy.

CREATE TABLE IF NOT EXISTS public.authoritative_nightclub_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nightclub_id uuid NOT NULL REFERENCES public.city_night_clubs(id) ON DELETE RESTRICT,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  action_type text NOT NULL CHECK (action_type IN ('stance','drink')),
  stance text,
  drink_id text,
  city_law_id uuid REFERENCES public.city_laws(id) ON DELETE SET NULL,
  player_age integer NOT NULL DEFAULT 18,
  alcohol_legal_age integer NOT NULL DEFAULT 18,
  alcohol_access boolean NOT NULL DEFAULT true,
  drug_policy text NOT NULL DEFAULT 'moderate',
  cash_spent integer NOT NULL DEFAULT 0 CHECK (cash_spent >= 0),
  energy_change integer NOT NULL DEFAULT 0,
  fame_change integer NOT NULL DEFAULT 0,
  outcome_type text NOT NULL,
  addiction_triggered boolean NOT NULL DEFAULT false,
  addiction_type text,
  addiction_severity_gain integer NOT NULL DEFAULT 0,
  finance_transaction_id uuid,
  idempotency_key uuid NOT NULL,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,idempotency_key)
);

CREATE INDEX IF NOT EXISTS authoritative_nightclub_actions_profile_created_idx
  ON public.authoritative_nightclub_actions(profile_id,created_at DESC);
CREATE INDEX IF NOT EXISTS authoritative_nightclub_actions_city_created_idx
  ON public.authoritative_nightclub_actions(city_id,created_at DESC);

ALTER TABLE public.authoritative_nightclub_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.authoritative_nightclub_actions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.authoritative_nightclub_actions TO service_role;

CREATE OR REPLACE FUNCTION public.get_authoritative_nightclub_policy(
  p_user_id uuid,
  p_nightclub_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_club public.city_night_clubs%ROWTYPE;
  v_law public.city_laws%ROWTYPE;
  v_age integer := 18;
  v_legal_age integer := 18;
  v_policy text := 'moderate';
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id=p_user_id AND coalesce(is_active,true)=true AND died_at IS NULL
  ORDER BY created_at DESC LIMIT 1;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'nightlife_profile_not_found' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_club FROM public.city_night_clubs WHERE id=p_nightclub_id AND coalesce(is_active,true)=true;
  IF v_club.id IS NULL THEN RAISE EXCEPTION 'nightlife_club_not_found' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_law FROM public.city_laws
  WHERE city_id=v_club.city_id AND effective_from<=now() AND (effective_until IS NULL OR effective_until>now())
  ORDER BY effective_from DESC LIMIT 1;

  v_age:=greatest(0,coalesce(v_profile.age,18));
  v_legal_age:=greatest(0,coalesce(v_law.alcohol_legal_age,18));
  v_policy:=CASE WHEN lower(coalesce(v_law.drug_policy,'moderate')) IN ('strict','moderate','lenient')
    THEN lower(coalesce(v_law.drug_policy,'moderate')) ELSE 'moderate' END;

  RETURN jsonb_build_object(
    'profileId',v_profile.id,'cityId',v_club.city_id,'nightclubId',v_club.id,
    'cityLawId',v_law.id,'playerAge',v_age,'alcoholLegalAge',v_legal_age,
    'alcoholAccess',v_age>=v_legal_age,'drugPolicy',v_policy
  );
END$$;

CREATE OR REPLACE FUNCTION public.perform_authoritative_nightclub_action(
  p_user_id uuid,
  p_nightclub_id uuid,
  p_action_type text,
  p_stance text,
  p_drink_id text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_club public.city_night_clubs%ROWTYPE;
  v_law public.city_laws%ROWTYPE;
  v_existing jsonb;
  v_action_id uuid:=gen_random_uuid();
  v_age integer:=18; v_legal_age integer:=18; v_alcohol_access boolean:=true; v_drug_policy text:='moderate';
  v_quality integer:=3; v_base_fame integer:=0; v_base_energy integer:=0; v_base_cash integer:=0;
  v_fame integer:=0; v_energy integer:=0; v_cash integer:=0; v_roll numeric:=random();
  v_scandal numeric:=0; v_inspiration numeric:=0; v_network numeric:=0; v_fame_mult numeric:=1; v_energy_mult numeric:=1; v_cash_mult numeric:=1;
  v_outcome text:='great_night'; v_label text:='Great Night!'; v_emoji text:='✨'; v_description text:='A solid night out.';
  v_inspiration_gain boolean:=false; v_contact_gain boolean:=false; v_scandal_triggered boolean:=false;
  v_drug_exposure_chance numeric:=0; v_enforcement_chance numeric:=0; v_drug_exposure boolean:=false;
  v_addiction_chance numeric:=0; v_addiction_triggered boolean:=false; v_addiction_type text; v_addiction_gain integer:=0; v_addiction_id uuid; v_existing_severity integer;
  v_drinks jsonb:='[]'::jsonb; v_drink jsonb; v_drink_name text; v_drink_price integer:=0; v_drink_effect text;
  v_tx uuid; v_account_minor bigint; v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_nightclub_id IS NULL OR p_idempotency_key IS NULL THEN RAISE EXCEPTION 'nightlife_invalid_request' USING ERRCODE='22023'; END IF;
  IF p_action_type NOT IN ('stance','drink') THEN RAISE EXCEPTION 'nightlife_invalid_action' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_profile FROM public.profiles
  WHERE user_id=p_user_id AND coalesce(is_active,true)=true AND died_at IS NULL
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_profile.id IS NULL THEN RAISE EXCEPTION 'nightlife_profile_not_found' USING ERRCODE='P0001'; END IF;

  SELECT result_snapshot INTO v_existing FROM public.authoritative_nightclub_actions
  WHERE profile_id=v_profile.id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing||jsonb_build_object('idempotent',true); END IF;

  SELECT * INTO v_club FROM public.city_night_clubs WHERE id=p_nightclub_id AND coalesce(is_active,true)=true;
  IF v_club.id IS NULL THEN RAISE EXCEPTION 'nightlife_club_not_found' USING ERRCODE='P0001'; END IF;
  IF v_profile.current_city_id IS DISTINCT FROM v_club.city_id THEN RAISE EXCEPTION 'nightlife_wrong_city' USING ERRCODE='P0001'; END IF;
  IF coalesce(v_profile.fame,0)<coalesce(v_club.reputation_requirement,0) THEN RAISE EXCEPTION 'nightlife_reputation_required' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_law FROM public.city_laws
  WHERE city_id=v_club.city_id AND effective_from<=now() AND (effective_until IS NULL OR effective_until>now())
  ORDER BY effective_from DESC LIMIT 1;
  v_age:=greatest(0,coalesce(v_profile.age,18));
  v_legal_age:=greatest(0,coalesce(v_law.alcohol_legal_age,18));
  v_alcohol_access:=v_age>=v_legal_age;
  v_drug_policy:=CASE WHEN lower(coalesce(v_law.drug_policy,'moderate')) IN ('strict','moderate','lenient') THEN lower(coalesce(v_law.drug_policy,'moderate')) ELSE 'moderate' END;
  v_quality:=greatest(1,least(5,coalesce((to_jsonb(v_club)->>'quality_level')::integer,3)));

  IF p_action_type='drink' THEN
    IF NOT v_alcohol_access THEN RAISE EXCEPTION 'nightlife_under_legal_drinking_age' USING ERRCODE='P0001'; END IF;
    IF nullif(btrim(coalesce(p_drink_id,'')),'') IS NULL THEN RAISE EXCEPTION 'nightlife_drink_required' USING ERRCODE='22023'; END IF;
    v_drinks:=coalesce(to_jsonb(v_club)->'drink_menu',to_jsonb(v_club)->'metadata'->'drink_menu','[]'::jsonb);
    SELECT value INTO v_drink FROM jsonb_array_elements(v_drinks) value
    WHERE coalesce(value->>'id',value->>'key',lower(regexp_replace(coalesce(value->>'name',''),'[^a-zA-Z0-9]+','-','g')))=p_drink_id LIMIT 1;
    IF v_drink IS NULL THEN RAISE EXCEPTION 'nightlife_drink_not_available' USING ERRCODE='P0001'; END IF;
    v_drink_name:=coalesce(v_drink->>'name','Drink');
    v_drink_price:=greatest(0,round(coalesce(nullif(v_drink->>'price','')::numeric,0))::integer);
    v_drink_effect:=coalesce(v_drink->>'effect','+5 energy');
    IF coalesce(v_profile.energy,0)>=100 THEN v_energy:=0; ELSE v_energy:=least(5,100-coalesce(v_profile.energy,0)); END IF;
    v_cash:=v_drink_price; v_outcome:='drink'; v_label:=v_drink_name; v_emoji:='🍸'; v_description:=v_drink_effect;
    v_addiction_chance:=0.015;
    IF random()<v_addiction_chance THEN v_addiction_triggered:=true;v_addiction_type:='alcohol';v_addiction_gain:=5; END IF;
  ELSE
    IF p_stance NOT IN ('stay_sober','party_hard','network','leave_early') THEN RAISE EXCEPTION 'nightlife_invalid_stance' USING ERRCODE='22023'; END IF;
    CASE p_stance
      WHEN 'stay_sober' THEN v_fame_mult:=.5;v_energy_mult:=.6;v_cash_mult:=.4;v_scandal:=.02;v_inspiration:=.15;v_network:=.20;
      WHEN 'party_hard' THEN v_fame_mult:=2;v_energy_mult:=1.8;v_cash_mult:=2;v_scandal:=.18;v_inspiration:=.25;v_network:=.10;
      WHEN 'network' THEN v_fame_mult:=1;v_energy_mult:=1;v_cash_mult:=1.2;v_scandal:=.06;v_inspiration:=.10;v_network:=.45;
      ELSE v_fame_mult:=.3;v_energy_mult:=.3;v_cash_mult:=.2;v_scandal:=.01;v_inspiration:=.05;v_network:=.08;
    END CASE;
    v_base_fame:=round((3+v_quality*2)*v_fame_mult);v_base_energy:=round((10+v_quality*3)*v_energy_mult);v_base_cash:=round((15+v_quality*10)*v_cash_mult);
    IF v_roll<v_scandal+(v_quality-1)*.025 THEN v_outcome:='scandal';v_label:='Scandal!';v_emoji:='📸';v_description:='Paparazzi caught a compromising moment.';v_fame:=-round(v_base_fame*.8);v_energy:=-v_base_energy;v_cash:=v_base_cash;v_scandal_triggered:=true;
    ELSIF v_roll<v_scandal+v_inspiration THEN v_outcome:='eureka_moment';v_label:='Eureka Moment!';v_emoji:='💡';v_description:='The night sparked a creative breakthrough.';v_fame:=round(v_base_fame*.7);v_energy:=-round(v_base_energy*.8);v_cash:=v_base_cash;v_inspiration_gain:=true;
    ELSIF v_roll<v_scandal+v_inspiration+v_network THEN v_outcome:='networking_win';v_label:='New Contact!';v_emoji:='📇';v_description:='You made a valuable industry connection.';v_fame:=round(v_base_fame*.8);v_energy:=-v_base_energy;v_cash:=round(v_base_cash*1.3);v_contact_gain:=true;
    ELSIF p_stance='leave_early' THEN v_outcome:='quiet_night';v_label:='Quick Appearance';v_emoji:='👋';v_description:='You showed your face and slipped out.';v_fame:=v_base_fame;v_energy:=-v_base_energy;v_cash:=v_base_cash;
    ELSE v_fame:=v_base_fame;v_energy:=-v_base_energy;v_cash:=v_base_cash; END IF;

    -- Drug policy changes both exposure and enforcement. Strict cities suppress availability but punish risky incidents more heavily.
    IF p_stance IN ('party_hard','network') THEN
      v_drug_exposure_chance:=CASE v_drug_policy WHEN 'strict' THEN CASE WHEN p_stance='party_hard' THEN .015 ELSE .004 END WHEN 'lenient' THEN CASE WHEN p_stance='party_hard' THEN .09 ELSE .025 END ELSE CASE WHEN p_stance='party_hard' THEN .04 ELSE .01 END END;
      v_enforcement_chance:=CASE v_drug_policy WHEN 'strict' THEN .35 WHEN 'lenient' THEN .04 ELSE .15 END;
      v_drug_exposure:=random()<v_drug_exposure_chance;
      IF v_drug_exposure AND random()<v_enforcement_chance THEN v_outcome:='minor_arrest';v_label:='Minor Arrest';v_emoji:='🚔';v_description:='City enforcement interrupted the night.';v_fame:=round(v_base_fame*.5);v_energy:=-round(v_base_energy*1.5);v_cash:=round(v_base_cash*2);v_scandal_triggered:=true; END IF;
      IF v_drug_exposure THEN v_addiction_chance:=CASE v_drug_policy WHEN 'strict' THEN .08 WHEN 'lenient' THEN .22 ELSE .14 END; IF random()<v_addiction_chance THEN v_addiction_triggered:=true;v_addiction_type:='party_drugs';v_addiction_gain:=CASE WHEN v_drug_policy='lenient' THEN 20 ELSE 10 END; END IF; END IF;
    END IF;
    IF NOT v_addiction_triggered AND v_alcohol_access AND p_stance='party_hard' AND random()<.06 THEN v_addiction_triggered:=true;v_addiction_type:='alcohol';v_addiction_gain:=10; END IF;
  END IF;

  IF coalesce(v_profile.energy,100)+v_energy<0 THEN RAISE EXCEPTION 'nightlife_insufficient_energy' USING ERRCODE='P0001'; END IF;
  IF coalesce(v_profile.cash,0)<v_cash THEN RAISE EXCEPTION 'nightlife_insufficient_funds' USING ERRCODE='P0001'; END IF;

  IF v_cash>0 THEN
    v_tx:=public.finance_debit_owner('player',v_profile.id,v_cash::bigint*100,'food_lifestyle',
      CASE WHEN p_action_type='drink' THEN 'Nightclub drink at '||v_club.name ELSE 'Night out at '||v_club.name END,
      'nightlife:'||p_idempotency_key::text,v_profile.id,
      jsonb_build_object('source','authoritative_nightlife','nightclubId',v_club.id,'cityId',v_club.city_id,'actionId',v_action_id));
  END IF;
  SELECT current_balance_minor INTO v_account_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=v_profile.id AND is_primary LIMIT 1;
  UPDATE public.profiles SET cash=coalesce(v_account_minor,0)::numeric/100.0, energy=greatest(0,least(100,coalesce(energy,100)+v_energy)), fame=greatest(0,coalesce(fame,0)+v_fame) WHERE id=v_profile.id;

  IF v_addiction_triggered AND to_regclass('public.player_addictions') IS NOT NULL THEN
    SELECT id,severity INTO v_addiction_id,v_existing_severity FROM public.player_addictions
      WHERE profile_id=v_profile.id AND addiction_type=v_addiction_type AND status IN ('active','recovering','relapsed') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    IF v_addiction_id IS NOT NULL THEN
      UPDATE public.player_addictions SET severity=least(100,coalesce(severity,0)+v_addiction_gain),status='active',updated_at=now() WHERE id=v_addiction_id;
    ELSE
      v_addiction_gain:=greatest(20,v_addiction_gain);
      INSERT INTO public.player_addictions(user_id,profile_id,addiction_type,severity,status,triggered_at,days_clean,relapse_count)
      VALUES(v_profile.id,v_profile.id,v_addiction_type,v_addiction_gain,'active',now(),0,0);
    END IF;
  END IF;

  v_result:=jsonb_build_object(
    'actionId',v_action_id,'profileId',v_profile.id,'nightclubId',v_club.id,'clubName',v_club.name,'cityId',v_club.city_id,
    'cityLawId',v_law.id,'playerAge',v_age,'alcoholLegalAge',v_legal_age,'alcoholAccess',v_alcohol_access,'drugPolicy',v_drug_policy,
    'fameGain',v_fame,'energyCost',greatest(0,-v_energy),'energyGain',greatest(0,v_energy),'cashSpent',v_cash,
    'addictionTriggered',v_addiction_triggered,'addictionType',v_addiction_type,'addictionSeverityGain',v_addiction_gain,
    'drugExposure',v_drug_exposure,'outcomeDetail',jsonb_build_object('type',v_outcome,'label',v_label,'emoji',v_emoji,'description',v_description,'fameChange',v_fame,'energyChange',v_energy,'cashChange',-v_cash,'inspirationGained',v_inspiration_gain,'contactGained',v_contact_gain,'scandalTriggered',v_scandal_triggered),
    'message',CASE WHEN p_action_type='drink' THEN v_emoji||' '||v_label||' — '||v_description ELSE 'Night at '||v_club.name||': '||CASE WHEN v_fame>=0 THEN '+' ELSE '' END||v_fame||' fame, '||v_energy||' energy'||CASE WHEN v_cash>0 THEN ', -$'||v_cash ELSE '' END END,
    'idempotent',false
  );

  INSERT INTO public.authoritative_nightclub_actions(id,user_id,profile_id,nightclub_id,city_id,action_type,stance,drink_id,city_law_id,player_age,alcohol_legal_age,alcohol_access,drug_policy,cash_spent,energy_change,fame_change,outcome_type,addiction_triggered,addiction_type,addiction_severity_gain,finance_transaction_id,idempotency_key,result_snapshot)
  VALUES(v_action_id,p_user_id,v_profile.id,v_club.id,v_club.city_id,p_action_type,p_stance,p_drink_id,v_law.id,v_age,v_legal_age,v_alcohol_access,v_drug_policy,v_cash,v_energy,v_fame,v_outcome,v_addiction_triggered,v_addiction_type,v_addiction_gain,v_tx,p_idempotency_key,v_result);

  BEGIN
    INSERT INTO public.activity_feed(user_id,profile_id,activity_type,message,metadata)
    VALUES(p_user_id,v_profile.id,'nightlife',v_result->>'message',jsonb_build_object('authoritativeNightclubActionId',v_action_id,'cityLawId',v_law.id,'drugPolicy',v_drug_policy,'alcoholAccess',v_alcohol_access));
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END;
  RETURN v_result;
END$$;

REVOKE ALL ON FUNCTION public.get_authoritative_nightclub_policy(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.perform_authoritative_nightclub_action(uuid,uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_authoritative_nightclub_policy(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.perform_authoritative_nightclub_action(uuid,uuid,text,text,text,uuid) TO service_role;
