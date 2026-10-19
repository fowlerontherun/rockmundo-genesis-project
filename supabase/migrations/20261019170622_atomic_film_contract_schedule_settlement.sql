-- Receipt 20261019170622: directly applied production film settlement.
-- Exactly-once: one activity + film contract + wallet/fame + immutable receipt
-- in one SQL transaction; unprivileged roles have no RPC or receipt access.
CREATE TABLE IF NOT EXISTS public.film_contract_settlements (
  contract_id uuid PRIMARY KEY REFERENCES public.player_film_contracts(id) ON DELETE RESTRICT,
  activity_id uuid NOT NULL UNIQUE REFERENCES public.player_scheduled_activities(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  compensation_amount bigint NOT NULL CHECK (compensation_amount>=0),
  fame_amount integer NOT NULL CHECK (fame_amount>=0),
  settled_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.film_contract_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.film_contract_settlements FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.film_contract_settlements TO service_role;

CREATE OR REPLACE FUNCTION public.settle_film_contract_atomic(p_activity_id uuid, p_contract_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_activity public.player_scheduled_activities%rowtype;
 v_contract public.player_film_contracts%rowtype;
 v_profile public.profiles%rowtype;
 v_film public.film_productions%rowtype;
 v_prior public.film_contract_settlements%rowtype;
 v_pay bigint;
 v_fame integer;
BEGIN
 IF p_activity_id IS NULL OR p_contract_id IS NULL THEN
   RAISE EXCEPTION 'film_settlement_missing_identity'; END IF;

 -- Lock schedule and contract in a fixed order; concurrent workers serialize.
 SELECT * INTO v_activity FROM public.player_scheduled_activities
 WHERE id=p_activity_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('settled',false,'reason','schedule_missing'); END IF;
 IF v_activity.activity_type <> 'film_production'
 OR v_activity.user_id IS NULL OR v_activity.profile_id IS NULL
 OR v_activity.metadata->>'contract_id' IS DISTINCT FROM p_contract_id::text
 THEN RAISE EXCEPTION 'film_settlement_schedule_mismatch'; END IF;

 SELECT * INTO v_contract FROM public.player_film_contracts
 WHERE id=p_contract_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('settled',false,'reason','contract_missing'); END IF;
 IF v_contract.user_id <> v_activity.user_id THEN
   RAISE EXCEPTION 'film_settlement_account_mismatch'; END IF;

 -- Repeated delivery must neither change money nor fill in a different
 -- character. The original schedule and receipt are authoritative.
 SELECT * INTO v_prior FROM public.film_contract_settlements
 WHERE contract_id=p_contract_id;
 IF FOUND THEN
   IF v_prior.activity_id<>p_activity_id OR v_prior.profile_id<>v_activity.profile_id
   THEN RAISE EXCEPTION 'film_settlement_replayed_with_different_activity'; END IF;
   RETURN jsonb_build_object('settled',false,'reason','already_settled',
     'compensation_amount',v_prior.compensation_amount,'fame_amount',v_prior.fame_amount);
 END IF;

 IF v_activity.status <> 'in_progress'
 OR v_activity.scheduled_end > now()
 OR v_activity.scheduled_start >= v_activity.scheduled_end
 THEN RETURN jsonb_build_object('settled',false,'reason','schedule_not_due'); END IF;
 IF v_contract.status NOT IN ('accepted','filming') THEN
   RETURN jsonb_build_object('settled',false,'reason','contract_not_eligible'); END IF;
 IF v_contract.filming_end_date IS NOT NULL
    AND v_contract.filming_end_date > (now() AT TIME ZONE 'UTC')::date
 THEN RETURN jsonb_build_object('settled',false,'reason','filming_not_finished'); END IF;

 SELECT * INTO v_profile FROM public.profiles
 WHERE id=v_activity.profile_id AND user_id=v_activity.user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'film_settlement_profile_not_owned'; END IF;
 SELECT * INTO v_film FROM public.film_productions
 WHERE id=v_contract.film_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'film_settlement_film_missing'; END IF;

 -- Contract amount is negotiated payout; the old JS worker mistakenly read
 -- film_productions.compensation (column absent), causing zero wages.
 v_pay:=CASE WHEN v_contract.compensation IS NOT NULL
   THEN v_contract.compensation::bigint
   ELSE COALESCE(v_contract.total_pay_cents,0)/100 END;
 v_fame:=COALESCE(v_contract.fame_boost,v_film.fame_boost,0);
 IF v_pay<0 OR v_pay>100000000 OR v_fame<0 OR v_fame>1000000 THEN
   RAISE EXCEPTION 'film_settlement_invalid_amount'; END IF;

 INSERT INTO public.film_contract_settlements
 (contract_id,activity_id,user_id,profile_id,compensation_amount,fame_amount)
 VALUES(p_contract_id,p_activity_id,v_activity.user_id,v_activity.profile_id,v_pay,v_fame);

 UPDATE public.profiles SET
 cash=cash+v_pay,
 fame=fame+v_fame,
 updated_at=now()
 WHERE id=v_profile.id;

 UPDATE public.player_film_contracts SET
 status='completed',completed_at=now()
 WHERE id=p_contract_id AND status IN ('accepted','filming');
 IF NOT FOUND THEN RAISE EXCEPTION 'film_settlement_contract_state_lost'; END IF;

 UPDATE public.player_scheduled_activities SET
 status='completed',completed_at=now(),
 metadata=COALESCE(metadata,'{}'::jsonb) ||
   jsonb_build_object('film_settlement_contract_id',p_contract_id,
                       'film_compensation',v_pay,'film_fame',v_fame)
 WHERE id=p_activity_id AND status='in_progress';
 IF NOT FOUND THEN RAISE EXCEPTION 'film_settlement_schedule_state_lost'; END IF;

 RETURN jsonb_build_object('settled',true,'contract_id',p_contract_id,
   'activity_id',p_activity_id,'profile_id',v_profile.id,
   'compensation_amount',v_pay,'fame_amount',v_fame);
END $function$
;
REVOKE ALL ON FUNCTION public.settle_film_contract_atomic(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_film_contract_atomic(uuid,uuid) TO service_role;
