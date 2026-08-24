-- Correct the B5 queue projection against the canonical festival_stages schema.
CREATE OR REPLACE FUNCTION public.get_festival_artist_booking_schedule_queue(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.festival_editions%ROWTYPE; actor uuid:=public._caller_profile_id();
BEGIN
  SELECT * INTO STRICT e FROM public.festival_editions WHERE id=p_edition_id;
  IF NOT (
    public.can_manage_festival_edition(e.id)
    OR EXISTS(
      SELECT 1 FROM public.festival_edition_management_roles r
      WHERE r.edition_id=e.id AND r.profile_id=actor AND r.status='active'
        AND r.role IN ('delegated_manager','talent_booker','operations_manager','stage_manager')
        AND (r.ends_at IS NULL OR r.ends_at>now())
    )
  ) THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;

  RETURN jsonb_build_object(
    'editionId',e.id,
    'bookings',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',b.id,'artistType',b.artist_type,'bandId',b.band_id,'bandName',bd.name,
        'status',b.status,'setMinutes',b.set_minutes,'billingPosition',b.billing_position,
        'agreedFeeMinor',b.agreed_fee_minor,'currencyCode',b.currency_code,
        'preferredDate',b.provisional_date,'preferredStageId',b.provisional_stage_id,
        'supported',b.artist_type='band' AND b.band_id IS NOT NULL,
        'unsupportedReason',CASE WHEN b.artist_type='band' AND b.band_id IS NOT NULL THEN NULL
          ELSE 'Canonical festival performance contracts currently require a band.' END
      ) ORDER BY b.confirmed_at,b.created_at,b.id)
      FROM public.festival_artist_bookings b
      JOIN public.festival_artist_programmes pr ON pr.id=b.festival_artist_programme_id
      LEFT JOIN public.bands bd ON bd.id=b.band_id
      WHERE pr.festival_edition_id=e.id AND b.status='awaiting_schedule'
    ),'[]'::jsonb),
    'slots',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',s.id,'stageId',s.stage_id,'stageName',coalesce(st.public_name,st.stage_name),
        'dayNumber',s.day_number,'slotNumber',s.slot_number,'slotType',s.slot_type,
        'startAt',s.start_time,'endAt',s.end_time
      ) ORDER BY s.start_time,s.stage_id,s.slot_number)
      FROM public.festival_stage_slots s
      JOIN public.festival_stages st ON st.id=s.stage_id
      WHERE s.edition_id=e.id AND s.status IN ('open','booked') AND s.canonical_contract_id IS NULL
        AND s.band_id IS NULL AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL
    ),'[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.get_festival_artist_booking_schedule_queue(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_artist_booking_schedule_queue(uuid) TO authenticated,service_role;
