-- Repair festival owner management bootstrap and canonical route identifier resolution.

CREATE OR REPLACE FUNCTION public.resolve_festival_management_identifier(p_identifier uuid)
RETURNS TABLE(
  input_id uuid,
  identifier_type text,
  festival_id uuid,
  edition_id uuid,
  legacy_source text,
  legacy_id uuid,
  resolution_status text,
  migration_issue_id uuid,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_edition public.festival_editions%ROWTYPE;
  v_mapping public.festival_legacy_mappings%ROWTYPE;
  v_issue_id uuid;
BEGIN
  IF p_identifier IS NULL THEN
    RETURN QUERY SELECT p_identifier,'invalid'::text,NULL::uuid,NULL::uuid,NULL::text,NULL::uuid,'not_found'::text,NULL::uuid,'A festival identifier is required.'::text;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.festivals f WHERE f.id = p_identifier) THEN
    RETURN QUERY SELECT p_identifier,'festival_brand'::text,p_identifier,NULL::uuid,NULL::text,NULL::uuid,'resolved'::text,NULL::uuid,'Resolved canonical festival brand identifier.'::text;
    RETURN;
  END IF;

  SELECT * INTO v_edition FROM public.festival_editions e WHERE e.id = p_identifier;
  IF FOUND THEN
    RETURN QUERY SELECT p_identifier,'festival_edition'::text,v_edition.festival_id,v_edition.id,NULL::text,NULL::uuid,'resolved'::text,NULL::uuid,'Resolved canonical festival edition identifier.'::text;
    RETURN;
  END IF;

  SELECT * INTO v_mapping
  FROM public.festival_legacy_mappings m
  WHERE m.legacy_id = p_identifier
  ORDER BY CASE m.legacy_source WHEN 'game_event' THEN 1 WHEN 'dedicated_festival_row' THEN 2 ELSE 3 END, m.created_at ASC, m.id ASC
  LIMIT 1;
  IF FOUND THEN
    SELECT * INTO v_edition FROM public.festival_editions e WHERE e.id = v_mapping.edition_id;
    IF FOUND THEN
      RETURN QUERY SELECT p_identifier,
        CASE WHEN v_mapping.legacy_source='game_event' THEN 'legacy_game_event' ELSE 'legacy_' || v_mapping.legacy_source END,
        v_edition.festival_id,v_edition.id,v_mapping.legacy_source,v_mapping.legacy_id,'resolved'::text,NULL::uuid,
        'Resolved legacy festival identifier through festival_legacy_mappings.'::text;
      RETURN;
    END IF;
  END IF;

  SELECT omi.id INTO v_issue_id
  FROM public.festival_operation_migration_issues omi
  WHERE omi.source_table = 'game_events' AND omi.source_id = p_identifier AND coalesce(omi.resolution_status,'open') NOT IN ('resolved','duplicate','historical_only')
  ORDER BY omi.created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT p_identifier,'unresolved_legacy'::text,NULL::uuid,NULL::uuid,'game_event'::text,p_identifier,'migration_blocked'::text,v_issue_id,'Legacy festival data exists but has not been migrated to a canonical edition.'::text;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.game_events ge WHERE ge.id = p_identifier AND ge.event_type='festival') THEN
    RETURN QUERY SELECT p_identifier,'unresolved_legacy'::text,NULL::uuid,NULL::uuid,'game_event'::text,p_identifier,'migration_required'::text,NULL::uuid,'Legacy festival event has not been mapped to a canonical festival edition.'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT p_identifier,'unknown'::text,NULL::uuid,NULL::uuid,NULL::text,NULL::uuid,'not_found'::text,NULL::uuid,'No festival brand, edition, or supported legacy festival identifier was found.'::text;
