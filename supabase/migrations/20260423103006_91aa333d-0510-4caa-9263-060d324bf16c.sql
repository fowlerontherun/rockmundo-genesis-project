
-- 1) Promoted twaats columns
ALTER TABLE public.twaats
  ADD COLUMN IF NOT EXISTS is_promoted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promoted_until timestamptz,
  ADD COLUMN IF NOT EXISTS promoted_cost integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_twaats_promoted_until
  ON public.twaats (promoted_until)
  WHERE is_promoted = true;

-- 2) Verification log
CREATE TABLE IF NOT EXISTS public.twaater_verification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.twaater_accounts(id) ON DELETE CASCADE,
  reason text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.twaater_verification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read verification log" ON public.twaater_verification_log;
CREATE POLICY "Anyone can read verification log"
  ON public.twaater_verification_log
  FOR SELECT
  USING (true);

-- 3) Verification awarder
CREATE OR REPLACE FUNCTION public.award_twaater_verification()
RETURNS TABLE(account_id uuid, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_reason text;
BEGIN
  FOR rec IN
    SELECT a.id, a.owner_type, a.owner_id, a.fame_score, a.verified
    FROM public.twaater_accounts a
    WHERE COALESCE(a.verified, false) = false
  LOOP
    v_reason := NULL;

    -- Fame threshold
    IF COALESCE(rec.fame_score, 0) >= 10000 THEN
      v_reason := 'fame_threshold';
    END IF;

    -- Award winner (any time)
    IF v_reason IS NULL THEN
      IF rec.owner_type = 'band' AND EXISTS (
        SELECT 1 FROM public.award_wins w WHERE w.band_id = rec.owner_id
      ) THEN
        v_reason := 'award_winner';
      END IF;
    END IF;

    -- Top-100 chart entry (last 90 days) for bands
    IF v_reason IS NULL AND rec.owner_type = 'band' THEN
      IF EXISTS (
        SELECT 1
        FROM public.chart_entries ce
        JOIN public.songs s ON s.id = ce.song_id
        WHERE s.band_id = rec.owner_id
          AND ce.rank <= 100
          AND ce.chart_date >= (now() - interval '90 days')
      ) THEN
        v_reason := 'top_100_chart';
      END IF;
    END IF;

    IF v_reason IS NOT NULL THEN
      UPDATE public.twaater_accounts SET verified = true WHERE id = rec.id;
      INSERT INTO public.twaater_verification_log(account_id, reason)
      VALUES (rec.id, v_reason);
      account_id := rec.id;
      reason := v_reason;
      RETURN NEXT;
    END IF;
  END LOOP;
  RETURN;
END;
$$;

-- 4) Promote a twaat (cash sink)
CREATE OR REPLACE FUNCTION public.promote_twaat(
  p_twaat_id uuid,
  p_hours integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_account_id uuid;
  v_owner_type text;
  v_owner_id uuid;
  v_cost integer;
  v_profile_id uuid;
  v_balance numeric;
  v_until timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_hours NOT IN (1, 6, 24) THEN
    RAISE EXCEPTION 'invalid_duration';
  END IF;

  -- Cost: $250/hr, $1200/6hr, $4000/24hr
  v_cost := CASE p_hours
    WHEN 1 THEN 250
    WHEN 6 THEN 1200
    WHEN 24 THEN 4000
  END;

  SELECT t.account_id INTO v_account_id
  FROM public.twaats t WHERE t.id = p_twaat_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'twaat_not_found';
  END IF;

  SELECT a.owner_type, a.owner_id INTO v_owner_type, v_owner_id
  FROM public.twaater_accounts a WHERE a.id = v_account_id;

  -- Resolve profile and verify ownership
  IF v_owner_type = 'persona' THEN
    SELECT id INTO v_profile_id FROM public.profiles
    WHERE id = v_owner_id AND user_id = v_user;
  ELSIF v_owner_type = 'band' THEN
    SELECT p.id INTO v_profile_id
    FROM public.bands b
    JOIN public.profiles p ON p.user_id = v_user
    WHERE b.id = v_owner_id
      AND (b.leader_id = p.id OR EXISTS (
        SELECT 1 FROM public.band_members bm
        WHERE bm.band_id = b.id AND bm.user_id = v_user
      ));
  END IF;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  -- Charge the profile
  SELECT cash INTO v_balance FROM public.profiles WHERE id = v_profile_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  UPDATE public.profiles
  SET cash = cash - v_cost
  WHERE id = v_profile_id;

  v_until := now() + (p_hours || ' hours')::interval;

  UPDATE public.twaats
  SET is_promoted = true,
      promoted_until = GREATEST(COALESCE(promoted_until, now()), v_until),
      promoted_cost = COALESCE(promoted_cost, 0) + v_cost
  WHERE id = p_twaat_id;

  RETURN jsonb_build_object(
    'success', true,
    'cost', v_cost,
    'promoted_until', v_until
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_twaat(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_twaater_verification() TO authenticated, service_role;
