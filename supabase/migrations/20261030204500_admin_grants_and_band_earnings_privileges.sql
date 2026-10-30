-- Follow-up for #4730: protect the finance ledger from dangerous direct
-- table privileges and remove the admin-gift client-side cash/fame write.
-- Other legitimate browser earnings writers are migrated in later slices.
-- No data backfill or real grants happen when this migration is applied.

-- RLS does not protect TRUNCATE. The previous blanket grants exposed
-- TRUNCATE/TRIGGER/REFERENCES and mutation privileges to web roles.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
  ON TABLE public.band_earnings FROM anon;
REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
  ON TABLE public.band_earnings FROM authenticated;

CREATE TABLE IF NOT EXISTS public.admin_band_grant_receipts (
  id uuid PRIMARY KEY,
  band_id uuid NOT NULL REFERENCES public.bands(id),
  administrator_user_id uuid NOT NULL,
  fame integer NOT NULL CHECK (fame >= 0),
  fans integer NOT NULL CHECK (fans >= 0),
  money integer NOT NULL CHECK (money >= 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_band_grant_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_band_grant_receipts
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_band_support(
  p_request_id uuid,
  p_band_id uuid,
  p_fame integer,
  p_fans integer,
  p_money integer,
  p_reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_band public.bands%ROWTYPE;
  v_existing public.admin_band_grant_receipts%ROWTYPE;
  v_casual integer;
  v_dedicated integer;
  v_super integer;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(
    public.has_role(auth.uid(),'admin'),false
  ) THEN
    RAISE EXCEPTION 'Only an authenticated administrator may grant band support'
      USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_band_id IS NULL
    OR p_fame IS NULL OR p_fans IS NULL OR p_money IS NULL
    OR p_fame < 0 OR p_fans < 0 OR p_money < 0
    OR p_fame > 1000000 OR p_fans > 2000000 OR p_money > 2000000
    OR p_fame + p_fans + p_money = 0
    OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 300 THEN
    RAISE EXCEPTION 'Invalid admin band grant amounts, identifier or reason'
      USING ERRCODE='22023';
  END IF;

  -- Serialize all grants to a band and force one payout per request id.
  SELECT * INTO v_band FROM public.bands
    WHERE id=p_band_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Band not found' USING ERRCODE='P0002';
  END IF;
  SELECT * INTO v_existing FROM public.admin_band_grant_receipts
    WHERE id=p_request_id;
  IF FOUND THEN
    IF v_existing.band_id IS DISTINCT FROM p_band_id
      OR v_existing.fame IS DISTINCT FROM p_fame
      OR v_existing.fans IS DISTINCT FROM p_fans
      OR v_existing.money IS DISTINCT FROM p_money
      OR v_existing.reason IS DISTINCT FROM btrim(p_reason) THEN
      RAISE EXCEPTION 'Admin grant request id already used for another payload'
        USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('request_id',p_request_id,'already_granted',true);
  END IF;

  INSERT INTO public.admin_band_grant_receipts(
    id,band_id,administrator_user_id,fame,fans,money,reason
  ) VALUES (
    p_request_id,p_band_id,auth.uid(),p_fame,p_fans,p_money,btrim(p_reason)
  );

  v_casual := floor(p_fans * 0.6)::integer;
  v_dedicated := floor(p_fans * 0.3)::integer;
  v_super := p_fans-v_casual-v_dedicated;

  UPDATE public.bands SET
    fame=coalesce(fame,0)+p_fame,
    total_fans=coalesce(total_fans,0)+p_fans,
    casual_fans=coalesce(casual_fans,0)+v_casual,
    dedicated_fans=coalesce(dedicated_fans,0)+v_dedicated,
    superfans=coalesce(superfans,0)+v_super
  WHERE id=p_band_id;

  IF p_fame > 0 THEN
    INSERT INTO public.band_fame_events(
      band_id,event_type,fame_gained,event_data
    ) VALUES (
      p_band_id,'admin_grant',p_fame,jsonb_build_object(
        'reason',btrim(p_reason),'fans_granted',p_fans,
        'money_granted',p_money,'admin_grant_id',p_request_id,
        'granted_by',auth.uid()
      )
    );
  END IF;

  IF p_money > 0 THEN
    -- Existing earnings trigger credits compatibility band_balance and
    -- synchronises the canonical primary band treasury exactly once.
    INSERT INTO public.band_earnings(
      band_id,amount,source,description,earned_by_user_id,metadata
    ) VALUES (
      p_band_id,p_money,'admin_grant',
      'Admin grant: '||btrim(p_reason),auth.uid(),
      jsonb_build_object(
        'admin_grant_id',p_request_id,'granted_by',auth.uid(),
        'reason',btrim(p_reason)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'request_id',p_request_id,'already_granted',false,
    'band_id',p_band_id,'fame',p_fame,'fans',p_fans,'money',p_money
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_band_support(
  uuid,uuid,integer,integer,integer,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_band_support(
  uuid,uuid,integer,integer,integer,text
) TO authenticated,service_role;
