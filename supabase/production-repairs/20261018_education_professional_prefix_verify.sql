-- Read-only regression assertions. Applied on live DB 2026-10-18.
DO $verify$
DECLARE fake_profile uuid := '00000000-0000-0000-0000-000000000000';
DECLARE mapped_count integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.skill_definitions sd
    WHERE sd.slug::text LIKE 'professional_%'
      AND coalesce(sd.tier_caps->>'requires', '') = ''
      AND NOT EXISTS (SELECT 1 FROM public.skill_parent_links spl WHERE spl.skill_id=sd.id)
      AND public.skill_tier_unlocked(fake_profile,sd.slug::text)
  ) THEN
    RAISE EXCEPTION 'Professional tier bypasses prerequisite for zero-progress profile';
  END IF;
  SELECT count(*) INTO mapped_count
  FROM public.skill_definitions sd JOIN (
    VALUES
      ('professional_ai_music_integration','basic_ai_music_tools'),
      ('professional_social_media_musician','basic_social_media_performance'),
      ('professional_streaming_shows','basic_streaming_concerts'),
      ('professional_vocal_production','basic_vocal_tuning_processing')
  ) AS mapping(professional,basic) ON mapping.professional=sd.slug::text
  WHERE sd.tier_caps->>'requires'=mapping.basic
    AND (sd.tier_caps->>'required_level')::integer=public.progression_skill_max_level(mapping.basic);
  IF mapped_count<>4 THEN RAISE EXCEPTION 'Expected 4 explicit university prerequisite mappings, got %',mapped_count; END IF;
  IF NOT public.skill_tier_unlocked(fake_profile,'guitar')
     OR NOT public.skill_tier_unlocked(fake_profile,'basic_mixing_mastering')
     OR public.skill_tier_unlocked(fake_profile,'guitar_mastery')
     OR public.skill_tier_unlocked(fake_profile,'professional_live_looping') THEN
    RAISE EXCEPTION 'Basic, Professional, or Mastery regression';
  END IF;
END $verify$;
