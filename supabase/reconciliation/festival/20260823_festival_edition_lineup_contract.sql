-- Production parity overlay for the exact-edition simplified Festival line-up.
-- Mirrors the canonical post-2029 repair without replaying incompatible historical migrations.

CREATE OR REPLACE FUNCTION public._festival_edition_artist_programme_result(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
WITH base AS (
  SELECT company.id AS company_id, edition.id AS edition_id, edition.name AS festival_name,
    edition.starts_on, edition.ends_on, edition.status AS edition_status, edition.locked_at,
    site.id AS site_id, programme.id AS programme_id, programme.currency_code,
    programme.application_mode, programme.applications_open_at, programme.applications_close_at,
    programme.minimum_artist_fame, programme.maximum_artist_fame, programme.preferred_genres,
    programme.excluded_genres, programme.artist_budget_minor, programme.contingency_budget_minor,
    programme.minimum_player_artist_share_basis_points, programme.status AS programme_status,
    programme.planning_version, programme.updated_at AS programme_updated_at
  FROM public.festival_companies company
  JOIN public.festival_editions_v2 edition
    ON edition.festival_company_id=company.id AND edition.id=p_festival_edition_id
  JOIN public.festival_site_plans site ON site.festival_edition_id=edition.id
  JOIN public.festival_ticket_plans ticket ON ticket.festival_edition_id=edition.id
  LEFT JOIN public.festival_artist_programmes programme ON programme.festival_edition_id=edition.id
  WHERE company.id=p_festival_company_id
), booking_totals AS (
  SELECT
    coalesce(sum(b.total_commitment_minor) FILTER (WHERE b.status NOT IN ('cancelled','artist_withdrawn','festival_cancelled')),0)::bigint accepted_commitments,
    count(*) FILTER (WHERE b.status NOT IN ('cancelled','artist_withdrawn','festival_cancelled'))::integer active_bookings,
    count(*) FILTER (WHERE b.status NOT IN ('cancelled','artist_withdrawn','festival_cancelled') AND b.artist_type IN ('solo','band'))::integer player_bookings,
    count(*) FILTER (WHERE b.status NOT IN ('cancelled','artist_withdrawn','festival_cancelled') AND b.artist_type='npc')::integer npc_bookings,
    coalesce(sum(b.total_commitment_minor) FILTER (WHERE b.status NOT IN ('cancelled','artist_withdrawn','festival_cancelled') AND b.artist_type IN ('solo','band')),0)::bigint player_commitments,
    coalesce(sum(b.total_commitment_minor) FILTER (WHERE b.status NOT IN ('cancelled','artist_withdrawn','festival_cancelled') AND b.artist_type='npc'),0)::bigint npc_commitments,
    coalesce(sum(b.total_commitment_minor) FILTER (WHERE b.status NOT IN ('cancelled','artist_withdrawn','festival_cancelled') AND b.billing_position IN ('headliner','sub_headliner')),0)::bigint headline_commitments
  FROM base x LEFT JOIN public.festival_artist_bookings b ON b.festival_artist_programme_id=x.programme_id
), offer_totals AS (
  SELECT
    coalesce(sum(o.offered_fee_minor+o.travel_support_minor+o.accommodation_support_minor) FILTER (WHERE o.status='draft'),0)::bigint draft_commitments,
    coalesce(sum(o.offered_fee_minor+o.travel_support_minor+o.accommodation_support_minor) FILTER (WHERE o.status IN ('sent','countered')),0)::bigint sent_commitments
  FROM base x LEFT JOIN public.festival_artist_offers o ON o.festival_artist_programme_id=x.programme_id
), application_totals AS (
  SELECT coalesce(sum(coalesce(a.requested_fee_minor,a.minimum_fee_minor,0)) FILTER (WHERE a.status IN ('submitted','under_review','shortlisted','offer_pending')),0)::bigint potential_requests
  FROM base x LEFT JOIN public.festival_artist_applications a ON a.festival_artist_programme_id=x.programme_id
)
SELECT jsonb_build_object(
  'festivalCompanyId',x.company_id,'festivalName',x.festival_name,
  'festivalDates',(SELECT coalesce(jsonb_agg(day::date ORDER BY day),'[]'::jsonb) FROM generate_series(x.starts_on,x.ends_on,interval '1 day') day),
  'stages',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'stageType',s.stage_type,'capacity',s.capacity,'active',s.status='ready') ORDER BY s.sort_order) FROM public.festival_site_plan_stages s WHERE s.festival_site_plan_id=x.site_id),'[]'::jsonb),
  'programme',CASE WHEN x.programme_id IS NULL THEN NULL ELSE jsonb_build_object(
    'id',x.programme_id,'currencyCode',x.currency_code,'applicationMode',x.application_mode,
    'applicationsOpenAt',x.applications_open_at,'applicationsCloseAt',x.applications_close_at,
    'minimumArtistFame',x.minimum_artist_fame,'maximumArtistFame',x.maximum_artist_fame,
    'preferredGenres',coalesce(to_jsonb(x.preferred_genres),'[]'::jsonb),'excludedGenres',coalesce(to_jsonb(x.excluded_genres),'[]'::jsonb),
    'artistBudgetMinor',x.artist_budget_minor,'contingencyBudgetMinor',x.contingency_budget_minor,
    'minimumPlayerArtistShareBasisPoints',x.minimum_player_artist_share_basis_points,'status',x.programme_status) END,
  'applicationWindows',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',w.id,'name',w.name,'opensAt',w.opens_at,'closesAt',w.closes_at,'eligibleArtistType',w.eligible_artist_type,
    'minimumFame',w.minimum_fame,'maximumFame',w.maximum_fame,'preferredGenres',to_jsonb(w.preferred_genres),
    'minimumBandMembers',w.minimum_band_members,'maximumBandMembers',w.maximum_band_members,'targetStageTypes',to_jsonb(w.target_stage_types),
    'maximumSetMinutes',w.maximum_set_minutes,'active',w.active) ORDER BY w.opens_at,w.name)
    FROM public.festival_artist_application_windows w WHERE w.festival_artist_programme_id=x.programme_id),'[]'::jsonb),
  'applications',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',a.id,'identity',CASE a.artist_type WHEN 'solo' THEN jsonb_build_object('type','solo','artistProfileId',a.artist_profile_id) WHEN 'band' THEN jsonb_build_object('type','band','bandId',a.band_id) ELSE jsonb_build_object('type','npc','npcArtistId',a.npc_artist_id) END,
    'windowId',a.application_window_id,'submittedByProfileId',a.submitted_by_profile_id,'status',a.status,'version',a.version,
    'preferredDates',to_jsonb(a.preferred_dates),'preferredStageTypes',to_jsonb(a.preferred_stage_types),'minimumFeeMinor',a.minimum_fee_minor,
    'requestedFeeMinor',a.requested_fee_minor,'minimumSetMinutes',a.minimum_set_minutes,'maximumSetMinutes',a.maximum_set_minutes,
    'genreSnapshot',to_jsonb(a.genre_snapshot),'fameSnapshot',a.fame_snapshot,'popularitySnapshot',a.popularity_snapshot,'message',coalesce(a.message,''),
    'submittedAt',a.submitted_at,'suitability',jsonb_build_object('suitabilityScore',least(100,greatest(0,a.fame_snapshot)),'genreFitScore',50,'audienceFitScore',least(100,greatest(0,a.fame_snapshot)),'budgetFitScore',100,'stageFitScore',50,'availabilityState','unknown','riskFlags','[]'::jsonb),'canRespond',false)
    ORDER BY a.submitted_at DESC,a.id) FROM public.festival_artist_applications a WHERE a.festival_artist_programme_id=x.programme_id),'[]'::jsonb),
  'invitations',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',i.id,'identity',CASE i.artist_type WHEN 'solo' THEN jsonb_build_object('type','solo','artistProfileId',i.artist_profile_id) WHEN 'band' THEN jsonb_build_object('type','band','bandId',i.band_id) ELSE jsonb_build_object('type','npc','npcArtistId',i.npc_artist_id) END,
    'status',i.status,'version',i.version,'message',coalesce(i.message,''),'suggestedFeeMinor',i.suggested_fee_minor,'suggestedSetMinutes',i.suggested_set_minutes,
    'suggestedDates',to_jsonb(i.suggested_dates),'suggestedStageTypes',to_jsonb(i.suggested_stage_types),'expiresAt',i.expires_at,'createdAt',i.created_at,'canRespond',false)
    ORDER BY i.created_at DESC,i.id) FROM public.festival_artist_invitations i WHERE i.festival_artist_programme_id=x.programme_id),'[]'::jsonb),
  'offers',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',o.id,'identity',CASE o.artist_type WHEN 'solo' THEN jsonb_build_object('type','solo','artistProfileId',o.artist_profile_id) WHEN 'band' THEN jsonb_build_object('type','band','bandId',o.band_id) ELSE jsonb_build_object('type','npc','npcArtistId',o.npc_artist_id) END,
    'applicationId',o.application_id,'invitationId',o.invitation_id,'status',o.status,'offeredFeeMinor',o.offered_fee_minor,'currencyCode',o.currency_code,
    'setMinutes',o.set_minutes,'performanceCount',o.performance_count,'preferredDate',o.preferred_date,'preferredStageId',o.preferred_stage_id,
    'billingPosition',o.billing_position,'travelSupportMinor',o.travel_support_minor,'accommodationSupportMinor',o.accommodation_support_minor,
    'merchRevenueShareBasisPoints',o.merch_revenue_share_basis_points,'responseDeadline',o.response_deadline,'offerVersion',o.offer_version,
    'revisions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'offerVersion',r.offer_version,'proposedByParty',r.proposed_by_party,
      'proposedByProfileId',r.proposed_by_profile_id,'feeMinor',r.fee_minor,'setMinutes',r.set_minutes,'preferredDate',r.preferred_date,
      'preferredStageId',r.preferred_stage_id,'billingPosition',r.billing_position,'travelSupportMinor',r.travel_support_minor,
      'accommodationSupportMinor',r.accommodation_support_minor,'merchRevenueShareBasisPoints',r.merch_revenue_share_basis_points,
      'termsSnapshot',r.terms_snapshot,'message',coalesce(r.message,''),'createdAt',r.created_at) ORDER BY r.offer_version,r.created_at)
      FROM public.festival_artist_offer_revisions r WHERE r.offer_id=o.id),'[]'::jsonb),'canRespond',false)
    ORDER BY o.created_at DESC,o.id) FROM public.festival_artist_offers o WHERE o.festival_artist_programme_id=x.programme_id),'[]'::jsonb),
  'bookings',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',b.id,'offerId',b.offer_id,'identity',CASE b.artist_type WHEN 'solo' THEN jsonb_build_object('type','solo','artistProfileId',b.artist_profile_id) WHEN 'band' THEN jsonb_build_object('type','band','bandId',b.band_id) ELSE jsonb_build_object('type','npc','npcArtistId',b.npc_artist_id) END,
    'status',b.status,'agreedFeeMinor',b.agreed_fee_minor,'travelSupportMinor',b.travel_support_minor,'accommodationSupportMinor',b.accommodation_support_minor,
    'totalCommitmentMinor',b.total_commitment_minor,'currencyCode',b.currency_code,'setMinutes',b.set_minutes,'performanceCount',b.performance_count,
    'provisionalDate',b.provisional_date,'provisionalStageId',b.provisional_stage_id,'billingPosition',b.billing_position,'confirmedAt',b.confirmed_at)
    ORDER BY b.confirmed_at DESC,b.id) FROM public.festival_artist_bookings b WHERE b.festival_artist_programme_id=x.programme_id),'[]'::jsonb),
  'budget',jsonb_build_object('artistBudgetMinor',coalesce(x.artist_budget_minor,0),'contingencyBudgetMinor',coalesce(x.contingency_budget_minor,0),
    'draftOfferCommitmentsMinor',ot.draft_commitments,'sentOfferCommitmentsMinor',ot.sent_commitments,'acceptedCommitmentsMinor',bt.accepted_commitments,
    'remainingMinor',greatest(0,coalesce(x.artist_budget_minor,0)+coalesce(x.contingency_budget_minor,0)-bt.accepted_commitments-ot.sent_commitments),
    'potentialApplicationRequestsMinor',at.potential_requests,'headlineBudgetShareBasisPoints',CASE WHEN bt.accepted_commitments=0 THEN 0 ELSE floor(bt.headline_commitments*10000.0/bt.accepted_commitments)::integer END,
    'playerArtistBudgetShareBasisPoints',CASE WHEN bt.accepted_commitments=0 THEN 0 ELSE floor(bt.player_commitments*10000.0/bt.accepted_commitments)::integer END,
    'npcArtistBudgetShareBasisPoints',CASE WHEN bt.accepted_commitments=0 THEN 0 ELSE floor(bt.npc_commitments*10000.0/bt.accepted_commitments)::integer END),
  'issues',CASE WHEN x.programme_id IS NULL THEN jsonb_build_array(jsonb_build_object('code','festival_artist_programme_missing','severity','error','blocking',true,'entityType','programme','entityId',NULL,'messageKey','festival_artist_programme_missing'))
    WHEN bt.active_bookings=0 THEN jsonb_build_array(jsonb_build_object('code','festival_lineup_requires_confirmed_act','severity','error','blocking',true,'entityType','programme','entityId',x.programme_id,'messageKey','festival_lineup_requires_confirmed_act'))
    WHEN bt.accepted_commitments+ot.sent_commitments>coalesce(x.artist_budget_minor,0)+coalesce(x.contingency_budget_minor,0) THEN jsonb_build_array(jsonb_build_object('code','festival_artist_budget_exceeded','severity','error','blocking',true,'entityType','programme','entityId',x.programme_id,'messageKey','festival_artist_budget_exceeded')) ELSE '[]'::jsonb END,
  'playerArtistCount',bt.player_bookings,'npcArtistCount',bt.npc_bookings,
  'playerArtistShareBasisPoints',CASE WHEN bt.active_bookings=0 THEN 0 ELSE floor(bt.player_bookings*10000.0/bt.active_bookings)::integer END,
  'ready',coalesce(x.programme_status='ready_for_operations' AND bt.active_bookings>0,false),
  'canWrite',x.edition_status NOT IN ('completed','cancelled') AND x.locked_at IS NULL,
  'planningVersion',coalesce(x.planning_version,0),'updatedAt',x.programme_updated_at)
