-- Forward-only follow-up to the possibly deployed 20291218245800 migration.
-- Recorded release values are integer cents; treasury and journal values are dollars.

ALTER TABLE public.release_sales
  ADD COLUMN IF NOT EXISTS label_share_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS band_revenue_amount integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.release_sales.label_share_amount IS 'Actual label allocation in cents, frozen when the sale is recorded.';
COMMENT ON COLUMN public.release_sales.band_revenue_amount IS 'Actual band treasury allocation in cents, frozen when the sale is recorded.';

-- Deterministic historical split from the immutable release-level percentage snapshot.
UPDATE public.release_sales rs SET
  label_share_amount = round(rs.net_revenue * greatest(0,least(100,coalesce(r.label_revenue_share_pct,0))) / 100.0),
  band_revenue_amount = rs.net_revenue-round(rs.net_revenue * greatest(0,least(100,coalesce(r.label_revenue_share_pct,0))) / 100.0)
FROM public.release_formats rf JOIN public.releases r ON r.id=rf.release_id
WHERE rs.release_format_id=rf.id AND rs.label_share_amount=0 AND rs.band_revenue_amount=0;

CREATE TABLE IF NOT EXISTS public.release_cost_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
 band_id uuid REFERENCES public.bands(id), label_id uuid REFERENCES public.labels(id),
 cost_type text NOT NULL CHECK(cost_type IN ('manufacturing','territory_setup','stock_reorder','additional_format','other')),
 payer_type text NOT NULL CHECK(payer_type IN ('band','label','legacy_unknown')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0), description text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}',
 ledger_transaction_id uuid, UNIQUE(ledger_transaction_id)
);
CREATE INDEX IF NOT EXISTS release_cost_transactions_release_idx ON public.release_cost_transactions(release_id);
ALTER TABLE public.release_cost_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Release participants can view costs" ON public.release_cost_transactions FOR SELECT USING (
 EXISTS(SELECT 1 FROM public.releases r WHERE r.id=release_id AND (r.user_id=auth.uid() OR EXISTS(
  SELECT 1 FROM public.band_members bm JOIN public.profiles p ON p.id=bm.profile_id WHERE bm.band_id=r.band_id AND p.user_id=auth.uid()))));

-- Preserve uncertainty: this backfill records economic cost but never invents a payer or moves money.
INSERT INTO public.release_cost_transactions(release_id,band_id,label_id,cost_type,payer_type,amount_minor,description,created_at,metadata)
SELECT r.id,r.band_id,NULL,'other','legacy_unknown',r.total_cost,'Legacy aggregate release cost; payer cannot be proven',r.created_at,
 jsonb_build_object('backfill','releases.total_cost','attribution','unknown')
FROM public.releases r WHERE r.total_cost>0 AND NOT EXISTS(SELECT 1 FROM public.release_cost_transactions c WHERE c.release_id=r.id);

