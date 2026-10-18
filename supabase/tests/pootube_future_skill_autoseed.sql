-- Confirm future skills automatically receive two fictional lessons,
-- while leaving no persistent test skills, episodes or player XP.
DO $check_autoseed_setup$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_trigger
   WHERE tgrelid='public.skill_definitions'::regclass
     AND tgname='trg_skill_definition_seed_pootube'
     AND tgenabled='O'
 ) THEN RAISE EXCEPTION 'New-skill PooTube auto-seeding trigger not enabled'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_indexes WHERE schemaname='public'
   AND tablename='education_youtube_resources'
   AND indexname='uq_education_pootube_internal_lesson_ref'
 ) THEN RAISE EXCEPTION 'Missing fictional lesson reference uniqueness index'; END IF;
 IF EXISTS (
   SELECT 1 FROM public.skill_definitions d WHERE
     (SELECT count(*) FROM public.education_youtube_resources r
      WHERE r.skill_slug::text=d.slug::text AND r.video_url LIKE 'pooutube://lesson/%') <2
 ) THEN RAISE EXCEPTION 'Existing skill catalogue not fully populated'; END IF;
END $check_autoseed_setup$;

BEGIN;
INSERT INTO public.skill_definitions(slug,display_name,description)
VALUES ('basic_pootube_fixture_20261018','PooTube Fixture Skill','Transaction-only future skill test.');
DO $verify_new_skill$
BEGIN
 IF (SELECT count(*) FROM public.education_youtube_resources
  WHERE skill_slug='basic_pootube_fixture_20261018'
    AND video_url LIKE 'pooutube://lesson/basic_pootube_fixture_20261018/%')<>2
 THEN RAISE EXCEPTION 'New skill should automatically receive exactly two lessons'; END IF;
END $verify_new_skill$;
ROLLBACK;

DO $verify_no_residue$
BEGIN
 IF EXISTS (SELECT 1 FROM public.skill_definitions WHERE slug='basic_pootube_fixture_20261018')
 OR EXISTS (SELECT 1 FROM public.education_youtube_resources WHERE skill_slug='basic_pootube_fixture_20261018')
 THEN RAISE EXCEPTION 'PooTube fixture leaked outside rollback'; END IF;
END $verify_no_residue$;
