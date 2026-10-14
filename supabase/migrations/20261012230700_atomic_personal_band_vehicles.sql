-- Match the public personal vehicle catalogue with a server-owned price list.
CREATE TABLE IF NOT EXISTS public.personal_vehicle_catalog (
 id text PRIMARY KEY,name text NOT NULL,category text NOT NULL,
 price integer NOT NULL CHECK(price>0)
);
ALTER TABLE public.personal_vehicle_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS personal_vehicle_catalog_read ON public.personal_vehicle_catalog;
CREATE POLICY personal_vehicle_catalog_read ON public.personal_vehicle_catalog FOR SELECT TO authenticated USING(true);
REVOKE ALL ON TABLE public.personal_vehicle_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.personal_vehicle_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.personal_vehicle_catalog TO service_role;
INSERT INTO public.personal_vehicle_catalog(id,name,category,price)
VALUES ('honda-pcx-125','Honda PCX 125','motorbike',3500),
('vespa-gts','Vespa GTS 300','motorbike',7500),
('ktm-duke-390','KTM 390 Duke','motorbike',5500),
('kawasaki-ninja-400','Kawasaki Ninja 400','motorbike',5800),
('yamaha-mt09','Yamaha MT-09','motorbike',9800),
('triumph-bonneville','Triumph Bonneville T120','motorbike',12500),
('indian-scout','Indian Scout Bobber','motorbike',14000),
('harley-street-bob','Harley-Davidson Street Bob 114','motorbike',16500),
('honda-goldwing','Honda Gold Wing','motorbike',28000),
('bmw-s1000rr','BMW S1000RR','motorbike',22000),
('ducati-panigale-v4','Ducati Panigale V4','motorbike',28000),
('mini-cooper-s','MINI Cooper S','car',32000),
('toyota-gr86','Toyota GR86','car',30000),
('vw-golf-gti','Volkswagen Golf GTI','car',35000),
('ford-mustang-gt','Ford Mustang GT','car',42000),
('tesla-model-3','Tesla Model 3','car',45000),
('bmw-3-series','BMW 3 Series','car',48000),
('jeep-wrangler','Jeep Wrangler Rubicon','car',55000),
('mercedes-amg-c63','Mercedes-AMG C63','car',82000),
('audi-rs6','Audi RS6 Avant','car',120000),
('range-rover-sport','Range Rover Sport','car',95000),
('porsche-911','Porsche 911 Carrera','car',120000),
('nissan-gtr','Nissan GT-R Nismo','car',215000),
('bentley-continental','Bentley Continental GT','car',250000),
('ferrari-f8','Ferrari F8 Tributo','car',300000),
('lamborghini-huracan','Lamborghini Huracán EVO','car',280000),
('rolls-royce-ghost','Rolls-Royce Ghost','car',350000),
('bugatti-chiron','Bugatti Chiron','car',3200000),
('jet-ski','Yamaha WaveRunner','boat',12000),
('speedboat','Scarab 195 Speedboat','boat',38000),
('fishing-boat','Boston Whaler 230','boat',85000),
('sailboat','Beneteau Oceanis 40','boat',180000),
('cabin-cruiser','Sea Ray Sundancer 320','boat',250000),
('catamaran','Lagoon 42 Catamaran','boat',450000),
('superyacht','Azimut Grande 27M','boat',4500000),
('megayacht','Benetti Oasis 40M','boat',18000000)
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,price=EXCLUDED.price;