CREATE OR REPLACE FUNCTION public.get_release_financial_summary(p_release_id uuid DEFAULT NULL, p_band_id uuid DEFAULT NULL)
RETURNS TABLE(release_id uuid,gross_cents bigint,tax_cents bigint,dist_cents bigint,manufacturer_cents bigint,
 net_before_label_cents bigint,label_cents bigint,band_revenue_cents bigint,units bigint,economic_cost_cents bigint,
 band_cost_cents bigint,label_cost_cents bigint,unknown_cost_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.id,coalesce(s.gross,0),coalesce(s.tax,0),coalesce(s.dist,0),coalesce(s.manufacturer,0),coalesce(s.net,0),
 coalesce(s.label_share,0),coalesce(s.band_revenue,0),coalesce(s.units,0),coalesce(c.economic,0),coalesce(c.band_cost,0),
 coalesce(c.label_cost,0),coalesce(c.unknown_cost,0)
 FROM releases r LEFT JOIN LATERAL (SELECT sum(rs.total_amount)::bigint gross,sum(rs.sales_tax_amount)::bigint tax,
 sum(rs.distribution_fee)::bigint dist,sum(coalesce(rs.manufacturing_revenue_share,0))::bigint manufacturer,
 sum(rs.net_revenue)::bigint net,sum(rs.label_share_amount)::bigint label_share,sum(rs.band_revenue_amount)::bigint band_revenue,
 sum(rs.quantity_sold)::bigint units FROM release_formats rf JOIN release_sales rs ON rs.release_format_id=rf.id WHERE rf.release_id=r.id) s ON true
 LEFT JOIN LATERAL (SELECT sum(amount_minor)::bigint economic,sum(amount_minor) FILTER(WHERE payer_type='band')::bigint band_cost,
 sum(amount_minor) FILTER(WHERE payer_type='label')::bigint label_cost,sum(amount_minor) FILTER(WHERE payer_type='legacy_unknown')::bigint unknown_cost
 FROM release_cost_transactions WHERE release_id=r.id) c ON true
 WHERE (p_release_id IS NULL OR r.id=p_release_id) AND (p_band_id IS NULL OR r.band_id=p_band_id);
$$;
GRANT EXECUTE ON FUNCTION public.get_release_financial_summary(uuid,uuid) TO authenticated;

-- Audit/repair registry keeps original deductions immutable and makes refunds idempotent.
CREATE TABLE IF NOT EXISTS public.release_currency_overcharge_repairs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), release_id uuid NOT NULL REFERENCES public.releases(id),
 original_earning_id uuid NOT NULL REFERENCES public.band_earnings(id), refund_earning_id uuid NOT NULL REFERENCES public.band_earnings(id),
 original_deduction numeric(14,2) NOT NULL, expected_deduction numeric(14,2) NOT NULL, refund_amount numeric(14,2) NOT NULL,
 repaired_at timestamptz NOT NULL DEFAULT now(), repaired_by uuid, UNIQUE(original_earning_id)
);
CREATE OR REPLACE FUNCTION public.preview_release_currency_overcharge_repairs()
RETURNS TABLE(release_id uuid,band_id uuid,release_title text,original_earning_id uuid,original_deduction numeric,
 expected_deduction numeric,refund_due numeric,repair_status text) LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT r.id,r.band_id,r.title,be.id,abs(be.amount),r.total_cost/100.0,abs(be.amount)-r.total_cost/100.0,
 CASE WHEN x.id IS NULL THEN 'pending' ELSE 'repaired' END
 FROM releases r JOIN band_earnings be ON be.band_id=r.band_id AND be.source='release'
  AND be.created_at BETWEEN r.created_at-interval '5 minutes' AND r.created_at+interval '5 minutes'
 LEFT JOIN release_currency_overcharge_repairs x ON x.original_earning_id=be.id
 WHERE r.total_cost>0 AND abs(abs(be.amount)-r.total_cost)<=greatest(1,r.total_cost*.01);
$$;
CREATE OR REPLACE FUNCTION public.repair_release_currency_overcharge(p_release_id uuid,p_original_earning_id uuid)
RETURNS TABLE(original_deduction numeric,expected_deduction numeric,refund_amount numeric,balance_before numeric,balance_after numeric,repair_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r releases%rowtype; e band_earnings%rowtype; expected numeric; refund numeric; before_balance numeric; refund_id uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM release_currency_overcharge_repairs WHERE original_earning_id=p_original_earning_id) THEN RAISE EXCEPTION 'Overcharge already repaired'; END IF;
 SELECT * INTO r FROM releases WHERE id=p_release_id FOR UPDATE; SELECT * INTO e FROM band_earnings WHERE id=p_original_earning_id AND band_id=r.band_id FOR UPDATE;
 IF NOT FOUND OR e.amount>=0 OR e.source<>'release' THEN RAISE EXCEPTION 'Invalid release deduction'; END IF;
 expected:=r.total_cost/100.0;
 IF abs(abs(e.amount)-r.total_cost)>greatest(1,r.total_cost*.01) THEN RAISE EXCEPTION 'Server verification found no 100x overcharge'; END IF;
 refund:=abs(e.amount)-expected; SELECT band_balance INTO before_balance FROM bands WHERE id=r.band_id FOR UPDATE;
 INSERT INTO band_earnings(band_id,amount,source,description,metadata) VALUES(r.band_id,refund,'release_overcharge_refund',
  'Compensating refund for legacy 100x release charge: '||r.title,jsonb_build_object('release_id',r.id,'original_earning_id',e.id,'expected_deduction',expected)) RETURNING id INTO refund_id;
 INSERT INTO release_currency_overcharge_repairs(release_id,original_earning_id,refund_earning_id,original_deduction,expected_deduction,refund_amount,repaired_by)
 VALUES(r.id,e.id,refund_id,abs(e.amount),expected,refund,auth.uid());
 RETURN QUERY SELECT abs(e.amount),expected,refund,before_balance,before_balance+refund,'repaired'::text;
