-- Finance Phase 8B.8: trusted rehearsal funding vertical-slice primitives.

DROP FUNCTION IF EXISTS public.confirm_band_expense_funding(uuid,text,uuid,bigint,char(3),text,uuid,text);
REVOKE EXECUTE ON FUNCTION public.preview_band_expense_funding(uuid,text,uuid,bigint,char(3),text,uuid) FROM authenticated;

ALTER TABLE public.band_expense_payments ADD COLUMN IF NOT EXISTS booking_type text;
ALTER TABLE public.band_expense_payments ADD COLUMN IF NOT EXISTS linked_rehearsal_id uuid REFERENCES public.band_rehearsals(id);
ALTER TABLE public.band_rehearsals ADD COLUMN IF NOT EXISTS band_expense_payment_id uuid REFERENCES public.band_expense_payments(id);
ALTER TABLE public.band_rehearsals ADD COLUMN IF NOT EXISTS funding_idempotency_key text UNIQUE;
ALTER TABLE public.rehearsal_rooms ADD COLUMN IF NOT EXISTS currency_code char(3) NOT NULL DEFAULT 'GBP';
ALTER TABLE public.rehearsal_rooms ADD COLUMN IF NOT EXISTS destination_financial_account_id uuid REFERENCES public.financial_accounts(id);

CREATE TABLE IF NOT EXISTS public.trusted_band_expense_descriptors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  expense_type text NOT NULL,
  expense_id uuid,
  booking_type text NOT NULL,
  description text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency_code char(3) NOT NULL,
  destination_account_id uuid NOT NULL REFERENCES public.financial_accounts(id),
  initiating_player_id uuid NOT NULL REFERENCES public.profiles(id),
  permission_key text NOT NULL,
  refundable boolean NOT NULL DEFAULT true,
  refund_policy text NOT NULL DEFAULT 'Full refund until 24 hours before start',
  metadata jsonb NOT NULL DEFAULT '{}',
  descriptor_status text NOT NULL DEFAULT 'ready' CHECK (descriptor_status IN ('ready','used','cancelled')),
  created_by_trusted_flow text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now())
);
ALTER TABLE public.trusted_band_expense_descriptors ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.band_expense_component_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_component_id uuid NOT NULL REFERENCES public.band_expense_payment_components(id) ON DELETE CASCADE,
  refund_amount_minor bigint NOT NULL CHECK (refund_amount_minor > 0),
  refund_transaction_id uuid REFERENCES public.financial_transactions(id),
  refund_status text NOT NULL DEFAULT 'completed' CHECK (refund_status IN ('pending','completed','failed','voided')),
  refund_reason text NOT NULL,
  refunded_at timestamptz NOT NULL DEFAULT timezone('utc',now())
);

CREATE OR REPLACE FUNCTION public.rehearsal_room_destination_account(p_room_id uuid, p_currency_code char(3)) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE room record; acct uuid;
BEGIN
  SELECT * INTO room FROM public.rehearsal_rooms WHERE id=p_room_id FOR UPDATE;
  IF room.id IS NULL THEN RAISE EXCEPTION 'rehearsal room not found'; END IF;
  IF room.destination_financial_account_id IS NOT NULL THEN RETURN room.destination_financial_account_id; END IF;
  INSERT INTO public.financial_accounts(owner_type,owner_id,account_name,currency_code,default_currency_code,current_balance_minor,is_primary,account_status,metadata)
  VALUES(CASE WHEN room.company_id IS NULL THEN 'system'::public.financial_owner_type ELSE 'company'::public.financial_owner_type END, room.company_id, 'Rehearsal room receipts: '||room.name, p_currency_code, p_currency_code, 0, false, 'active', jsonb_build_object('account_role','rehearsal_room_receipts','rehearsal_room_id',p_room_id))
  RETURNING id INTO acct;
  UPDATE public.rehearsal_rooms SET destination_financial_account_id=acct WHERE id=p_room_id;
  RETURN acct;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_rehearsal_booking_expense(p_band_id uuid,p_rehearsal_room_id uuid,p_scheduled_start timestamptz,p_duration_hours integer,p_initiating_player_id uuid)
