CREATE OR REPLACE FUNCTION public.release_departed_recruitment_slot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_application uuid;
  v_vacancy uuid;
  v_b public.bands%ROWTYPE;
  v_reserved integer;
  v_active_members integer;
  v_row public.band_vacancies%ROWTYPE;
BEGIN
  IF COALESCE(OLD.member_status,'active') <> 'active'
     OR COALESCE(OLD.is_touring_member,false)
     OR OLD.profile_id IS NULL THEN RETURN NULL; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.band_id=OLD.band_id AND NEW.profile_id=OLD.profile_id
       AND COALESCE(NEW.member_status,'active')='active'
       AND NOT COALESCE(NEW.is_touring_member,false) THEN RETURN NULL; END IF;
  END IF;

  -- Release only if exactly one accepted advert application identifies the departing character.
  SELECT CASE WHEN count(*)=1 THEN (array_agg(a.vacancy_id))[1] END INTO v_vacancy
  FROM public.band_applications a
  WHERE a.band_id=OLD.band_id AND a.applicant_profile_id=OLD.profile_id
    AND a.status='accepted' AND a.vacancy_id IS NOT NULL;
  IF v_vacancy IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_b FROM public.bands b WHERE b.id=OLD.band_id FOR UPDATE;
  SELECT * INTO v_row FROM public.band_vacancies v WHERE v.id=v_vacancy AND v.band_id=OLD.band_id FOR UPDATE;
  IF NOT FOUND OR v_row.positions_filled=0 THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_active_members FROM public.band_members bm
  WHERE bm.band_id=OLD.band_id AND COALESCE(bm.member_status,'active')='active'
    AND NOT COALESCE(bm.is_touring_member,false);
  SELECT COALESCE(sum(GREATEST(v.positions_available-v.positions_filled,0)),0) INTO v_reserved
  FROM public.band_vacancies v
  WHERE v.band_id=OLD.band_id AND v.id<>v_vacancy AND v.status='open'
    AND (v.application_deadline IS NULL OR v.application_deadline>now());

  UPDATE public.band_vacancies v
  SET positions_filled=GREATEST(v.positions_filled-1,0),
      status=CASE
        WHEN v.status<>'filled' THEN v.status
        WHEN v.application_deadline IS NOT NULL AND v.application_deadline<=now() THEN 'expired'
        WHEN v_b.status='active'::public.band_status AND COALESCE(v_b.is_recruiting,false)
          AND COALESCE(v_b.allow_applications,true)
          AND v_active_members+v_reserved+(v.positions_available-GREATEST(v.positions_filled-1,0)) <= COALESCE(v_b.max_members,4)
          THEN 'open'
        ELSE 'paused' END,
      updated_at=now()
  WHERE v.id=v_vacancy;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS band_member_recruitment_slot_departure ON public.band_members;
CREATE TRIGGER band_member_recruitment_slot_departure
AFTER DELETE OR UPDATE OF band_id, profile_id, member_status, is_touring_member
ON public.band_members FOR EACH ROW EXECUTE FUNCTION public.release_departed_recruitment_slot();
REVOKE ALL ON FUNCTION public.release_departed_recruitment_slot() FROM PUBLIC, anon, authenticated;