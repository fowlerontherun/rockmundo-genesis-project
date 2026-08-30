-- 1. Ensure every city has an active laws row
INSERT INTO public.city_laws (city_id)
SELECT c.id FROM public.cities c
WHERE NOT EXISTS (
  SELECT 1 FROM public.city_laws l WHERE l.city_id = c.id AND l.effective_until IS NULL
);

-- 2. Ensure treasury + development rows exist
INSERT INTO public.city_treasury (city_id) SELECT c.id FROM public.cities c
ON CONFLICT (city_id) DO NOTHING;
INSERT INTO public.city_development (city_id) SELECT c.id FROM public.cities c
ON CONFLICT (city_id) DO NOTHING;

-- 3. Seed the project catalogue
INSERT INTO public.city_project_types (slug, category, name, description, base_cost, duration_days, effects, approval_change, required_skill_slug, required_skill_level, icon)
VALUES
  ('road_resurfacing','infrastructure','Road Resurfacing Programme','Repave the main arteries so tour buses and crews move around the city faster.',60000,7,'{"infrastructure_rating":3,"transport_rating":2}',4,NULL,0,'road'),
  ('transit_expansion','infrastructure','Public Transit Expansion','Add tram and bus lines that make late-night gigs easier to reach.',180000,14,'{"transport_rating":6,"quality_of_life_rating":2}',7,'basic_governance',200,'train'),
  ('power_grid_upgrade','infrastructure','Power Grid Upgrade','Reinforce the grid so large venues can run full production without brownouts.',240000,18,'{"infrastructure_rating":6,"economy_rating":2}',5,'basic_governance',200,'zap'),
  ('airport_terminal','infrastructure','Airport Terminal Extension','A new terminal shortens international travel in and out of the city.',600000,30,'{"transport_rating":9,"tourism_rating":4,"economy_rating":3}',9,'basic_governance',500,'plane'),
  ('flood_defences','infrastructure','Flood Defence Works','Protect venues and studios in the riverside districts.',320000,21,'{"infrastructure_rating":5,"public_safety_rating":4}',6,'basic_governance',500,'shield'),
  ('community_music_hall','culture','Community Music Hall','A mid-size municipal hall for emerging local acts.',150000,14,'{"venues":1,"culture_rating":4,"music_scene_rating":5}',8,NULL,0,'music'),
  ('street_art_quarter','culture','Street Art Quarter','Fund murals and open-air stages in the old warehouse district.',80000,10,'{"culture_rating":4,"tourism_rating":2,"music_scene_rating":2}',6,NULL,0,'palette'),
  ('city_festival_grounds','culture','City Festival Grounds','Permanent festival site with power, drainage and crowd infrastructure.',450000,25,'{"culture_rating":6,"music_scene_rating":6,"tourism_rating":5,"max_concert_capacity":20000}',10,'basic_governance',500,'tent'),
  ('music_academy','culture','Municipal Music Academy','Public teaching facility that grows the next generation of local players.',260000,20,'{"education_rating":5,"music_scene_rating":4,"culture_rating":3}',7,'basic_governance',200,'graduation-cap'),
  ('heritage_restoration','culture','Heritage Venue Restoration','Restore a historic theatre back into a working venue.',300000,22,'{"venues":1,"culture_rating":5,"tourism_rating":3}',8,'professional_diplomacy',500,'landmark'),
  ('business_district','economy','Business District Incentives','Tax incentives that pull labels, promoters and studios into the city.',280000,21,'{"economy_rating":6,"weekly_budget_bonus":4000}',3,'basic_negotiation',200,'briefcase'),
  ('tourism_campaign','economy','International Tourism Campaign','Global marketing push positioning the city as a music destination.',140000,14,'{"tourism_rating":6,"economy_rating":2}',5,'basic_negotiation',200,'megaphone'),
  ('convention_centre','economy','Convention & Expo Centre','Host industry conferences, showcases and trade events.',520000,28,'{"economy_rating":7,"tourism_rating":4,"weekly_budget_bonus":7000}',6,'basic_governance',500,'building-2'),
  ('startup_incubator','economy','Creative Startup Incubator','Support small music businesses with subsidised workspace.',120000,14,'{"economy_rating":4,"education_rating":2}',4,NULL,0,'rocket'),
  ('night_economy_plan','economy','Night-Time Economy Strategy','Coordinated licensing, transport and safety plan for the night scene.',200000,18,'{"economy_rating":4,"music_scene_rating":4,"public_safety_rating":2}',6,'master_statecraft',500,'moon'),
  ('city_hospital_wing','quality_of_life','New Hospital Wing','Extra capacity means faster recovery for touring musicians.',420000,26,'{"healthcare_rating":8,"quality_of_life_rating":3}',9,'basic_governance',500,'heart-pulse'),
  ('community_policing','quality_of_life','Community Policing Programme','Safer streets around venues and late-night transport hubs.',160000,14,'{"public_safety_rating":6,"quality_of_life_rating":2}',6,NULL,0,'shield-check'),
  ('city_parks','quality_of_life','City Parks & Green Spaces','Parks and open-air stages that lift everyday life in the city.',110000,12,'{"quality_of_life_rating":5,"culture_rating":2,"tourism_rating":2}',7,NULL,0,'trees'),
  ('affordable_housing','quality_of_life','Affordable Housing Scheme','Housing that keeps artists and crew living in the city.',480000,30,'{"quality_of_life_rating":7,"population":15000,"economy_rating":2}',8,'basic_governance',500,'home'),
  ('addiction_support','quality_of_life','Addiction Support Services','Clinics and outreach for a hard-living music city.',180000,16,'{"healthcare_rating":5,"quality_of_life_rating":3,"public_safety_rating":2}',7,'master_statecraft',800,'life-buoy')
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