RETURNS public.trusted_band_expense_descriptors LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE room public.rehearsal_rooms; dest uuid; descriptor public.trusted_band_expense_descriptors; end_at timestamptz; amount bigint; is_member boolean;
BEGIN
  IF p_duration_hours NOT IN (2,4,6) THEN RAISE EXCEPTION 'unsupported rehearsal duration'; END IF;
  IF p_scheduled_start <= timezone('utc',now()) THEN RAISE EXCEPTION 'past_booking'; END IF;
  SELECT * INTO room FROM public.rehearsal_rooms WHERE id=p_rehearsal_room_id;
  IF room.id IS NULL THEN RAISE EXCEPTION 'rehearsal room not found'; END IF;
  end_at := p_scheduled_start + make_interval(hours => p_duration_hours);
  is_member := EXISTS(SELECT 1 FROM public.band_members WHERE band_id=p_band_id AND profile_id=p_initiating_player_id AND COALESCE(member_status,'active')='active');
  IF NOT is_member THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF EXISTS(SELECT 1 FROM public.band_rehearsals WHERE rehearsal_room_id=p_rehearsal_room_id AND status IN ('scheduled','in_progress') AND tstzrange(scheduled_start,scheduled_end,'[)') && tstzrange(p_scheduled_start,end_at,'[)')) THEN RAISE EXCEPTION 'slot_unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.band_rehearsals WHERE band_id=p_band_id AND status IN ('scheduled','in_progress') AND tstzrange(scheduled_start,scheduled_end,'[)') && tstzrange(p_scheduled_start,end_at,'[)')) THEN RAISE EXCEPTION 'slot_unavailable'; END IF;
  amount := (room.hourly_rate::bigint * p_duration_hours::bigint * 100);
  dest := public.rehearsal_room_destination_account(p_rehearsal_room_id, room.currency_code);
  INSERT INTO public.trusted_band_expense_descriptors(band_id,expense_type,expense_id,booking_type,description,amount_minor,currency_code,destination_account_id,initiating_player_id,permission_key,refundable,refund_policy,metadata,created_by_trusted_flow)
  VALUES(p_band_id,'rehearsal_booking',p_rehearsal_room_id,'rehearsal','Rehearsal at '||room.name,amount,room.currency_code,dest,p_initiating_player_id,'book_rehearsals',true,'Full refund until 24 hours before start',jsonb_build_object('rehearsal_room_id',p_rehearsal_room_id,'scheduled_start',p_scheduled_start,'scheduled_end',end_at,'duration_hours',p_duration_hours), 'resolve_rehearsal_booking_expense') RETURNING * INTO descriptor;
  RETURN descriptor;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_and_pay_band_expense_internal(p_descriptor_id uuid,p_requested_payment_source text,p_personal_bank_account_id uuid,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.trusted_band_expense_descriptors; treasury public.financial_accounts; ba public.bank_accounts; personal public.financial_accounts; band_part bigint:=0; personal_part bigint:=0; tx uuid; payment uuid; comp uuid; cid uuid;
BEGIN
  IF p_requested_payment_source NOT IN ('band_only','personal_only','band_then_personal_shortfall') THEN RAISE EXCEPTION 'unsupported payment source'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN RAISE EXCEPTION 'idempotency key is invalid'; END IF;
  SELECT * INTO d FROM public.trusted_band_expense_descriptors WHERE id=p_descriptor_id FOR UPDATE;
  IF d.id IS NULL OR d.descriptor_status <> 'ready' THEN RAISE EXCEPTION 'trusted expense descriptor is not ready'; END IF;
  SELECT id INTO payment FROM public.band_expense_payments WHERE idempotency_key=p_idempotency_key;
  IF payment IS NOT NULL THEN SELECT transaction_id INTO tx FROM public.band_expense_payments WHERE id=payment; RETURN jsonb_build_object('status','already_posted','paymentId',payment,'transactionId',tx); END IF;
  SELECT * INTO treasury FROM public.financial_accounts WHERE owner_type='band' AND owner_id=d.band_id AND currency_code=d.currency_code AND account_status='active' AND metadata->>'account_role'='band_treasury' FOR UPDATE;
  IF treasury.id IS NULL THEN RAISE EXCEPTION 'band_treasury_missing'; END IF;
  IF p_requested_payment_source='band_only' THEN band_part:=d.amount_minor; ELSIF p_requested_payment_source='personal_only' THEN personal_part:=d.amount_minor; ELSE band_part:=LEAST(d.amount_minor, treasury.available_balance_minor); personal_part:=d.amount_minor-band_part; END IF;
  IF band_part>0 AND NOT public.user_has_band_finance_permission(d.band_id,d.initiating_player_id,'pay_band_expenses'::public.band_finance_permission) THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF personal_part>0 THEN SELECT * INTO ba FROM public.bank_accounts WHERE id=p_personal_bank_account_id FOR UPDATE; SELECT * INTO personal FROM public.financial_accounts WHERE id=ba.linked_finance_account_id FOR UPDATE; IF ba.owner_type<>'player' OR ba.owner_id<>d.initiating_player_id OR ba.status<>'active' OR personal.account_status<>'active' OR ba.currency_code<>d.currency_code OR personal.currency_code<>d.currency_code THEN RAISE EXCEPTION 'personal_account_invalid'; END IF; END IF;
  IF band_part+personal_part<>d.amount_minor THEN RAISE EXCEPTION 'component total mismatch'; END IF;
  tx:=public.post_financial_journal('rehearsal_payment',gen_random_uuid(),d.currency_code,p_idempotency_key,(CASE WHEN band_part>0 THEN jsonb_build_array(jsonb_build_object('account_id',treasury.id,'direction','debit','amount_minor',band_part)) ELSE '[]'::jsonb END)||(CASE WHEN personal_part>0 THEN jsonb_build_array(jsonb_build_object('account_id',personal.id,'direction','debit','amount_minor',personal_part)) ELSE '[]'::jsonb END)||jsonb_build_array(jsonb_build_object('account_id',d.destination_account_id,'direction','credit','amount_minor',d.amount_minor)),'band_expense',d.expense_id,jsonb_build_object('trusted_finance_workflow',true,'descriptor_id',d.id,'expense_type',d.expense_type));
  INSERT INTO public.band_expense_payments(band_id,expense_type,expense_id,booking_type,destination_account_id,total_amount_minor,currency_code,status,initiating_player_id,transaction_id,idempotency_key,metadata) VALUES(d.band_id,d.expense_type,d.expense_id,d.booking_type,d.destination_account_id,d.amount_minor,d.currency_code,'completed',d.initiating_player_id,tx,p_idempotency_key,jsonb_build_object('descriptor_id',d.id,'requested_payment_source',p_requested_payment_source)) RETURNING id INTO payment;
  IF band_part>0 THEN INSERT INTO public.band_expense_payment_components(payment_id,component_type,source_account_id,amount_minor,transaction_id) VALUES(payment,'band_treasury',treasury.id,band_part,tx); END IF;
  IF personal_part>0 THEN INSERT INTO public.band_expense_payment_components(payment_id,component_type,source_account_id,contributor_player_id,amount_minor,transaction_id) VALUES(payment,'personal_player',personal.id,d.initiating_player_id,personal_part,tx) RETURNING id INTO comp; INSERT INTO public.band_financial_contributions(band_id,contributing_player_id,source_player_account_id,destination_band_treasury_account_id,amount_minor,currency_code,transaction_id,contribution_type,related_expense_type,related_expense_id,idempotency_key,notes) VALUES(d.band_id,d.initiating_player_id,personal.id,treasury.id,personal_part,d.currency_code,tx,CASE WHEN band_part=0 THEN 'full_expense_payment' ELSE 'expense_shortfall' END,d.expense_type,d.expense_id,p_idempotency_key||':contribution','Personal funding of rehearsal expense') RETURNING id INTO cid; UPDATE public.band_expense_payment_components SET contribution_id=cid WHERE id=comp; END IF;
  UPDATE public.trusted_band_expense_descriptors SET descriptor_status='used' WHERE id=d.id;
  RETURN jsonb_build_object('status','posted','paymentId',payment,'transactionId',tx,'bandAmountMinor',band_part,'personalAmountMinor',personal_part,'contributionId',cid);
END $$;

CREATE OR REPLACE FUNCTION public.preview_rehearsal_booking_funding(p_band_id uuid,p_rehearsal_room_id uuid,p_scheduled_start timestamptz,p_duration_hours integer,p_requested_payment_source text,p_personal_bank_account_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); d public.trusted_band_expense_descriptors; treasury public.financial_accounts; ba public.bank_accounts; personal public.financial_accounts; band_part bigint:=0; personal_part bigint:=0; status text:='ready';
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'profile required'; END IF;
  d:=public.resolve_rehearsal_booking_expense(p_band_id,p_rehearsal_room_id,p_scheduled_start,p_duration_hours,pid);
  UPDATE public.trusted_band_expense_descriptors SET descriptor_status='cancelled' WHERE id=d.id;
  SELECT * INTO treasury FROM public.financial_accounts WHERE owner_type='band' AND owner_id=p_band_id AND currency_code=d.currency_code AND account_status='active' AND metadata->>'account_role'='band_treasury';
  IF treasury.id IS NULL THEN status:='band_treasury_missing'; END IF;
  IF p_requested_payment_source='band_only' THEN band_part:=d.amount_minor; ELSIF p_requested_payment_source='personal_only' THEN personal_part:=d.amount_minor; ELSE band_part:=LEAST(d.amount_minor,COALESCE(treasury.available_balance_minor,0)); personal_part:=d.amount_minor-band_part; END IF;
  IF personal_part>0 THEN SELECT * INTO ba FROM public.bank_accounts WHERE id=p_personal_bank_account_id; SELECT * INTO personal FROM public.financial_accounts WHERE id=ba.linked_finance_account_id; IF ba.id IS NULL OR ba.owner_id<>pid OR ba.status<>'active' OR personal.account_status<>'active' THEN status:='personal_account_invalid'; ELSIF personal.available_balance_minor<personal_part THEN status:='insufficient_personal_funds'; END IF; END IF;
  IF status='ready' AND band_part>0 AND treasury.available_balance_minor<band_part THEN status:='insufficient_band_funds'; END IF;
  RETURN jsonb_build_object('status',status,'bookingDescription',d.description,'totalAmountMinor',d.amount_minor,'currencyCode',d.currency_code,'bandAvailableMinor',COALESCE(treasury.available_balance_minor,0),'bandFundedAmountMinor',band_part,'personalAmountMinor',personal_part,'personalAvailableMinor',COALESCE(personal.available_balance_minor,0),'resultingBandBalanceMinor',COALESCE(treasury.available_balance_minor,0)-band_part,'resultingPersonalBalanceMinor',COALESCE(personal.available_balance_minor,0)-personal_part,'refundable',d.refundable,'refundPolicy',d.refund_policy);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('status',CASE WHEN SQLERRM IN ('past_booking','slot_unavailable','permission_denied') THEN SQLERRM ELSE 'slot_unavailable' END,'message',SQLERRM);
END $$;

CREATE OR REPLACE FUNCTION public.confirm_rehearsal_booking_with_funding(p_band_id uuid,p_rehearsal_room_id uuid,p_scheduled_start timestamptz,p_duration_hours integer,p_song_id uuid DEFAULT NULL,p_setlist_id uuid DEFAULT NULL,p_requested_payment_source text DEFAULT 'band_only',p_personal_bank_account_id uuid DEFAULT NULL,p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=public.current_player_profile_id(); existing public.band_rehearsals; d public.trusted_band_expense_descriptors; pay jsonb; rehearsal uuid; end_at timestamptz;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'profile required'; END IF;
  SELECT * INTO existing FROM public.band_rehearsals WHERE funding_idempotency_key=p_idempotency_key;
  IF existing.id IS NOT NULL THEN RETURN jsonb_build_object('status','already_confirmed','bookingId',existing.id,'paymentId',existing.band_expense_payment_id); END IF;
  d:=public.resolve_rehearsal_booking_expense(p_band_id,p_rehearsal_room_id,p_scheduled_start,p_duration_hours,pid);
  pay:=public.resolve_and_pay_band_expense_internal(d.id,p_requested_payment_source,p_personal_bank_account_id,p_idempotency_key);
  end_at := p_scheduled_start + make_interval(hours => p_duration_hours);
  INSERT INTO public.band_rehearsals(band_id,rehearsal_room_id,duration_hours,total_cost,scheduled_start,scheduled_end,selected_song_id,setlist_id,status,band_expense_payment_id,funding_idempotency_key)
  VALUES(p_band_id,p_rehearsal_room_id,p_duration_hours,(d.amount_minor/100)::integer,p_scheduled_start,end_at,p_song_id,p_setlist_id,'scheduled',(pay->>'paymentId')::uuid,p_idempotency_key) RETURNING id INTO rehearsal;
  UPDATE public.band_expense_payments SET linked_rehearsal_id=rehearsal WHERE id=(pay->>'paymentId')::uuid;
  RETURN jsonb_build_object('status','confirmed','bookingId',rehearsal,'paymentId',pay->>'paymentId','transactionId',pay->>'transactionId');
END $$;

REVOKE EXECUTE ON FUNCTION public.resolve_and_pay_band_expense_internal(uuid,text,uuid,text), public.resolve_rehearsal_booking_expense(uuid,uuid,timestamptz,integer,uuid), public.rehearsal_room_destination_account(uuid,char(3)) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_and_pay_band_expense_internal(uuid,text,uuid,text), public.resolve_rehearsal_booking_expense(uuid,uuid,timestamptz,integer,uuid), public.rehearsal_room_destination_account(uuid,char(3)) TO service_role;
GRANT EXECUTE ON FUNCTION public.preview_rehearsal_booking_funding(uuid,uuid,timestamptz,integer,text,uuid), public.confirm_rehearsal_booking_with_funding(uuid,uuid,timestamptz,integer,uuid,uuid,text,uuid,text) TO authenticated;
