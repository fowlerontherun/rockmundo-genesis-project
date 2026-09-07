-- Empty riders must not appear accepted, and stored estimates should match their items.

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
  v_overall_pct integer := 0;
  v_total_cost integer := 0;
  v_fulfilled jsonb := '[]'::jsonb;
  v_missing jsonb := '[]'::jsonb;
  v_item record;
  v_weight numeric;
  v_item_cost integer;
  v_quality numeric;
  v_status text;
  v_item_count integer := 0;
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
    v_item_count:=v_item_count+1;
    v_weight:=CASE v_item.requested_priority WHEN 'essential' THEN 3 WHEN 'important' THEN 2 WHEN 'nice_to_have' THEN 1 ELSE 0.5 END;
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

  IF v_item_count=0 THEN
    v_technical_pct:=0; v_hospitality_pct:=0; v_backstage_pct:=0; v_overall_pct:=0; v_status:='empty rider';
  ELSE
    IF v_technical_total>0 THEN v_technical_pct:=round(100*v_technical_score/v_technical_total)::integer; END IF;
    IF v_hospitality_total>0 THEN v_hospitality_pct:=round(100*v_hospitality_score/v_hospitality_total)::integer; END IF;
    IF v_backstage_total>0 THEN v_backstage_pct:=round(100*v_backstage_score/v_backstage_total)::integer; END IF;
    v_overall_pct:=round((v_technical_pct+v_hospitality_pct+v_backstage_pct)::numeric/3)::integer;
    v_status:=CASE WHEN jsonb_array_length(v_missing)=0 THEN 'accepted' WHEN jsonb_array_length(v_fulfilled)=0 THEN 'refused' ELSE 'partially accepted' END;
  END IF;

  INSERT INTO public.gig_rider_fulfillment (
    gig_id,rider_id,fulfillment_percentage,technical_fulfillment,hospitality_fulfillment,
    backstage_fulfillment,performance_modifier,morale_modifier,total_rider_cost,
    negotiation_notes,items_fulfilled,items_missing,items_substituted,updated_at
  ) VALUES (
    p_gig_id,v_gig.rider_id,v_overall_pct,v_technical_pct,v_hospitality_pct,v_backstage_pct,
    CASE WHEN v_item_count=0 THEN 1.00 ELSE round((0.80+(v_overall_pct::numeric/100)*0.40)::numeric,2) END,
    CASE WHEN v_item_count=0 THEN 1.00 ELSE round((0.70+(v_hospitality_pct::numeric/100)*0.60)::numeric,2) END,
    v_total_cost,
    CASE WHEN v_item_count=0 THEN 'Rider has no items and cannot be accepted.' ELSE 'Venue '||v_status||' rider. Accepted items are venue-funded; missing items are not charged to the band.' END,
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

UPDATE public.band_riders br
SET total_cost_estimate=x.calculated_cost,updated_at=now()
FROM (
  SELECT br2.id,COALESCE(sum(c.base_cost*bri.quantity),0)::integer AS calculated_cost
  FROM public.band_riders br2
  LEFT JOIN public.band_rider_items bri ON bri.rider_id=br2.id
  LEFT JOIN public.rider_item_catalog c ON c.id=bri.catalog_item_id
  GROUP BY br2.id
) x
WHERE br.id=x.id AND br.total_cost_estimate IS DISTINCT FROM x.calculated_cost;

SELECT public.evaluate_gig_rider(id) FROM public.gigs WHERE rider_id IS NOT NULL;