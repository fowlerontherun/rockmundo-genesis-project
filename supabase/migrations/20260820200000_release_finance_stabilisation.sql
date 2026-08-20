-- Stabilisation/recovery contract for recorded-release finance. This migration is
-- intentionally after the repository head so installations which skipped the
-- out-of-order 20260820120000 migration converge without rewriting history.
ALTER TABLE public.release_sales
  ADD COLUMN IF NOT EXISTS manufacturing_revenue_share integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label_share_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS band_revenue_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allocation_is_reconstructed boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.release_cost_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
 band_id uuid REFERENCES public.bands(id), label_id uuid REFERENCES public.labels(id),
 cost_type text NOT NULL CHECK(cost_type IN ('manufacturing','territory_setup','stock_reorder','additional_format','other')),
 payer_type text NOT NULL CHECK(payer_type IN ('band','label','legacy_unknown')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0), description text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}', ledger_transaction_id uuid UNIQUE
);
CREATE INDEX IF NOT EXISTS release_cost_transactions_release_idx ON public.release_cost_transactions(release_id);
ALTER TABLE public.release_cost_transactions ENABLE ROW LEVEL SECURITY;

-- There is one identity/membership authority for every finance RPC. NULL status
-- and touring flags are legacy active values; explicit inactive/touring rows fail.
CREATE OR REPLACE FUNCTION public.is_authorized_band_member(p_band_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (
   SELECT 1 FROM band_members bm
   LEFT JOIN profiles p ON p.id=bm.profile_id
   WHERE bm.band_id=p_band_id
     AND (bm.member_status='active' OR bm.member_status IS NULL)
     AND bm.is_touring_member IS DISTINCT FROM true
     AND (bm.user_id=auth.uid() OR p.user_id=auth.uid())
     AND (bm.profile_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM profiles active_p
       WHERE active_p.user_id=auth.uid() AND active_p.is_active=true
         AND active_p.id IS DISTINCT FROM bm.profile_id
     ))
 );
