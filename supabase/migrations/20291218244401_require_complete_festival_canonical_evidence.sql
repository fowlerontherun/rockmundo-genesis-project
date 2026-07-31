-- Applied Festival effects must carry the complete domain-evidence envelope.
-- This still does not make the receipt authoritative: the canonical ID must
-- identify the typed domain row and may never identify this audit table.
CREATE OR REPLACE FUNCTION public._festival_assert_canonical_result(
 p_effect public.festival_edition_settlement_effects,p_canonical_id text,p_result jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE expected_type text; expected_authority text; outcome_rules text;
BEGIN
 expected_type:=CASE p_effect.effect_type
  WHEN 'performance_result' THEN 'performance_outcome' WHEN 'band_fans' THEN 'fan_event'
  WHEN 'band_fame' THEN 'fame_event' WHEN 'member_xp' THEN 'xp_transaction'
  WHEN 'band_chemistry' THEN 'contribution_event' WHEN 'song_familiarity' THEN 'song_progression_event'
  WHEN 'song_popularity' THEN 'song_popularity_event' WHEN 'festival_company_reputation' THEN 'company_reputation_event'
  WHEN 'festival_company_fame' THEN 'company_fame_event' WHEN 'artist_relationship' THEN 'artist_relationship_event'
  WHEN 'sponsor_relationship' THEN 'sponsor_relationship_event' WHEN 'achievement_award' THEN 'achievement_award'
  WHEN 'licence_progress' THEN 'licence_progress_record' WHEN 'world_event' THEN 'world_event'
  WHEN 'notification' THEN 'notification' WHEN 'tax_projection' THEN 'tax_projection' END;
 expected_authority:=CASE p_effect.effect_type
  WHEN 'performance_result' THEN 'apply_festival_performance_result_effect'
  WHEN 'band_fans' THEN 'apply_festival_band_fans_effect'
  WHEN 'band_fame' THEN 'apply_festival_band_fame_effect'
  WHEN 'member_xp' THEN 'apply_festival_member_xp_effect'
  WHEN 'band_chemistry' THEN 'apply_festival_band_chemistry_effect'
  WHEN 'song_familiarity' THEN 'apply_festival_song_familiarity_effect'
  WHEN 'song_popularity' THEN 'apply_festival_song_popularity_effect'
  WHEN 'festival_company_reputation' THEN 'apply_festival_company_reputation_effect'
  WHEN 'festival_company_fame' THEN 'apply_festival_company_fame_effect'
  WHEN 'artist_relationship' THEN 'apply_festival_artist_relationship_effect'
  WHEN 'sponsor_relationship' THEN 'apply_festival_sponsor_relationship_effect'
  WHEN 'achievement_award' THEN 'apply_festival_achievement_effect'
  WHEN 'licence_progress' THEN 'apply_festival_licence_progress_effect'
  WHEN 'world_event' THEN 'apply_festival_world_event_effect'
  WHEN 'notification' THEN 'apply_festival_notification_effect'
  WHEN 'tax_projection' THEN 'apply_festival_tax_projection_effect' END;
 SELECT rules_version INTO outcome_rules FROM public.festival_edition_settlement_outcomes WHERE id=p_effect.outcome_id;
 IF expected_type IS NULL OR expected_authority IS NULL OR p_canonical_id IS NULL
   OR p_result->>'canonical_record_id'<>p_canonical_id
   OR p_result->>'canonical_record_type'<>expected_type
   OR p_result->>'canonical_authority'<>expected_authority
   OR nullif(p_result->>'canonical_table_or_service','') IS NULL
   OR p_result->>'canonical_table_or_service'='festival_effect_authority_results'
   OR p_result->>'stable_reference'<>p_effect.stable_reference
   OR p_result->>'subject_type'<>p_effect.subject_type OR p_result->>'subject_id'<>p_effect.subject_id
   OR nullif(p_result->>'evidence_digest','') IS NULL
   OR p_result->>'rules_version' IS DISTINCT FROM outcome_rules
   OR p_result->'requested_change' IS DISTINCT FROM p_effect.requested_payload
   OR jsonb_typeof(p_result->'before_state')<>'object'
   OR jsonb_typeof(p_result->'requested_change')<>'object'
   OR jsonb_typeof(p_result->'validated_change')<>'object'
   OR jsonb_typeof(p_result->'after_state')<>'object'
   OR nullif(p_result->>'applied_at','') IS NULL THEN
   PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CANONICAL_RESULT_INVALID');
 END IF;
 BEGIN PERFORM (p_result->>'applied_at')::timestamptz;
 EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CANONICAL_RESULT_INVALID');
 END;
 IF EXISTS(SELECT 1 FROM public.festival_effect_authority_results r WHERE r.id::text=p_canonical_id) THEN
  PERFORM public._festival_edition_settlement_error('FESTIVAL_EFFECT_CANONICAL_RESULT_INVALID');
 END IF;
END $$;

REVOKE ALL ON FUNCTION public._festival_assert_canonical_result(public.festival_edition_settlement_effects,text,jsonb)
 FROM PUBLIC,anon,authenticated;
