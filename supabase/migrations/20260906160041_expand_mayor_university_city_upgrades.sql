-- Restore Portsmouth's university and expand mayor-controlled university/city investment.

INSERT INTO public.universities (
  name, city, city_id, prestige, quality_of_learning, course_cost_modifier,
  description, academic_cost_modifier, mayor_fee_modifier
)
SELECT
  'Harbor Lights Institute', c.name, c.id, 76, 82, 0.80,
  'Affordable quality education focused on practical musicianship.', 0.80, 1.00
FROM public.cities c
WHERE lower(c.name) = 'portsmouth'
ON CONFLICT (name, city) DO UPDATE
SET city_id = EXCLUDED.city_id,
    description = COALESCE(public.universities.description, EXCLUDED.description);

INSERT INTO public.city_project_types (
  slug, category, name, description, base_cost, duration_days, effects,
  approval_change, required_skill_slug, required_skill_level, icon
)
VALUES
  ('city_fibre_network','infrastructure','City Fibre Network','High-speed municipal connectivity for venues, studios, businesses and residents.',210000,16,'{"infrastructure_rating":4,"economy_rating":3,"quality_of_life_rating":1}',5,'basic_governance',200,'wifi'),
  ('harbour_transport_hub','infrastructure','Harbour Transport Hub','Integrated ferry, bus and freight links that improve touring access and waterfront travel.',360000,24,'{"transport_rating":7,"infrastructure_rating":4,"tourism_rating":2}',7,'basic_governance',500,'ship'),
  ('green_energy_grid','infrastructure','Green Energy Grid','Cleaner, more resilient power for homes, venues and major events.',300000,22,'{"infrastructure_rating":5,"quality_of_life_rating":3,"economy_rating":2}',6,'basic_governance',500,'leaf'),
  ('public_rehearsal_complex','culture','Public Rehearsal Complex','Affordable rehearsal rooms and shared backline for local musicians and new bands.',175000,15,'{"music_scene_rating":6,"culture_rating":4,"education_rating":2}',8,NULL,0,'guitar'),
  ('municipal_recording_hub','culture','Municipal Recording Hub','A city-backed recording and production centre supporting emerging artists.',290000,20,'{"music_scene_rating":6,"culture_rating":3,"economy_rating":2,"education_rating":2}',7,'basic_governance',200,'mic-2'),
  ('music_business_grants','economy','Music Business Growth Fund','Grants for promoters, labels, rehearsal spaces, instrument shops and independent studios.',225000,18,'{"economy_rating":5,"music_scene_rating":4,"weekly_budget_bonus":2500}',4,'basic_negotiation',200,'badge-pound-sterling'),
  ('waterfront_regeneration','economy','Waterfront Regeneration','Regenerate the waterfront with hospitality, public space and event infrastructure.',430000,28,'{"economy_rating":6,"tourism_rating":5,"quality_of_life_rating":3}',8,'basic_governance',500,'waves'),
  ('mental_health_network','quality_of_life','Mental Health Support Network','Expand counselling, crisis support and community wellbeing services.',210000,17,'{"healthcare_rating":5,"quality_of_life_rating":4}',8,NULL,0,'heart-handshake'),
  ('late_night_safety','quality_of_life','Late-Night Safety Programme','Lighting, transport marshals and safe routes around nightlife and venue districts.',150000,12,'{"public_safety_rating":5,"transport_rating":2,"quality_of_life_rating":2}',6,NULL,0,'moon-star'),
  ('student_artist_housing','quality_of_life','Student & Artist Housing','Affordable housing focused on students, musicians and creative workers.',340000,24,'{"quality_of_life_rating":5,"education_rating":3,"culture_rating":2,"population":6000}',7,'basic_governance',200,'building')
ON CONFLICT (slug) DO UPDATE
SET category = EXCLUDED.category,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    base_cost = EXCLUDED.base_cost,
    duration_days = EXCLUDED.duration_days,
    effects = EXCLUDED.effects,
    approval_change = EXCLUDED.approval_change,
    required_skill_slug = EXCLUDED.required_skill_slug,
    required_skill_level = EXCLUDED.required_skill_level,
    icon = EXCLUDED.icon;

CREATE OR REPLACE FUNCTION public.upgrade_university_prestige(
  p_university_id uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_university public.universities%ROWTYPE;
  v_mayor public.city_mayors%ROWTYPE;
  v_treasury public.city_treasury%ROWTYPE;
  v_cost bigint;
  v_available bigint;
  v_old_prestige integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'university_management_auth_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = p_profile_id AND pr.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'university_management_profile_forbidden';
  END IF;

  SELECT * INTO v_university
  FROM public.universities
  WHERE id = p_university_id
  FOR UPDATE;

  IF v_university.id IS NULL THEN
    RAISE EXCEPTION 'university_management_not_found';
  END IF;

  SELECT * INTO v_mayor
  FROM public.city_mayors
  WHERE city_id = v_university.city_id
    AND profile_id = p_profile_id
    AND is_current = true;

  IF v_mayor.id IS NULL THEN
    RAISE EXCEPTION 'university_management_mayor_required';
  END IF;

  v_old_prestige := COALESCE(v_university.prestige, 50);
  IF v_old_prestige >= 100 THEN
    RAISE EXCEPTION 'university_management_prestige_max';
  END IF;

  v_cost := ROUND(8000 + (POWER(v_old_prestige::numeric, 2) * 4))::bigint;

  INSERT INTO public.city_treasury (city_id)
  VALUES (v_university.city_id)
  ON CONFLICT (city_id) DO NOTHING;

  SELECT * INTO v_treasury
  FROM public.city_treasury
  WHERE city_id = v_university.city_id
  FOR UPDATE;

  v_available := COALESCE(v_treasury.balance, 0) - COALESCE(v_treasury.pending_commitments, 0);
  IF v_available < v_cost THEN
    RAISE EXCEPTION 'university_management_insufficient_treasury';
  END IF;

  UPDATE public.city_treasury
  SET balance = COALESCE(balance, 0) - v_cost,
      total_spent = COALESCE(total_spent, 0) + v_cost,
      updated_at = now()
  WHERE city_id = v_university.city_id;

  UPDATE public.universities
  SET prestige = v_old_prestige + 1,
      updated_at = now()
  WHERE id = v_university.id
  RETURNING * INTO v_university;

  INSERT INTO public.city_treasury_ledger (
    city_id, amount, type, description, reference_id
  ) VALUES (
    v_university.city_id,
    (-v_cost)::integer,
    'university_prestige_upgrade',
    format('Prestige investment for %s (%s to %s)', v_university.name, v_old_prestige, v_university.prestige),
    v_university.id
  );

  INSERT INTO public.mayor_actions_log (
    city_id, mayor_id, action_type, amount, target_id, notes, metadata
  ) VALUES (
    v_university.city_id,
    v_mayor.id,
    'university_prestige_upgraded',
    v_cost,
    v_university.id,
    format('Upgraded %s prestige from %s to %s', v_university.name, v_old_prestige, v_university.prestige),
    jsonb_build_object(
      'university_id', v_university.id,
      'old_prestige', v_old_prestige,
      'new_prestige', v_university.prestige,
      'quality_unchanged', v_university.quality_of_learning,
      'cost', v_cost
    )
  );

  RETURN jsonb_build_object(
    'university_id', v_university.id,
    'old_prestige', v_old_prestige,
    'new_prestige', v_university.prestige,
    'quality', v_university.quality_of_learning,
    'cost', v_cost
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upgrade_university_prestige(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upgrade_university_prestige(uuid, uuid) TO authenticated, service_role;