$$;
REVOKE ALL ON FUNCTION public.is_authorized_band_member(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_authorized_band_member(uuid) TO authenticated,service_role;

DROP POLICY IF EXISTS "Release participants can view costs" ON public.release_cost_transactions;
CREATE POLICY "Release participants can view costs" ON public.release_cost_transactions FOR SELECT USING (
 EXISTS(SELECT 1 FROM releases r WHERE r.id=release_id AND (r.user_id=auth.uid() OR is_authorized_band_member(r.band_id))));

CREATE OR REPLACE FUNCTION public.record_release_cost(p_release_id uuid,p_cost_type text,p_payer_type text,p_amount_minor bigint,p_description text,p_metadata jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid; r releases%rowtype;
BEGIN
 IF p_amount_minor<=0 THEN RAISE EXCEPTION 'Release cost must be positive'; END IF;
 SELECT * INTO STRICT r FROM releases WHERE id=p_release_id;
 INSERT INTO release_cost_transactions(release_id,band_id,label_id,cost_type,payer_type,amount_minor,description,metadata)
 VALUES(r.id,r.band_id,CASE WHEN p_payer_type='label' THEN (SELECT label_id FROM artist_label_contracts WHERE id=r.label_contract_id) END,
 p_cost_type,p_payer_type,p_amount_minor,p_description,p_metadata) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.record_release_cost(uuid,text,text,bigint,text,jsonb) FROM PUBLIC,anon,authenticated;

-- Remove the old five-second accounting guess. All supported mutations below
-- explicitly write exactly one cost row in their transaction.
DROP TRIGGER IF EXISTS capture_release_format_cost_trigger ON public.release_formats;
DROP FUNCTION IF EXISTS public.capture_release_format_cost();

CREATE OR REPLACE FUNCTION public.charge_band_release_cost(p_band_id uuid,p_amount_minor integer,p_description text,p_metadata jsonb DEFAULT '{}')
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE amount_major numeric(14,2); balance_now numeric;
BEGIN
 IF p_amount_minor<=0 THEN RAISE EXCEPTION 'Release charge must be positive'; END IF;
 IF NOT is_authorized_band_member(p_band_id) THEN RAISE EXCEPTION 'Not authorized for band'; END IF;
 amount_major:=p_amount_minor/100.0;
 SELECT band_balance INTO balance_now FROM bands WHERE id=p_band_id FOR UPDATE;
 IF balance_now IS NULL OR balance_now<amount_major THEN RAISE EXCEPTION 'Insufficient band balance'; END IF;
 INSERT INTO band_earnings(band_id,amount,source,description,earned_by_user_id,metadata)
 VALUES(p_band_id,-amount_major,'release',p_description,auth.uid(),p_metadata||jsonb_build_object('amount_minor',p_amount_minor));
 RETURN amount_major;
END $$;

CREATE OR REPLACE FUNCTION public.purchase_release_format(p_release_id uuid,p_format_type text,p_quantity integer,p_retail_price integer,p_manufacturing_cost_minor integer,p_release_date timestamptz,p_vinyl_color text DEFAULT NULL,p_is_limited_edition boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r releases%rowtype; c artist_label_contracts%rowtype; fid uuid; amount_major numeric; payer text:='band';
BEGIN
 IF p_quantity<=0 OR p_manufacturing_cost_minor<=0 THEN RAISE EXCEPTION 'Invalid manufacturing order'; END IF;
 SELECT * INTO r FROM releases WHERE id=p_release_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
 IF NOT is_authorized_band_member(r.band_id) THEN RAISE EXCEPTION 'Not authorized for release'; END IF;
 IF r.label_contract_id IS NOT NULL THEN SELECT * INTO c FROM artist_label_contracts WHERE id=r.label_contract_id AND status='active' FOR UPDATE; END IF;
 amount_major:=p_manufacturing_cost_minor/100.0;
 IF FOUND AND c.manufacturing_covered THEN
   payer:='label'; UPDATE labels SET balance=balance-amount_major WHERE id=c.label_id AND balance>=amount_major;
   IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient label balance'; END IF;
   INSERT INTO label_financial_transactions(label_id,transaction_type,amount,description,related_contract_id) VALUES(c.label_id,'expense',amount_major,'Additional manufacturing for "'||r.title||'"',c.id);
 ELSE PERFORM charge_band_release_cost(r.band_id,p_manufacturing_cost_minor,'Release manufacturing: additional '||upper(p_format_type)||' format for '||r.title,jsonb_build_object('release_id',r.id,'operation','add_format')); END IF;
 INSERT INTO release_formats(release_id,format_type,quantity,retail_price,manufacturing_cost,manufacturing_status,release_date,vinyl_color,is_limited_edition)
 VALUES(r.id,p_format_type,p_quantity,p_retail_price,p_manufacturing_cost_minor,'manufacturing',p_release_date,p_vinyl_color,p_is_limited_edition) RETURNING id INTO fid;
 UPDATE releases SET total_cost=coalesce(total_cost,0)+p_manufacturing_cost_minor WHERE id=r.id;
 PERFORM record_release_cost(r.id,'additional_format',payer,p_manufacturing_cost_minor,'Additional physical format',jsonb_build_object('format_id',fid,'quantity',p_quantity));
 RETURN fid;
END $$;

DROP FUNCTION IF EXISTS public.reorder_release_stock(uuid,uuid,integer,integer,timestamptz);
CREATE FUNCTION public.reorder_release_stock(p_release_id uuid,p_format_id uuid,p_quantity integer,p_manufacturing_cost_minor integer,p_release_date timestamptz,p_revenue_share_deal boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r releases%rowtype; f release_formats%rowtype; c artist_label_contracts%rowtype; amount_major numeric; payer text:='band'; expected integer; unit_cost numeric;
BEGIN
 IF p_quantity<=0 OR p_manufacturing_cost_minor<=0 THEN RAISE EXCEPTION 'Invalid manufacturing order'; END IF;
 SELECT * INTO r FROM releases WHERE id=p_release_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
 SELECT * INTO f FROM release_formats WHERE id=p_format_id AND release_id=p_release_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Release format not found'; END IF;
 IF NOT is_authorized_band_member(r.band_id) THEN RAISE EXCEPTION 'Not authorized for release'; END IF;
 SELECT cost_per_unit INTO unit_cost FROM manufacturing_costs WHERE format_type=f.format_type AND p_quantity>=min_quantity AND (max_quantity IS NULL OR p_quantity<=max_quantity) ORDER BY min_quantity DESC LIMIT 1;
 IF unit_cost IS NOT NULL THEN
   expected:=round(unit_cost*p_quantity*(CASE WHEN p_revenue_share_deal THEN .5 ELSE 1 END));
   IF expected<>p_manufacturing_cost_minor THEN RAISE EXCEPTION 'Invalid manufacturing cost'; END IF;
 END IF;
 amount_major:=p_manufacturing_cost_minor/100.0;
 IF r.label_contract_id IS NOT NULL THEN SELECT * INTO c FROM artist_label_contracts WHERE id=r.label_contract_id AND status='active' FOR UPDATE; END IF;
 IF FOUND AND c.manufacturing_covered THEN
   payer:='label'; UPDATE labels SET balance=balance-amount_major WHERE id=c.label_id AND balance>=amount_major;
   IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient label balance'; END IF;
   INSERT INTO label_financial_transactions(label_id,transaction_type,amount,description,related_contract_id) VALUES(c.label_id,'expense',amount_major,'Stock reorder for "'||r.title||'"',c.id);
 ELSE PERFORM charge_band_release_cost(r.band_id,p_manufacturing_cost_minor,'Release manufacturing: '||upper(f.format_type)||' stock reorder for '||r.title,jsonb_build_object('release_id',r.id,'format_id',f.id,'operation','reorder')); END IF;
 UPDATE release_formats SET quantity=coalesce(quantity,0)+p_quantity,manufacturing_cost=coalesce(manufacturing_cost,0)+p_manufacturing_cost_minor,manufacturing_status='manufacturing',release_date=p_release_date WHERE id=f.id;
 -- Revenue share is release-level: opting in once retains exactly 10%; later
 -- ordinary reorders never disable it and repeated deals never stack it.
 UPDATE releases SET total_cost=coalesce(total_cost,0)+p_manufacturing_cost_minor,
   revenue_share_enabled=revenue_share_enabled OR p_revenue_share_deal,
   revenue_share_percentage=CASE WHEN revenue_share_enabled OR p_revenue_share_deal THEN 10 ELSE revenue_share_percentage END,
   manufacturing_discount_percentage=CASE WHEN revenue_share_enabled OR p_revenue_share_deal THEN 50 ELSE manufacturing_discount_percentage END WHERE id=r.id;
 PERFORM record_release_cost(r.id,'stock_reorder',payer,p_manufacturing_cost_minor,'Stock reorder',jsonb_build_object('format_id',f.id,'quantity',p_quantity,'revenue_share_deal',p_revenue_share_deal));
END $$;

CREATE OR REPLACE FUNCTION public.create_release_with_financing(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rid uuid:=gen_random_uuid(); bid uuid:=(p_payload->>'band_id')::uuid; uid uuid:=auth.uid(); cid uuid:=(p_payload->>'label_contract_id')::uuid;
 c artist_label_contracts%rowtype; f jsonb; t jsonb; s jsonb; manufacturing bigint:=coalesce((p_payload->>'manufacturing_cost_minor')::bigint,0);
 territory bigint:=coalesce((p_payload->>'territory_cost_minor')::bigint,0); band_cost bigint; label_cost bigint; amount numeric;
BEGIN
 IF bid IS NULL OR NOT is_authorized_band_member(bid) THEN RAISE EXCEPTION 'Not authorized for band'; END IF;
 IF jsonb_array_length(coalesce(p_payload->'formats','[]'))=0 OR jsonb_array_length(coalesce(p_payload->'songs','[]'))=0 OR jsonb_array_length(coalesce(p_payload->'territories','[]'))=0 THEN RAISE EXCEPTION 'Songs, formats and territories are required'; END IF;
 IF cid IS NOT NULL THEN SELECT * INTO c FROM artist_label_contracts WHERE id=cid AND band_id=bid AND status='active' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Active label contract not found'; END IF; END IF;
 label_cost:=CASE WHEN cid IS NOT NULL AND c.manufacturing_covered THEN manufacturing ELSE 0 END; band_cost:=manufacturing+territory-label_cost;
 IF label_cost>0 THEN amount:=label_cost/100.0; UPDATE labels SET balance=balance-amount WHERE id=c.label_id AND balance>=amount; IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient label balance'; END IF;
  INSERT INTO label_financial_transactions(label_id,transaction_type,amount,description,related_contract_id) VALUES(c.label_id,'expense',amount,'Manufacturing costs for "'||p_payload->>'title'||'"',c.id); END IF;
 IF band_cost>0 THEN PERFORM charge_band_release_cost(bid,band_cost::integer,'Release manufacturing and territory setup: '||p_payload->>'title',jsonb_build_object('release_id',rid,'operation','create_release')); END IF;
 INSERT INTO releases(id,user_id,band_id,release_type,title,artist_name,release_status,total_cost,manufacturing_complete_at,scheduled_release_date,streaming_platforms,is_greatest_hits,revenue_share_enabled,revenue_share_percentage,manufacturing_discount_percentage,home_country,label_contract_id,label_revenue_share_pct,hype_score)
 VALUES(rid,uid,bid,p_payload->>'release_type',p_payload->>'title',p_payload->>'artist_name','manufacturing',(manufacturing+territory)::integer,(p_payload->>'manufacturing_complete_at')::timestamptz,(p_payload->>'scheduled_release_date')::date,ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'streaming_platforms','[]'))),coalesce((p_payload->>'is_greatest_hits')::boolean,false),coalesce((p_payload->>'revenue_share_enabled')::boolean,false),(p_payload->>'revenue_share_percentage')::integer,(p_payload->>'manufacturing_discount_percentage')::integer,p_payload->>'home_country',cid,(p_payload->>'label_revenue_share_pct')::integer,(p_payload->>'hype_score')::integer);
 FOR t IN SELECT * FROM jsonb_array_elements(p_payload->'territories') LOOP INSERT INTO release_territories(release_id,country,distance_tier,cost_multiplier,distribution_cost,is_active) VALUES(rid,t->>'country',t->>'distance_tier',(t->>'cost_multiplier')::numeric,(t->>'distribution_cost')::integer,true); END LOOP;
 FOR s IN SELECT * FROM jsonb_array_elements(p_payload->'songs') LOOP INSERT INTO release_songs(release_id,song_id,track_number,is_b_side,recording_version,album_release_id) VALUES(rid,(s->>'song_id')::uuid,(s->>'track_number')::integer,coalesce((s->>'is_b_side')::boolean,false),s->>'recording_version',CASE WHEN p_payload->>'release_type'='album' THEN rid END); END LOOP;
 FOR f IN SELECT * FROM jsonb_array_elements(p_payload->'formats') LOOP INSERT INTO release_formats(release_id,format_type,quantity,manufacturing_cost,retail_price,release_date,manufacturing_status,vinyl_color,is_limited_edition) VALUES(rid,f->>'format_type',(f->>'quantity')::integer,(f->>'manufacturing_cost')::integer,(f->>'retail_price')::integer,(f->>'release_date')::timestamptz,coalesce(f->>'manufacturing_status','pending'),f->>'vinyl_color',coalesce((f->>'is_limited_edition')::boolean,false)); END LOOP;
 IF label_cost>0 THEN PERFORM record_release_cost(rid,'manufacturing','label',label_cost,'Initial manufacturing',jsonb_build_object('operation','create_release')); END IF;
 IF manufacturing-label_cost>0 THEN PERFORM record_release_cost(rid,'manufacturing','band',manufacturing-label_cost,'Initial manufacturing',jsonb_build_object('operation','create_release')); END IF;
 IF territory>0 THEN PERFORM record_release_cost(rid,'territory_setup','band',territory,'Territory setup',jsonb_build_object('territory_count',jsonb_array_length(p_payload->'territories'))); END IF;
 RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.get_release_financial_summary(p_release_id uuid DEFAULT NULL,p_band_id uuid DEFAULT NULL)
RETURNS TABLE(release_id uuid,gross_cents bigint,tax_cents bigint,dist_cents bigint,manufacturer_cents bigint,net_before_label_cents bigint,label_cents bigint,band_revenue_cents bigint,units bigint,economic_cost_cents bigint,band_cost_cents bigint,label_cost_cents bigint,unknown_cost_cents bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_band_id IS NOT NULL AND NOT is_authorized_band_member(p_band_id) THEN RAISE EXCEPTION 'Not authorized for band'; END IF;
 IF p_release_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM releases r WHERE r.id=p_release_id AND (r.user_id=auth.uid() OR is_authorized_band_member(r.band_id))) THEN RAISE EXCEPTION 'Not authorized for release'; END IF;
 RETURN QUERY SELECT r.id,coalesce(s.gross,0),coalesce(s.tax,0),coalesce(s.dist,0),coalesce(s.manufacturer,0),coalesce(s.net,0),
 coalesce(s.label_share,0),coalesce(s.band_revenue,0),coalesce(s.units,0),coalesce(c.economic,0),coalesce(c.band_cost,0),coalesce(c.label_cost,0),coalesce(c.unknown_cost,0)
 FROM releases r
 LEFT JOIN LATERAL (
   SELECT sum(rs.total_amount)::bigint gross,sum(rs.sales_tax_amount)::bigint tax,sum(rs.distribution_fee)::bigint dist,
   sum(coalesce(rs.manufacturing_revenue_share,0))::bigint manufacturer,sum(rs.net_revenue)::bigint net,
   sum(CASE WHEN rs.label_share_amount=0 AND rs.band_revenue_amount=0 AND rs.net_revenue<>0
     THEN CASE WHEN r.label_contract_id IS NULL THEN 0 ELSE round(rs.net_revenue*greatest(0,least(100,coalesce(r.label_revenue_share_pct,0)))/100.0) END ELSE rs.label_share_amount END)::bigint label_share,
   sum(CASE WHEN rs.label_share_amount=0 AND rs.band_revenue_amount=0 AND rs.net_revenue<>0
     THEN CASE WHEN r.label_contract_id IS NULL THEN rs.net_revenue ELSE rs.net_revenue-round(rs.net_revenue*greatest(0,least(100,coalesce(r.label_revenue_share_pct,0)))/100.0) END ELSE rs.band_revenue_amount END)::bigint band_revenue,
   sum(rs.quantity_sold)::bigint units FROM release_formats rf JOIN release_sales rs ON rs.release_format_id=rf.id WHERE rf.release_id=r.id
 ) s ON true
 LEFT JOIN LATERAL (SELECT sum(amount_minor)::bigint economic,sum(amount_minor) FILTER(WHERE payer_type='band')::bigint band_cost,sum(amount_minor) FILTER(WHERE payer_type='label')::bigint label_cost,sum(amount_minor) FILTER(WHERE payer_type='legacy_unknown')::bigint unknown_cost FROM release_cost_transactions WHERE release_id=r.id) c ON true
 WHERE (p_release_id IS NULL OR r.id=p_release_id) AND (p_band_id IS NULL OR r.band_id=p_band_id);
END $$;

CREATE OR REPLACE FUNCTION public.get_release_finance_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE ready boolean;
BEGIN
 SELECT to_regprocedure('public.get_release_financial_summary(uuid,uuid)') IS NOT NULL
   AND to_regprocedure('public.reorder_release_stock(uuid,uuid,integer,integer,timestamp with time zone,boolean)') IS NOT NULL
   AND to_regprocedure('public.purchase_release_format(uuid,text,integer,integer,integer,timestamp with time zone,text,boolean)') IS NOT NULL
   AND to_regprocedure('public.create_release_with_financing(jsonb)') IS NOT NULL
   AND to_regclass('public.release_cost_transactions') IS NOT NULL
   AND (SELECT count(*)=7 FROM pg_attribute WHERE attrelid='public.release_sales'::regclass AND attname=ANY(ARRAY['total_amount','sales_tax_amount','distribution_fee','manufacturing_revenue_share','net_revenue','label_share_amount','band_revenue_amount']) AND NOT attisdropped)
 INTO ready;
 RETURN jsonb_build_object('ready',ready,'contract_version',CASE WHEN ready THEN 2 ELSE 0 END);
END $$;
GRANT EXECUTE ON FUNCTION public.charge_band_release_cost(uuid,integer,text,jsonb),public.purchase_release_format(uuid,text,integer,integer,integer,timestamptz,text,boolean),public.reorder_release_stock(uuid,uuid,integer,integer,timestamptz,boolean),public.create_release_with_financing(jsonb),public.get_release_financial_summary(uuid,uuid),public.get_release_finance_health() TO authenticated;
