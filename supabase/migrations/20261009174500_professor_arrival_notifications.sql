-- Arrival announcements are generated only once per residency and player.
CREATE UNIQUE INDEX IF NOT EXISTS professor_arrival_notification_dedupe
ON public.notifications (profile_id, ((metadata->>'residency_id')))
WHERE type = 'visiting_professor_arrival';

CREATE OR REPLACE FUNCTION public.announce_travelling_professors(
  p_month date DEFAULT (now() AT TIME ZONE 'UTC')::date
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_month timestamptz := date_trunc('month', p_month::timestamp) AT TIME ZONE 'UTC';
BEGIN
  INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
  SELECT DISTINCT
    p.user_id, p.id, 'education', 'visiting_professor_arrival',
    'Visiting Super Professor at your university',
    format('%s is visiting %s this month. Earn +70%% attendance XP for %s courses.',
      prof.name, u.name, replace(prof.skill_family, '_', ' ')),
    '/university/' || u.id::text,
    jsonb_build_object('residency_id', r.id, 'professor_id', prof.id,
      'university_id', u.id, 'skill_family', prof.skill_family, 'bonus', 0.70)
  FROM public.professor_residencies r
  JOIN public.travelling_professors prof ON prof.id = r.professor_id AND prof.is_enabled
  JOIN public.universities u ON u.id = r.university_id
  JOIN public.player_university_enrollments e ON e.university_id = r.university_id
    AND e.status IN ('enrolled', 'in_progress')
  JOIN public.profiles p ON p.id = e.profile_id AND p.user_id = e.user_id
  JOIN public.university_courses c ON c.id = e.course_id
  JOIN public.professor_skill_memberships m ON m.skill_slug = c.skill_slug
    AND m.skill_family = prof.skill_family
  WHERE r.starts_at = v_month AND r.starts_at <= now() AND r.ends_at > now()
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.announce_travelling_professors(date)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announce_travelling_professors(date) TO service_role;
