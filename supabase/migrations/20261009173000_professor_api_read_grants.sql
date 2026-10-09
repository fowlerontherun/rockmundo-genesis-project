-- Read-only access to professor data for signed-in players.
GRANT SELECT ON public.travelling_professors TO authenticated;
GRANT SELECT ON public.professor_residencies TO authenticated;
GRANT SELECT ON public.professor_skill_memberships TO authenticated;
GRANT SELECT ON public.active_professor_residencies TO authenticated;