CREATE OR REPLACE FUNCTION public.buy_personal_vehicle_atomic(p_profile_id uuid,p_vehicle_id text,p_card jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.profiles%rowtype;v public.personal_vehicle_catalog%rowtype;v_meta jsonb;v_existing jsonb;v_new jsonb;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'vehicle_character_not_owned'; END IF;
 SELECT * INTO v FROM public.personal_vehicle_catalog WHERE id=p_vehicle_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'personal_vehicle_catalog_missing'; END IF;
 v_meta:=coalesce(p.weekly_bonus_metadata,'{}'::jsonb);v_existing:=coalesce(v_meta->'personal_vehicles','[]'::jsonb);
 IF jsonb_typeof(v_existing)<>'array' THEN RAISE EXCEPTION 'personal_vehicle_state_invalid'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_existing) entry WHERE entry->>'id'=p_vehicle_id)
 THEN RAISE EXCEPTION 'vehicle_already_owned'; END IF;
 v_new:=(coalesce(p_card,'{}'::jsonb)-'id'-'price'-'purchasePrice'-'purchasedAt'-'name'-'category') ||
  jsonb_build_object('id',v.id,'name',v.name,'category',v.category,'price',v.price,
  'purchasePrice',v.price,'purchasedAt',now());
 UPDATE public.profiles SET cash=cash-v.price,
  weekly_bonus_metadata=jsonb_set(v_meta,'{personal_vehicles}',v_existing||jsonb_build_array(v_new),true)
 WHERE id=p.id AND cash>=v.price;
 IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_vehicle_funds'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sell_personal_vehicle_atomic(p_profile_id uuid,p_vehicle_id text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.profiles%rowtype;v_meta jsonb;v_existing jsonb;v_item jsonb;v_price integer;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=p_profile_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'vehicle_character_not_owned'; END IF;
 v_meta:=coalesce(p.weekly_bonus_metadata,'{}'::jsonb);v_existing:=coalesce(v_meta->'personal_vehicles','[]'::jsonb);
 SELECT entry INTO v_item FROM jsonb_array_elements(v_existing) entry WHERE entry->>'id'=p_vehicle_id LIMIT 1;
 IF v_item IS NULL THEN RAISE EXCEPTION 'vehicle_not_owned'; END IF;
 v_price:=round(greatest(0,coalesce((v_item->>'purchasePrice')::numeric,0))*0.7);
 UPDATE public.profiles SET cash=coalesce(cash,0)+v_price,
  weekly_bonus_metadata=jsonb_set(v_meta,'{personal_vehicles}',
   coalesce((SELECT jsonb_agg(entry) FROM jsonb_array_elements(v_existing) entry
    WHERE entry->>'id'<>p_vehicle_id),'[]'::jsonb),true)
 WHERE id=p.id;
 RETURN v_price;
END $$;

CREATE OR REPLACE FUNCTION public.acquire_band_vehicle_atomic(p_band_id uuid,p_vehicle_catalog_id uuid,p_type text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.bands%rowtype;v public.vehicle_catalog%rowtype;v_cost integer;v_profile uuid;
BEGIN
 v_profile:=public._caller_profile_id();
 SELECT * INTO b FROM public.bands WHERE id=p_band_id FOR UPDATE;
 IF NOT FOUND OR NOT (coalesce(b.leader_id=auth.uid(),false) OR coalesce(b.leader_id=v_profile,false)) THEN RAISE EXCEPTION 'band_vehicle_leader_required'; END IF;
 SELECT * INTO v FROM public.vehicle_catalog WHERE id=p_vehicle_catalog_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'vehicle_not_in_catalog'; END IF;
 IF p_type NOT IN ('buy','rent','lease') THEN RAISE EXCEPTION 'invalid_vehicle_purchase_type'; END IF;
 v_cost:=CASE p_type WHEN 'buy' THEN v.purchase_cost WHEN 'rent' THEN v.rental_daily_cost*7
 ELSE v.lease_monthly_cost END;
 IF v_cost IS NULL OR v_cost<=0 THEN RAISE EXCEPTION 'vehicle_pricing_invalid'; END IF;
 UPDATE public.bands SET band_balance=band_balance-v_cost WHERE id=b.id AND band_balance>=v_cost;
 IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_band_vehicle_funds'; END IF;
 INSERT INTO public.band_vehicles (band_id,vehicle_catalog_id,name,vehicle_type,capacity_units,
  is_owned,is_leased,comfort_rating,speed_modifier,rental_daily_cost,
  rental_start_date,rental_end_date,purchase_date)
 VALUES(b.id,v.id,v.name,v.vehicle_type,v.capacity_units,p_type='buy',p_type='lease',
  v.comfort_rating,v.speed_modifier,CASE WHEN p_type='rent' THEN v.rental_daily_cost ELSE 0 END,
  CASE WHEN p_type='rent' THEN now() ELSE NULL END,
  CASE WHEN p_type='rent' THEN now()+interval '7 days' ELSE NULL END,
  CASE WHEN p_type='buy' THEN now() ELSE NULL END);
 RETURN v_cost;
END $$;

REVOKE ALL ON FUNCTION public.buy_personal_vehicle_atomic(uuid,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.sell_personal_vehicle_atomic(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.acquire_band_vehicle_atomic(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buy_personal_vehicle_atomic(uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sell_personal_vehicle_atomic(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_band_vehicle_atomic(uuid,uuid,text) TO authenticated;