GRANT SELECT ON public.city_project_types TO anon, authenticated;
GRANT ALL ON public.city_project_types TO service_role;
GRANT SELECT ON public.city_projects TO anon, authenticated;
GRANT ALL ON public.city_projects TO service_role;

-- 4. Helper: politics skill xp for a profile
CREATE OR REPLACE FUNCTION public.city_politics_skill_value(p_profile_id uuid, p_slug text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(GREATEST(COALESCE(sp.current_xp, 0), COALESCE(sp.current_level, 0))), 0)::integer
  FROM public.skill_progress sp
  WHERE sp.profile_id = p_profile_id AND sp.skill_slug = p_slug;
$$;

-- 5. Propose a project
CREATE OR REPLACE FUNCTION public.propose_city_project(
  p_city_id uuid,
  p_project_type_id uuid,
  p_profile_id uuid
)
RETURNS public.city_projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mayor public.city_mayors%ROWTYPE;
  v_type public.city_project_types%ROWTYPE;
  v_treasury public.city_treasury%ROWTYPE;
  v_discount integer;
  v_cost bigint;
  v_available bigint;
  v_project public.city_projects%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'city_governance_auth_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr WHERE pr.id = p_profile_id AND pr.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'city_governance_profile_forbidden';
  END IF;

  SELECT * INTO v_mayor
  FROM public.city_mayors
  WHERE city_id = p_city_id AND profile_id = p_profile_id AND is_current = true;

  IF v_mayor.id IS NULL THEN
    RAISE EXCEPTION 'city_project_mayor_required';
  END IF;

  SELECT * INTO v_type FROM public.city_project_types WHERE id = p_project_type_id;
  IF v_type.id IS NULL THEN
    RAISE EXCEPTION 'city_project_type_not_found';
  END IF;

  IF v_type.required_skill_slug IS NOT NULL AND v_type.required_skill_level > 0 THEN
    IF public.city_politics_skill_value(p_profile_id, v_type.required_skill_slug) < v_type.required_skill_level THEN
      RAISE EXCEPTION 'city_project_skill_required';
    END IF;
  END IF;

  v_discount := LEAST(15, GREATEST(0, (public.city_politics_skill_value(p_profile_id, 'basic_negotiation') / 50) + 5));
  v_cost := GREATEST(0, ROUND(v_type.base_cost * (1 - v_discount / 100.0)))::bigint;

  INSERT INTO public.city_treasury (city_id) VALUES (p_city_id) ON CONFLICT (city_id) DO NOTHING;
  SELECT * INTO v_treasury FROM public.city_treasury WHERE city_id = p_city_id FOR UPDATE;
  v_available := COALESCE(v_treasury.balance, 0) - COALESCE(v_treasury.pending_commitments, 0);

  IF v_available < v_cost THEN
    RAISE EXCEPTION 'city_project_insufficient_treasury';
  END IF;

  UPDATE public.city_treasury
  SET pending_commitments = COALESCE(pending_commitments, 0) + v_cost,
      updated_at = now()
  WHERE city_id = p_city_id;

  INSERT INTO public.city_projects (
    city_id, mayor_id, project_type_id, name, description, cost, duration_days,
    status, started_at, completes_at, effects, approval_change
  ) VALUES (
    p_city_id, v_mayor.id, v_type.id, v_type.name, v_type.description, v_cost, v_type.duration_days,
    'in_progress', now(), now() + make_interval(days => v_type.duration_days), v_type.effects, v_type.approval_change
  )
  RETURNING * INTO v_project;

  INSERT INTO public.mayor_actions_log (city_id, mayor_id, action_type, amount, target_id, notes, metadata)
  VALUES (p_city_id, v_mayor.id, 'project_started', v_cost, v_project.id,
          format('Started %s', v_type.name),
          jsonb_build_object('discount_pct', v_discount, 'project_type', v_type.slug));

  RETURN v_project;
