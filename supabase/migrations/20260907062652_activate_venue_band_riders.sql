-- Make band riders operational at venues.

CREATE OR REPLACE FUNCTION public.refresh_venue_rider_capabilities()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.venue_rider_capabilities (
    venue_id, catalog_item_id, is_available, quality_level, cost_modifier, notes
  )
  SELECT
    v.id,
    c.id,
    CASE
      WHEN v.venue_type = 'street_corner' THEN false
      WHEN c.is_premium AND COALESCE(v.capacity,0) < 1000 AND COALESCE(v.prestige_level,0) < 50 THEN false
      WHEN c.base_cost >= 800 AND COALESCE(v.capacity,0) < 1500 AND COALESCE(v.prestige_level,0) < 60 THEN false
      WHEN c.base_cost >= 400 AND COALESCE(v.capacity,0) < 300 AND COALESCE(v.prestige_level,0) < 20 THEN false
      WHEN c.category = 'backstage' AND COALESCE(v.backstage_quality,0) < 2 THEN false
      ELSE true
    END,
    LEAST(100, GREATEST(5,
      CASE
        WHEN c.category = 'technical' AND c.subcategory = 'sound' THEN COALESCE(v.sound_system_rating,35)
        WHEN c.category = 'technical' AND c.subcategory = 'lighting' THEN COALESCE(v.lighting_rating,35)
        WHEN c.category = 'technical' THEN COALESCE(v.equipment_quality,35)
        WHEN c.category IN ('hospitality','backstage') THEN COALESCE(v.backstage_quality,GREATEST(20,COALESCE(v.prestige_level,20)))
        ELSE 35
      END
    ))::integer,
    CASE
      WHEN COALESCE(v.capacity,0) >= 10000 THEN 0.85
      WHEN COALESCE(v.capacity,0) >= 2000 THEN 0.90
      WHEN COALESCE(v.capacity,0) >= 500 THEN 0.95
      WHEN COALESCE(v.capacity,0) >= 150 THEN 1.00
      ELSE 1.10
    END::numeric(3,2),
    'Auto-derived from venue capacity, prestige and facility ratings.'
  FROM public.venues v
  CROSS JOIN public.rider_item_catalog c
  ON CONFLICT (venue_id,catalog_item_id) DO UPDATE SET
    is_available = EXCLUDED.is_available,
    quality_level = EXCLUDED.quality_level,
    cost_modifier = EXCLUDED.cost_modifier,
    notes = EXCLUDED.notes;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_venue_rider_capabilities() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.evaluate_gig_rider(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig public.gigs%ROWTYPE;
  v_rider public.band_riders%ROWTYPE;
  v_technical_total numeric := 0;
  v_hospitality_total numeric := 0;
  v_backstage_total numeric := 0;
  v_technical_score numeric := 0;
  v_hospitality_score numeric := 0;
  v_backstage_score numeric := 0;
  v_technical_pct integer := 100;
  v_hospitality_pct integer := 100;
  v_backstage_pct integer := 100;
  v_overall_pct integer := 100;
  v_total_cost integer := 0;
  v_fulfilled jsonb := '[]'::jsonb;
  v_missing jsonb := '[]'::jsonb;
  v_item record;
  v_weight numeric;
  v_item_cost integer;
  v_quality numeric;
  v_status text;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id=p_gig_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','gig_missing'); END IF;
  IF v_gig.rider_id IS NULL THEN
    DELETE FROM public.gig_rider_fulfillment WHERE gig_id=p_gig_id;
    RETURN jsonb_build_object('status','no_rider');
  END IF;
  SELECT * INTO v_rider FROM public.band_riders WHERE id=v_gig.rider_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','rider_missing'); END IF;

  FOR v_item IN
    SELECT bri.id AS rider_item_id,bri.catalog_item_id,bri.quantity,
           bri.priority AS requested_priority,bri.custom_notes,
           c.category,c.subcategory,c.name,c.base_cost,
           cap.is_available,cap.quality_level,cap.cost_modifier
    FROM public.band_rider_items bri
    JOIN public.rider_item_catalog c ON c.id=bri.catalog_item_id
    LEFT JOIN public.venue_rider_capabilities cap
      ON cap.venue_id=v_gig.venue_id AND cap.catalog_item_id=bri.catalog_item_id
    WHERE bri.rider_id=v_gig.rider_id
    ORDER BY c.category,c.subcategory,c.name
  LOOP
    v_weight := CASE v_item.requested_priority WHEN 'essential' THEN 3 WHEN 'important' THEN 2 WHEN 'nice_to_have' THEN 1 ELSE 0.5 END;
    IF v_item.category='technical' THEN v_technical_total:=v_technical_total+v_weight;
    ELSIF v_item.category='hospitality' THEN v_hospitality_total:=v_hospitality_total+v_weight;
    ELSE v_backstage_total:=v_backstage_total+v_weight; END IF;

    IF COALESCE(v_item.is_available,false) THEN
      v_quality:=LEAST(1,GREATEST(0,COALESCE(v_item.quality_level,50)::numeric/100));
      v_item_cost:=round(v_item.base_cost*v_item.quantity*COALESCE(v_item.cost_modifier,1))::integer;
      v_total_cost:=v_total_cost+v_item_cost;
      v_fulfilled:=v_fulfilled||jsonb_build_array(jsonb_build_object(
        'rider_item_id',v_item.rider_item_id,'catalog_item_id',v_item.catalog_item_id,
        'name',v_item.name,'category',v_item.category,'quantity',v_item.quantity,
        'quality_level',COALESCE(v_item.quality_level,50),'cost',v_item_cost,'funded_by','venue'));
      IF v_item.category='technical' THEN v_technical_score:=v_technical_score+(v_weight*v_quality);
      ELSIF v_item.category='hospitality' THEN v_hospitality_score:=v_hospitality_score+(v_weight*v_quality);
      ELSE v_backstage_score:=v_backstage_score+(v_weight*v_quality); END IF;
    ELSE
      v_missing:=v_missing||jsonb_build_array(jsonb_build_object(
        'rider_item_id',v_item.rider_item_id,'catalog_item_id',v_item.catalog_item_id,
        'name',v_item.name,'category',v_item.category,'quantity',v_item.quantity,
        'priority',v_item.requested_priority,
        'reason',CASE WHEN v_item.is_available IS NULL THEN 'Venue capability not configured' ELSE 'Venue cannot supply this item' END));
    END IF;
  END LOOP;

  IF v_technical_total>0 THEN v_technical_pct:=round(100*v_technical_score/v_technical_total)::integer; END IF;
  IF v_hospitality_total>0 THEN v_hospitality_pct:=round(100*v_hospitality_score/v_hospitality_total)::integer; END IF;
  IF v_backstage_total>0 THEN v_backstage_pct:=round(100*v_backstage_score/v_backstage_total)::integer; END IF;
  v_overall_pct:=round((v_technical_pct+v_hospitality_pct+v_backstage_pct)::numeric/3)::integer;
  v_status:=CASE WHEN jsonb_array_length(v_missing)=0 THEN 'accepted' WHEN jsonb_array_length(v_fulfilled)=0 THEN 'refused' ELSE 'partially accepted' END;

  INSERT INTO public.gig_rider_fulfillment (
    gig_id,rider_id,fulfillment_percentage,technical_fulfillment,hospitality_fulfillment,
    backstage_fulfillment,performance_modifier,morale_modifier,total_rider_cost,
    negotiation_notes,items_fulfilled,items_missing,items_substituted,updated_at
  ) VALUES (
    p_gig_id,v_gig.rider_id,v_overall_pct,v_technical_pct,v_hospitality_pct,v_backstage_pct,
    round((0.80+(v_overall_pct::numeric/100)*0.40)::numeric,2),
    round((0.70+(v_hospitality_pct::numeric/100)*0.60)::numeric,2),v_total_cost,
    'Venue '||v_status||' rider. Accepted items are venue-funded; missing items are not charged to the band.',
    v_fulfilled,v_missing,'[]'::jsonb,now())
  ON CONFLICT (gig_id) DO UPDATE SET
    rider_id=EXCLUDED.rider_id,fulfillment_percentage=EXCLUDED.fulfillment_percentage,
    technical_fulfillment=EXCLUDED.technical_fulfillment,hospitality_fulfillment=EXCLUDED.hospitality_fulfillment,
    backstage_fulfillment=EXCLUDED.backstage_fulfillment,performance_modifier=EXCLUDED.performance_modifier,
    morale_modifier=EXCLUDED.morale_modifier,total_rider_cost=EXCLUDED.total_rider_cost,
    negotiation_notes=EXCLUDED.negotiation_notes,items_fulfilled=EXCLUDED.items_fulfilled,
    items_missing=EXCLUDED.items_missing,items_substituted=EXCLUDED.items_substituted,updated_at=now();

  RETURN jsonb_build_object('status',v_status,'fulfillment_percentage',v_overall_pct,
    'venue_funded_cost',v_total_cost,'fulfilled_items',jsonb_array_length(v_fulfilled),'missing_items',jsonb_array_length(v_missing));
END;
$$;
REVOKE ALL ON FUNCTION public.evaluate_gig_rider(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prepare_gig_rider_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rider_estimate integer:=0;
  v_base_payment integer:=0;
  v_multiplier numeric:=1;
  v_expected_guarantee integer:=0;
BEGIN
  IF NEW.rider_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(total_cost_estimate,0) INTO v_rider_estimate FROM public.band_riders WHERE id=NEW.rider_id AND band_id=NEW.band_id;
  SELECT COALESCE(base_payment,0) INTO v_base_payment FROM public.venues WHERE id=NEW.venue_id;
  v_multiplier:=CASE NEW.time_slot WHEN 'kids' THEN 0.50 WHEN 'opening' THEN 0.60 WHEN 'support' THEN 0.80 WHEN 'headline' THEN 1.00 ELSE 1.00 END;
  v_expected_guarantee:=GREATEST(0,round(v_base_payment*v_multiplier)::integer);
  IF NEW.payment=GREATEST(0,v_expected_guarantee-v_rider_estimate) THEN NEW.payment:=v_expected_guarantee; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_gig_rider_booking() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_gig_rider_fulfillment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.evaluate_gig_rider(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_gig_rider_fulfillment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prepare_gig_rider_booking ON public.gigs;
CREATE TRIGGER trg_prepare_gig_rider_booking
BEFORE INSERT OR UPDATE OF rider_id,venue_id,time_slot,payment ON public.gigs
FOR EACH ROW WHEN (NEW.rider_id IS NOT NULL)
EXECUTE FUNCTION public.prepare_gig_rider_booking();

DROP TRIGGER IF EXISTS trg_sync_gig_rider_fulfillment ON public.gigs;
CREATE TRIGGER trg_sync_gig_rider_fulfillment
AFTER INSERT OR UPDATE OF rider_id,venue_id ON public.gigs
FOR EACH ROW EXECUTE FUNCTION public.sync_gig_rider_fulfillment();

SELECT public.refresh_venue_rider_capabilities();
SELECT public.evaluate_gig_rider(id) FROM public.gigs WHERE rider_id IS NOT NULL;

UPDATE public.gigs g
SET payment=round(COALESCE(v.base_payment,0)*CASE g.time_slot WHEN 'kids' THEN 0.50 WHEN 'opening' THEN 0.60 WHEN 'support' THEN 0.80 ELSE 1.00 END)::integer
FROM public.venues v, public.band_riders br
WHERE g.venue_id=v.id AND g.rider_id=br.id
  AND g.status IN ('scheduled','in_progress','ready_for_completion')
  AND g.payment=GREATEST(0,round(COALESCE(v.base_payment,0)*CASE g.time_slot WHEN 'kids' THEN 0.50 WHEN 'opening' THEN 0.60 WHEN 'support' THEN 0.80 ELSE 1.00 END)::integer-COALESCE(br.total_cost_estimate,0));