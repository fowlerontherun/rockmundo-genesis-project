-- Show owner-confirmed artist payment receipts from the same settlement
-- that posted the annual Festival result. Public history remains redacted.
DO $patch$
DECLARE
  definition text;
  old_financial constant text := '''operatingCostMinor'',v_result.operating_cost_minor,';
  new_financial constant text := $new$
'operatingCostMinor',v_result.operating_cost_minor,
      'artistFeesMinor',coalesce((
        SELECT sum(p.amount_minor) FROM public.festival_simplified_artist_payouts p
        WHERE p.festival_result_id=v_result.id
      ),0),
$new$;
  old_location constant text := '''quality'',CASE WHEN v_rich.id IS NULL THEN NULL ELSE jsonb_build_object(';
  new_location constant text := $new$
'artistPayouts',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'bookingId',p.booking_id,'bandId',p.band_id,'artistName',b.name,
        'amountMinor',p.amount_minor,'currencyCode',p.currency_code,
        'creditedAt',p.created_at
      ) ORDER BY b.name,p.booking_id)
      FROM public.festival_simplified_artist_payouts p
      JOIN public.bands b ON b.id=p.band_id
      WHERE p.festival_result_id=v_result.id
    ),'[]'::jsonb),
    'quality',CASE WHEN v_rich.id IS NULL THEN NULL ELSE jsonb_build_object(
$new$;
BEGIN
  SELECT pg_get_functiondef('public.get_festival_edition_results(uuid,uuid)'::regprocedure)
    INTO definition;
  IF position('''artistPayouts''' IN definition)>0 THEN RETURN; END IF;
  IF position(old_financial IN definition)=0
    OR position(old_location IN definition)=0 THEN
    RAISE EXCEPTION 'festival_owner_results_projection_changed';
  END IF;
  definition:=replace(definition,old_financial,new_financial);
  definition:=replace(definition,old_location,new_location);
  EXECUTE definition;
END;
$patch$;
NOTIFY pgrst,'reload schema';