END;
$$;

-- 6. Cancel a project
CREATE OR REPLACE FUNCTION public.cancel_city_project(
  p_project_id uuid,
  p_profile_id uuid
)
RETURNS public.city_projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.city_projects%ROWTYPE;
  v_mayor public.city_mayors%ROWTYPE;
  v_sunk bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'city_governance_auth_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr WHERE pr.id = p_profile_id AND pr.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'city_governance_profile_forbidden';
  END IF;

  SELECT * INTO v_project FROM public.city_projects WHERE id = p_project_id FOR UPDATE;
  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'city_project_not_found';
  END IF;

  SELECT * INTO v_mayor
  FROM public.city_mayors
  WHERE city_id = v_project.city_id AND profile_id = p_profile_id AND is_current = true;

  IF v_mayor.id IS NULL THEN
    RAISE EXCEPTION 'city_project_mayor_required';
  END IF;

  IF v_project.status <> 'in_progress' THEN
    RAISE EXCEPTION 'city_project_not_in_progress';
  END IF;

  v_sunk := GREATEST(0, ROUND(v_project.cost / 2.0))::bigint;

  UPDATE public.city_treasury
  SET pending_commitments = GREATEST(0, COALESCE(pending_commitments, 0) - v_project.cost),
      balance = COALESCE(balance, 0) - v_sunk,
      total_spent = COALESCE(total_spent, 0) + v_sunk,
      updated_at = now()
  WHERE city_id = v_project.city_id;

  UPDATE public.city_projects
  SET status = 'cancelled',
      notes = COALESCE(notes, '') || format('Cancelled by mayor. Sunk cost $%s.', v_sunk),
      updated_at = now()
  WHERE id = v_project.id
  RETURNING * INTO v_project;

  UPDATE public.city_mayors
  SET approval_rating = GREATEST(0, LEAST(100, COALESCE(approval_rating, 50) - 2))
  WHERE id = v_mayor.id;

  INSERT INTO public.mayor_actions_log (city_id, mayor_id, action_type, amount, target_id, notes, metadata)
  VALUES (v_project.city_id, v_mayor.id, 'project_cancelled', v_sunk, v_project.id,
          format('Cancelled %s', v_project.name), '{}'::jsonb);

  RETURN v_project;
END;
$$;

-- 7. Completion worker
CREATE OR REPLACE FUNCTION public.complete_due_city_projects()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.city_projects%ROWTYPE;
  v_count integer := 0;
BEGIN
  FOR v_project IN
    SELECT * FROM public.city_projects
    WHERE status = 'in_progress' AND completes_at <= now()
    ORDER BY completes_at
    LIMIT 200
  LOOP
    UPDATE public.city_treasury
    SET pending_commitments = GREATEST(0, COALESCE(pending_commitments, 0) - v_project.cost),
        balance = COALESCE(balance, 0) - v_project.cost,
        total_spent = COALESCE(total_spent, 0) + v_project.cost,
        weekly_budget = COALESCE(weekly_budget, 0) + COALESCE((v_project.effects ->> 'weekly_budget_bonus')::bigint, 0),
        updated_at = now()
    WHERE city_id = v_project.city_id;

    UPDATE public.cities
    SET venues = GREATEST(0, COALESCE(venues, 0) + COALESCE((v_project.effects ->> 'venues')::integer, 0)),
        population = GREATEST(0, COALESCE(population, 0) + COALESCE((v_project.effects ->> 'population')::integer, 0))
    WHERE id = v_project.city_id;

    UPDATE public.city_projects
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = v_project.id;

    IF v_project.mayor_id IS NOT NULL THEN
      UPDATE public.city_mayors
      SET approval_rating = GREATEST(0, LEAST(100, COALESCE(approval_rating, 50) + COALESCE(v_project.approval_change, 0))),
          projects_completed = COALESCE(projects_completed, 0) + 1
      WHERE id = v_project.mayor_id;
    END IF;

    INSERT INTO public.mayor_actions_log (city_id, mayor_id, action_type, amount, target_id, notes, metadata)
    VALUES (v_project.city_id, v_project.mayor_id, 'project_completed', v_project.cost, v_project.id,
            format('Completed %s', v_project.name), '{}'::jsonb);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.propose_city_project(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_city_project(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_due_city_projects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_city_project(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_city_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.city_politics_skill_value(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_due_city_projects() TO service_role;

SELECT cron.schedule('complete-due-city-projects', '*/10 * * * *', $$SELECT public.complete_due_city_projects();$$);