END $$;
REVOKE ALL ON FUNCTION public.preview_release_currency_overcharge_repairs(), public.repair_release_currency_overcharge(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preview_release_currency_overcharge_repairs(), public.repair_release_currency_overcharge(uuid,uuid) TO service_role;

-- Add payer evidence to the already-atomic format operations.
CREATE OR REPLACE FUNCTION public.record_release_cost(p_release_id uuid,p_cost_type text,p_payer_type text,p_amount_minor bigint,p_description text,p_metadata jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE rid uuid; r releases%rowtype; BEGIN
 SELECT * INTO r FROM releases WHERE id=p_release_id; INSERT INTO release_cost_transactions(release_id,band_id,label_id,cost_type,payer_type,amount_minor,description,metadata)
 VALUES(p_release_id,r.band_id,CASE WHEN p_payer_type='label' THEN (SELECT label_id FROM artist_label_contracts WHERE id=r.label_contract_id) END,p_cost_type,p_payer_type,p_amount_minor,p_description,p_metadata) RETURNING id INTO rid; RETURN rid; END $$;
REVOKE ALL ON FUNCTION public.record_release_cost(uuid,text,text,bigint,text,jsonb) FROM PUBLIC,anon,authenticated;

-- Wrappers remain atomic because a failure in cost evidence rolls back the charged operation.
-- Patch the two existing functions by using triggers on the authoritative format mutations.
CREATE OR REPLACE FUNCTION public.capture_release_format_cost() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r releases%rowtype; payer text; delta bigint; kind text;
BEGIN SELECT * INTO r FROM releases WHERE id=NEW.release_id; delta:=CASE WHEN TG_OP='INSERT' THEN NEW.manufacturing_cost ELSE NEW.manufacturing_cost-coalesce(OLD.manufacturing_cost,0) END;
 IF delta<=0 THEN RETURN NEW; END IF; payer:=CASE WHEN EXISTS(SELECT 1 FROM artist_label_contracts WHERE id=r.label_contract_id AND status='active' AND manufacturing_covered) THEN 'label' ELSE 'band' END;
 kind:=CASE WHEN TG_OP='INSERT' AND r.created_at < now()-interval '5 seconds' THEN 'additional_format' WHEN TG_OP='UPDATE' THEN 'stock_reorder' ELSE 'manufacturing' END;
 PERFORM record_release_cost(r.id,kind,payer,delta,CASE WHEN kind='stock_reorder' THEN 'Stock reorder' ELSE 'Format manufacturing' END,jsonb_build_object('format_id',NEW.id,'quantity',NEW.quantity)); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS capture_release_format_cost_trigger ON public.release_formats;
CREATE TRIGGER capture_release_format_cost_trigger AFTER INSERT OR UPDATE OF manufacturing_cost ON public.release_formats FOR EACH ROW EXECUTE FUNCTION public.capture_release_format_cost();

CREATE OR REPLACE FUNCTION public.create_release_with_financing(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid:=gen_random_uuid(); bid uuid:=(p_payload->>'band_id')::uuid; uid uuid:=auth.uid(); cid uuid:=(p_payload->>'label_contract_id')::uuid;
 c artist_label_contracts%rowtype; f jsonb; t jsonb; s jsonb; manufacturing bigint:=coalesce((p_payload->>'manufacturing_cost_minor')::bigint,0);
 territory bigint:=coalesce((p_payload->>'territory_cost_minor')::bigint,0); band_cost bigint; label_cost bigint; amount numeric;
BEGIN
 IF bid IS NULL OR NOT EXISTS(SELECT 1 FROM band_members bm JOIN profiles p ON p.id=bm.profile_id WHERE bm.band_id=bid AND p.user_id=uid) THEN RAISE EXCEPTION 'Not authorized for band'; END IF;
 IF jsonb_array_length(coalesce(p_payload->'formats','[]'))=0 OR jsonb_array_length(coalesce(p_payload->'songs','[]'))=0 OR jsonb_array_length(coalesce(p_payload->'territories','[]'))=0 THEN RAISE EXCEPTION 'Songs, formats and territories are required'; END IF;
 IF cid IS NOT NULL THEN SELECT * INTO c FROM artist_label_contracts WHERE id=cid AND band_id=bid AND status='active' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Active label contract not found'; END IF; END IF;
 label_cost:=CASE WHEN cid IS NOT NULL AND c.manufacturing_covered THEN manufacturing ELSE 0 END; band_cost:=manufacturing+territory-label_cost;
 IF label_cost>0 THEN amount:=label_cost/100.0; UPDATE labels SET balance=balance-amount WHERE id=c.label_id AND balance>=amount; IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient label balance'; END IF;
  INSERT INTO label_financial_transactions(label_id,transaction_type,amount,description,related_contract_id) VALUES(c.label_id,'expense',amount,'Manufacturing costs for "'||p_payload->>'title'||'"',c.id); END IF;
 IF band_cost>0 THEN PERFORM charge_band_release_cost(bid,band_cost::integer,'Release manufacturing and territory setup: '||p_payload->>'title',jsonb_build_object('release_id',rid,'operation','create_release')); END IF;
 INSERT INTO releases(id,user_id,band_id,release_type,title,artist_name,release_status,total_cost,manufacturing_complete_at,scheduled_release_date,streaming_platforms,is_greatest_hits,revenue_share_enabled,revenue_share_percentage,manufacturing_discount_percentage,home_country,label_contract_id,label_revenue_share_pct,hype_score)
 VALUES(rid,NULL,bid,p_payload->>'release_type',p_payload->>'title',p_payload->>'artist_name','manufacturing',(manufacturing+territory)::integer,(p_payload->>'manufacturing_complete_at')::timestamptz,(p_payload->>'scheduled_release_date')::date,ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'streaming_platforms','[]'))),coalesce((p_payload->>'is_greatest_hits')::boolean,false),coalesce((p_payload->>'revenue_share_enabled')::boolean,false),(p_payload->>'revenue_share_percentage')::integer,(p_payload->>'manufacturing_discount_percentage')::integer,p_payload->>'home_country',cid,(p_payload->>'label_revenue_share_pct')::integer,(p_payload->>'hype_score')::integer);
 FOR t IN SELECT * FROM jsonb_array_elements(p_payload->'territories') LOOP INSERT INTO release_territories(release_id,country,distance_tier,cost_multiplier,distribution_cost,is_active) VALUES(rid,t->>'country',t->>'distance_tier',(t->>'cost_multiplier')::numeric,(t->>'distribution_cost')::integer,true); END LOOP;
 FOR s IN SELECT * FROM jsonb_array_elements(p_payload->'songs') LOOP INSERT INTO release_songs(release_id,song_id,track_number,is_b_side,recording_version,album_release_id) VALUES(rid,(s->>'song_id')::uuid,(s->>'track_number')::integer,coalesce((s->>'is_b_side')::boolean,false),s->>'recording_version',CASE WHEN p_payload->>'release_type'='album' THEN rid END); END LOOP;
 FOR f IN SELECT * FROM jsonb_array_elements(p_payload->'formats') LOOP INSERT INTO release_formats(release_id,format_type,quantity,manufacturing_cost,retail_price,release_date,manufacturing_status,vinyl_color,is_limited_edition) VALUES(rid,f->>'format_type',(f->>'quantity')::integer,(f->>'manufacturing_cost')::integer,(f->>'retail_price')::integer,(f->>'release_date')::timestamptz,coalesce(f->>'manufacturing_status','pending'),f->>'vinyl_color',coalesce((f->>'is_limited_edition')::boolean,false)); END LOOP;
 IF territory>0 THEN PERFORM record_release_cost(rid,'territory_setup','band',territory,'Territory setup',jsonb_build_object('territory_count',jsonb_array_length(p_payload->'territories'))); END IF;
 RETURN rid;
END $$;
GRANT EXECUTE ON FUNCTION public.create_release_with_financing(jsonb) TO authenticated;