END $$;
GRANT EXECUTE ON FUNCTION public.resolve_festival_management_identifier(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.festival_owner_management_bootstrap(p_identifier uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_resolution record;
  v_profile_id uuid;
  v_is_admin boolean := false;
  v_is_owner boolean := false;
  v_festival public.festivals%ROWTYPE;
  v_editions jsonb := '[]'::jsonb;
  v_roles jsonb := '[]'::jsonb;
  v_preferred uuid;
  v_can_manage boolean := false;
  v_issue jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status','unauthenticated','input_id',p_identifier,'message','Sign in to manage festivals.');
  END IF;

  SELECT * INTO v_resolution FROM public.resolve_festival_management_identifier(p_identifier) LIMIT 1;
  IF v_resolution.resolution_status = 'not_found' THEN
    RETURN jsonb_build_object('status','not_found','input_id',p_identifier,'identifier_type',v_resolution.identifier_type,'message',v_resolution.message);
  END IF;
  IF v_resolution.resolution_status IN ('migration_blocked','migration_required') THEN
    RETURN jsonb_build_object('status','migration_blocked','input_id',p_identifier,'identifier_type',v_resolution.identifier_type,'legacy_source',v_resolution.legacy_source,'legacy_id',v_resolution.legacy_id,'migration',jsonb_build_object('required',true,'issues',jsonb_build_array(jsonb_build_object('id',v_resolution.migration_issue_id,'code',v_resolution.resolution_status,'message',v_resolution.message))),'message',v_resolution.message);
  END IF;

  SELECT public.current_profile_id_safe() INTO v_profile_id;
  v_is_admin := coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false);
  IF v_profile_id IS NULL AND NOT v_is_admin THEN
    RETURN jsonb_build_object('status','access_denied','input_id',p_identifier,'message','No game profile is linked to the authenticated user.');
  END IF;

  SELECT * INTO v_festival FROM public.festivals f WHERE f.id = v_resolution.festival_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','not_found','input_id',p_identifier,'message','The resolved canonical festival brand was not found.');
  END IF;

  v_is_owner := v_profile_id IS NOT NULL AND v_festival.owner_profile_id = v_profile_id;
  SELECT coalesce(jsonb_agg(DISTINCT r.role),'[]'::jsonb) INTO v_roles
  FROM public.festival_edition_management_roles r
  JOIN public.festival_editions e ON e.id=r.edition_id
  WHERE e.festival_id=v_festival.id AND r.profile_id=v_profile_id AND r.status='active' AND (r.ends_at IS NULL OR r.ends_at>now());
  v_can_manage := v_is_admin OR v_is_owner OR jsonb_array_length(v_roles) > 0;
  IF NOT v_can_manage THEN
    RETURN jsonb_build_object('status','access_denied','input_id',p_identifier,'identifier_type',v_resolution.identifier_type,'festival',jsonb_build_object('id',v_festival.id,'name',v_festival.name),'authority',jsonb_build_object('is_owner',v_is_owner,'is_admin',v_is_admin,'delegated_roles',v_roles,'can_create_edition',false,'can_manage',false),'message','You do not have owner, delegate, or platform-admin access to this festival.');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'festival_id',e.festival_id,'title',e.title,'edition_number',e.edition_number,'status',e.status,'start_at',e.start_at,'end_at',e.end_at,'city_name',c.name,'currency_code',e.currency_code) ORDER BY e.start_at DESC NULLS LAST, e.edition_number DESC),'[]'::jsonb)
  INTO v_editions
  FROM public.festival_editions e LEFT JOIN public.cities c ON c.id=e.city_id
  WHERE e.festival_id=v_festival.id AND (v_is_admin OR v_is_owner OR EXISTS (SELECT 1 FROM public.festival_edition_management_roles r WHERE r.edition_id=e.id AND r.profile_id=v_profile_id AND r.status='active' AND (r.ends_at IS NULL OR r.ends_at>now())));

  SELECT e.id INTO v_preferred FROM public.festival_editions e
  WHERE e.festival_id=v_festival.id AND (v_resolution.edition_id IS NULL OR e.id=v_resolution.edition_id)
  ORDER BY CASE WHEN e.id=v_resolution.edition_id THEN 0 ELSE 1 END, e.start_at DESC NULLS LAST, e.edition_number DESC LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object('code','legacy_mapping','severity','warning','message','This brand contains migrated legacy festival data.','legacy_source',m.legacy_source,'legacy_id',m.legacy_id)),'[]'::jsonb)
  INTO v_issue FROM public.festival_legacy_mappings m JOIN public.festival_editions e ON e.id=m.edition_id WHERE e.festival_id=v_festival.id;

  RETURN jsonb_build_object(
    'status', CASE WHEN jsonb_array_length(v_editions)=0 THEN 'no_editions' ELSE 'ready' END,
    'input_id',p_identifier,'identifier_type',v_resolution.identifier_type,
    'festival',jsonb_build_object('id',v_festival.id,'name',v_festival.name,'owner_type','player','owner_profile_id',v_festival.owner_profile_id),
    'authority',jsonb_build_object('is_owner',v_is_owner,'is_admin',v_is_admin,'delegated_roles',v_roles,'can_create_edition',v_is_admin OR v_is_owner,'can_manage',v_can_manage),
    'editions',v_editions,'preferred_edition_id',v_preferred,
    'migration',jsonb_build_object('required',false,'issues',v_issue),
    'available_actions',CASE WHEN v_is_admin OR v_is_owner THEN jsonb_build_array('create_edition') ELSE '[]'::jsonb END
  );
END $$;
GRANT EXECUTE ON FUNCTION public.festival_owner_management_bootstrap(uuid) TO authenticated;
