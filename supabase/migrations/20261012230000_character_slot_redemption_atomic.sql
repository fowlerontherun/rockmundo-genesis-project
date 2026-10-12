-- Redeem a paid Stripe checkout session exactly once, under a per-user row lock.
CREATE TABLE IF NOT EXISTS public.character_slot_redemptions (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.character_slot_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_slot_redemptions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_paid_character_slot(p_user_id uuid, p_session_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_extra integer;
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RAISE EXCEPTION 'Invalid slot redemption request';
  END IF;
  -- Serialize all grants for a user even if the slots row has not yet been created.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 104729));
  IF EXISTS (SELECT 1 FROM public.character_slot_redemptions WHERE session_id = p_session_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.character_slot_redemptions WHERE session_id = p_session_id AND user_id = p_user_id) THEN
      RAISE EXCEPTION 'Checkout session belongs to another user';
    END IF;
    RETURN 'already_redeemed';
  END IF;
  INSERT INTO public.character_slots (user_id, extra_slots_purchased, max_slots)
  VALUES (p_user_id, 0, 2)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT extra_slots_purchased INTO v_extra FROM public.character_slots WHERE user_id = p_user_id FOR UPDATE;
  IF LEAST(2 + v_extra, 5) >= 5 THEN
    RAISE EXCEPTION 'Already at maximum slots (5)';
  END IF;
  INSERT INTO public.character_slot_redemptions (session_id, user_id) VALUES (p_session_id, p_user_id);
  UPDATE public.character_slots SET extra_slots_purchased = v_extra + 1,
    max_slots = LEAST(3 + v_extra, 5), updated_at = now() WHERE user_id = p_user_id;
  RETURN 'redeemed';
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_paid_character_slot(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_paid_character_slot(uuid,text) TO service_role;
