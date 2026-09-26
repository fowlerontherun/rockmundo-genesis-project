-- Atomic, owner-authorized reorder of one draft stage/day.
CREATE OR REPLACE FUNCTION public.festival_schedule_reorder_stage(
  p_edition_id uuid, p_revision_id uuid, p_stage_id uuid, p_festival_date date,
  p_expected_revision_version integer, p_items jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  revision public.festival_schedule_revisions%ROWTYPE;
  stage_items uuid[];
  submitted_ids uuid[];
  entry jsonb;
  item public.festival_schedule_items%ROWTYPE;
  next_start timestamptz;
  next_end timestamptz;
  previous_end timestamptz;
  first_start timestamptz;
  previous_changeover integer := 0;
  ordinal integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.festival_schedule_can_manage(p_edition_id) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED';
  END IF;
  SELECT * INTO revision FROM public.festival_schedule_revisions
  WHERE id=p_revision_id AND edition_id=p_edition_id FOR UPDATE;
  IF NOT FOUND OR revision.state NOT IN ('draft','ready_for_review') THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_REVISION_NOT_EDITABLE';
  END IF;
  IF revision.version <> p_expected_revision_version THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_STALE_WRITE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.festival_stages
    WHERE id=p_stage_id AND edition_id=p_edition_id) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_INVALID_STAGE';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)=0 THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_INVALID_ORDER';
  END IF;
  SELECT array_agg(id ORDER BY id) INTO stage_items FROM public.festival_schedule_items
  WHERE revision_id=p_revision_id AND stage_id=p_stage_id AND festival_date=p_festival_date;
  SELECT array_agg((value->>'id')::uuid ORDER BY (value->>'id')::uuid) INTO submitted_ids
  FROM jsonb_array_elements(p_items);
  IF stage_items IS DISTINCT FROM submitted_ids OR
     (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_items))
       <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_ORDER_MISMATCH';
  END IF;
  PERFORM 1 FROM public.festival_schedule_items
  WHERE revision_id=p_revision_id AND stage_id=p_stage_id AND festival_date=p_festival_date FOR UPDATE;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO item FROM public.festival_schedule_items
      WHERE id=(entry->>'id')::uuid AND revision_id=p_revision_id;
    IF item.locked OR item.starts_at IS NULL OR item.ends_at IS NULL OR
       item.duration_minutes <= 0 OR item.soundcheck_starts_at IS NOT NULL THEN
      RAISE EXCEPTION 'FESTIVAL_SCHEDULE_ITEM_CANNOT_MOVE';
    END IF;
    IF item.version <> (entry->>'version')::integer THEN
      RAISE EXCEPTION 'FESTIVAL_SCHEDULE_STALE_WRITE';
    END IF;
    IF ordinal=0 THEN
      next_start := (entry->>'startsAt')::timestamptz;
      first_start := next_start;
      IF next_start IS NULL OR next_start::date <> p_festival_date THEN
        RAISE EXCEPTION 'FESTIVAL_SCHEDULE_INVALID_START';
      END IF;
    ELSE
      next_start := previous_end + make_interval(mins=>previous_changeover);
    END IF;
    next_end := next_start + make_interval(mins=>item.duration_minutes);
    UPDATE public.festival_schedule_items SET starts_at=next_start,ends_at=next_end,
      sort_order=ordinal,version=version+1,updated_at=now(),
      updated_by_profile_id=public.festival_schedule_actor()
    WHERE id=item.id;
    previous_end:=next_end;
    previous_changeover:=item.changeover_minutes;
    ordinal:=ordinal+1;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.festival_stage_operating_hours
    WHERE stage_id=p_stage_id AND festival_date=p_festival_date AND
      (first_start < opens_at OR next_end > curfew_at - make_interval(mins=>shutdown_buffer_minutes))) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_OUTSIDE_STAGE_HOURS';
  END IF;
  UPDATE public.festival_schedule_revisions SET version=version+1,updated_at=now()
    WHERE id=p_revision_id;
  INSERT INTO public.festival_schedule_audit_events
    (actor_profile_id,festival_id,edition_id,revision_id,action,after_snapshot)
    VALUES (public.festival_schedule_actor(),revision.festival_id,p_edition_id,p_revision_id,
      'stage_running_order_changed',p_items);
  RETURN jsonb_build_object('updated',ordinal,'revisionId',p_revision_id);
END $$;
REVOKE ALL ON FUNCTION public.festival_schedule_reorder_stage(uuid,uuid,uuid,date,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.festival_schedule_reorder_stage(uuid,uuid,uuid,date,integer,jsonb) TO authenticated;