FROM base x CROSS JOIN booking_totals bt CROSS JOIN offer_totals ot CROSS JOIN application_totals at
$$;

CREATE OR REPLACE FUNCTION public.save_festival_edition_artist_programme(
  p_festival_company_id uuid,p_festival_edition_id uuid,p_expected_version integer,
  p_programme jsonb,p_application_windows jsonb,p_idempotency_key uuid,p_complete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','extensions'
AS $$
DECLARE
  actor uuid:=public._caller_profile_id(); edition public.festival_editions_v2%ROWTYPE;
  ticket public.festival_ticket_plans%ROWTYPE; programme public.festival_artist_programmes%ROWTYPE;
  request public.festival_artist_plan_requests%ROWTYPE; payload_hash text; application_mode text;
  artist_budget bigint; contingency_budget bigint; minimum_fame integer; maximum_fame integer;
  preferred_genres text[]; excluded_genres text[]; window_payload jsonb; response jsonb;
  old_version integer; active_bookings integer:=0; accepted_commitments bigint:=0; sent_commitments bigint:=0;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL OR NOT public._festival_company_manager_authorized(p_festival_company_id,actor) THEN
    RAISE EXCEPTION 'festival_artist_programme_forbidden' USING ERRCODE='P0001'; END IF;
  SELECT * INTO edition FROM public.festival_editions_v2 WHERE id=p_festival_edition_id AND festival_company_id=p_festival_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE='P0001'; END IF;
  IF edition.status IN ('completed','cancelled') OR edition.locked_at IS NOT NULL THEN RAISE EXCEPTION 'festival_artist_programme_locked' USING ERRCODE='P0001'; END IF;
  PERFORM public.materialize_festival_edition_foundations(p_festival_company_id,p_festival_edition_id);
  SELECT * INTO ticket FROM public.festival_ticket_plans WHERE festival_edition_id=edition.id;
  IF NOT FOUND OR ticket.status<>'ready_for_artist_planning' THEN RAISE EXCEPTION 'festival_ticket_plan_incomplete' USING ERRCODE='P0001'; END IF;

  application_mode:=p_programme->>'applicationMode'; artist_budget:=coalesce(nullif(p_programme->>'artistBudgetMinor','')::bigint,0);
  contingency_budget:=coalesce(nullif(p_programme->>'contingencyBudgetMinor','')::bigint,0);
  minimum_fame:=nullif(p_programme->>'minimumArtistFame','')::integer; maximum_fame:=nullif(p_programme->>'maximumArtistFame','')::integer;
  SELECT coalesce(array_agg(value),'{}'::text[]) INTO preferred_genres FROM jsonb_array_elements_text(coalesce(p_programme->'preferredGenres','[]'::jsonb)) value;
  SELECT coalesce(array_agg(value),'{}'::text[]) INTO excluded_genres FROM jsonb_array_elements_text(coalesce(p_programme->'excludedGenres','[]'::jsonb)) value;
  IF application_mode NOT IN ('closed','invite_only','applications_only','hybrid') OR artist_budget<0 OR contingency_budget<0
     OR (maximum_fame IS NOT NULL AND minimum_fame IS NOT NULL AND maximum_fame<minimum_fame) THEN RAISE EXCEPTION 'festival_artist_programme_invalid' USING ERRCODE='P0001'; END IF;

  payload_hash:=encode(extensions.digest(jsonb_build_object('festivalEditionId',edition.id,'expectedVersion',p_expected_version,'programme',p_programme,'applicationWindows',p_application_windows,'complete',p_complete)::text,'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(edition.id::text||p_idempotency_key::text,0));
  SELECT * INTO request FROM public.festival_artist_plan_requests WHERE caller_profile_id=actor AND target_entity_id=edition.id AND action='save_edition_programme' AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF request.payload_hash<>payload_hash THEN RAISE EXCEPTION 'festival_artist_idempotency_conflict' USING ERRCODE='P0001'; END IF;
    IF request.status IN ('succeeded','completed') AND request.result IS NOT NULL THEN RETURN request.result; END IF;
  ELSE
    INSERT INTO public.festival_artist_plan_requests(festival_company_id,caller_profile_id,target_entity_id,target_entity_type,action,idempotency_key,payload_hash,status)
    VALUES(edition.festival_company_id,actor,edition.id,'festival_edition','save_edition_programme',p_idempotency_key,payload_hash,'processing') RETURNING * INTO request;
  END IF;

  SELECT coalesce(max(planning_version),0) INTO old_version FROM public.festival_artist_programmes WHERE festival_edition_id=edition.id;
  IF old_version<>p_expected_version THEN RAISE EXCEPTION 'festival_artist_programme_stale' USING ERRCODE='P0001'; END IF;
  SELECT count(*)::integer,coalesce(sum(total_commitment_minor),0)::bigint INTO active_bookings,accepted_commitments
    FROM public.festival_artist_bookings b JOIN public.festival_artist_programmes ap ON ap.id=b.festival_artist_programme_id
    WHERE ap.festival_edition_id=edition.id AND b.status NOT IN ('cancelled','artist_withdrawn','festival_cancelled');
  SELECT coalesce(sum(o.offered_fee_minor+o.travel_support_minor+o.accommodation_support_minor),0)::bigint INTO sent_commitments
    FROM public.festival_artist_offers o JOIN public.festival_artist_programmes ap ON ap.id=o.festival_artist_programme_id
    WHERE ap.festival_edition_id=edition.id AND o.status IN ('sent','countered');
  IF p_complete AND active_bookings=0 THEN RAISE EXCEPTION 'festival_artist_programme_incomplete' USING ERRCODE='P0001'; END IF;
  IF p_complete AND accepted_commitments+sent_commitments>artist_budget+contingency_budget THEN RAISE EXCEPTION 'festival_artist_offer_budget_exceeded' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.festival_artist_programmes(festival_company_id,festival_edition_id,festival_ticket_plan_id,currency_code,application_mode,applications_open_at,applications_close_at,minimum_artist_fame,maximum_artist_fame,preferred_genres,excluded_genres,artist_budget_minor,contingency_budget_minor,minimum_player_artist_share_basis_points,status,planning_version,completed_at)
  VALUES(edition.festival_company_id,edition.id,ticket.id,ticket.currency_code,application_mode,nullif(p_programme->>'applicationsOpenAt','')::timestamptz,nullif(p_programme->>'applicationsCloseAt','')::timestamptz,minimum_fame,maximum_fame,preferred_genres,excluded_genres,artist_budget,contingency_budget,coalesce(nullif(p_programme->>'minimumPlayerArtistShareBasisPoints','')::integer,0),CASE WHEN p_complete THEN 'ready_for_operations' ELSE CASE WHEN active_bookings>0 THEN 'bookings_in_progress' ELSE 'applications_configured' END END,1,CASE WHEN p_complete THEN now() ELSE NULL END)
  ON CONFLICT(festival_edition_id) WHERE festival_edition_id IS NOT NULL DO UPDATE SET
    festival_ticket_plan_id=EXCLUDED.festival_ticket_plan_id,currency_code=EXCLUDED.currency_code,application_mode=EXCLUDED.application_mode,
    applications_open_at=EXCLUDED.applications_open_at,applications_close_at=EXCLUDED.applications_close_at,minimum_artist_fame=EXCLUDED.minimum_artist_fame,
    maximum_artist_fame=EXCLUDED.maximum_artist_fame,preferred_genres=EXCLUDED.preferred_genres,excluded_genres=EXCLUDED.excluded_genres,
    artist_budget_minor=EXCLUDED.artist_budget_minor,contingency_budget_minor=EXCLUDED.contingency_budget_minor,
    minimum_player_artist_share_basis_points=EXCLUDED.minimum_player_artist_share_basis_points,status=EXCLUDED.status,
    planning_version=public.festival_artist_programmes.planning_version+1,updated_at=now(),completed_at=EXCLUDED.completed_at RETURNING * INTO programme;

  IF application_mode IN ('applications_only','hybrid') AND jsonb_array_length(coalesce(p_application_windows,'[]'::jsonb))>0 THEN
    window_payload:=p_application_windows->0;
    IF (window_payload->>'opensAt')::timestamptz>=(window_payload->>'closesAt')::timestamptz OR (window_payload->>'closesAt')::timestamptz>=edition.starts_on::timestamptz THEN RAISE EXCEPTION 'festival_artist_application_window_invalid' USING ERRCODE='P0001'; END IF;
    INSERT INTO public.festival_artist_application_windows(festival_artist_programme_id,name,opens_at,closes_at,eligible_artist_type,minimum_fame,maximum_fame,preferred_genres,minimum_band_members,maximum_band_members,target_stage_types,maximum_set_minutes,active)
    VALUES(programme.id,coalesce(nullif(btrim(window_payload->>'name'),''),'General Festival applications'),(window_payload->>'opensAt')::timestamptz,(window_payload->>'closesAt')::timestamptz,coalesce(window_payload->>'eligibleArtistType','player_only'),nullif(window_payload->>'minimumFame','')::integer,nullif(window_payload->>'maximumFame','')::integer,ARRAY(SELECT jsonb_array_elements_text(coalesce(window_payload->'preferredGenres','[]'::jsonb))),nullif(window_payload->>'minimumBandMembers','')::integer,nullif(window_payload->>'maximumBandMembers','')::integer,ARRAY(SELECT jsonb_array_elements_text(coalesce(window_payload->'targetStageTypes','[]'::jsonb))),coalesce(nullif(window_payload->>'maximumSetMinutes','')::integer,60),true)
    ON CONFLICT(festival_artist_programme_id,name) DO UPDATE SET opens_at=EXCLUDED.opens_at,closes_at=EXCLUDED.closes_at,eligible_artist_type=EXCLUDED.eligible_artist_type,minimum_fame=EXCLUDED.minimum_fame,maximum_fame=EXCLUDED.maximum_fame,preferred_genres=EXCLUDED.preferred_genres,minimum_band_members=EXCLUDED.minimum_band_members,maximum_band_members=EXCLUDED.maximum_band_members,target_stage_types=EXCLUDED.target_stage_types,maximum_set_minutes=EXCLUDED.maximum_set_minutes,active=true,version=public.festival_artist_application_windows.version+1,updated_at=now();
  ELSE
    UPDATE public.festival_artist_application_windows SET active=false,updated_at=now() WHERE festival_artist_programme_id=programme.id;
  END IF;

  response:=public._festival_edition_artist_programme_result(p_festival_company_id,p_festival_edition_id);
  UPDATE public.festival_artist_plan_requests SET status='succeeded',result=response,completed_at=now() WHERE id=request.id;
  RETURN response;
END;
$$;

REVOKE ALL ON FUNCTION public._festival_edition_artist_programme_result(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_festival_edition_artist_programme(uuid,uuid,integer,jsonb,jsonb,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_festival_edition_artist_programme(uuid,uuid,integer,jsonb,jsonb,uuid,boolean) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
