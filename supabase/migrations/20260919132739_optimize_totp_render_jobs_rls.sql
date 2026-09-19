DROP POLICY IF EXISTS "Admins can view render jobs" ON public.totp_render_jobs;
CREATE POLICY "Admins can view render jobs"
ON public.totp_render_jobs FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'admin'));