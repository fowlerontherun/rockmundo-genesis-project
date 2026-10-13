-- Stripe webhooks are retried and can arrive out of order.
-- Guard VIP entitlement mutations with one monotonically increasing event cursor.
CREATE TABLE IF NOT EXISTS public.stripe_vip_subscription_event_cursors (
  stripe_subscription_id text PRIMARY KEY,
  event_created bigint NOT NULL,
  event_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_vip_subscription_event_cursors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_vip_subscription_event_cursors FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_ordered_stripe_vip_status(
 p_subscription_id text, p_user_id uuid, p_status text,
 p_expires_at timestamptz, p_event_created bigint, p_event_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE v_previous bigint; v_row uuid; v_row_user uuid;
BEGIN
 IF p_subscription_id IS NULL OR length(p_subscription_id)=0 OR p_user_id IS NULL OR
   p_status NOT IN ('active','cancelled','expired') OR p_expires_at IS NULL OR
   p_event_created IS NULL OR p_event_created<=0 OR p_event_id IS NULL OR length(p_event_id)=0 THEN
   RAISE EXCEPTION 'Invalid Stripe subscription event';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_subscription_id,754237));
 SELECT event_created INTO v_previous
   FROM public.stripe_vip_subscription_event_cursors
  WHERE stripe_subscription_id=p_subscription_id FOR UPDATE;
 IF FOUND AND p_event_created<=v_previous THEN RETURN 'stale'; END IF;
 SELECT id,user_id INTO v_row,v_row_user FROM public.vip_subscriptions
   WHERE stripe_subscription_id=p_subscription_id
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
   IF v_row_user<>p_user_id THEN RAISE EXCEPTION 'VIP subscription ownership mismatch'; END IF;
   UPDATE public.vip_subscriptions SET status=p_status,expires_at=p_expires_at,updated_at=now()
     WHERE stripe_subscription_id=p_subscription_id AND user_id=p_user_id;
 ELSE
   INSERT INTO public.vip_subscriptions(user_id,status,subscription_type,starts_at,expires_at,stripe_subscription_id)
    VALUES(p_user_id,p_status,'paid',now(),p_expires_at,p_subscription_id);
 END IF;
 INSERT INTO public.stripe_vip_subscription_event_cursors
   (stripe_subscription_id,event_created,event_id)
 VALUES(p_subscription_id,p_event_created,p_event_id)
 ON CONFLICT(stripe_subscription_id) DO UPDATE SET
   event_created=excluded.event_created,event_id=excluded.event_id,updated_at=now();
 RETURN 'applied';
END; $$;
REVOKE ALL ON FUNCTION public.apply_ordered_stripe_vip_status(text,uuid,text,timestamptz,bigint,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ordered_stripe_vip_status(text,uuid,text,timestamptz,bigint,text)
 TO service_role;
