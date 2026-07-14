
-- Seed default rows for server status and announcement banner
INSERT INTO public.system_settings (key, value, description)
VALUES
  ('server_status', jsonb_build_object(
     'status', 'up',
     'message', 'RockMundo is online.'
   ), 'Global server status shown on the public landing and auth pages.'),
  ('announcement_banner', jsonb_build_object(
     'enabled', true,
     'title', 'Open Play Test · Friday 17 July',
     'body', 'A 1-week public play test starts Friday 17 July 2026 — no Beta code needed. Check Discord for details.',
     'cta_label', 'Discord',
     'cta_url', 'https://discord.gg/lovable-dev'
   ), 'News/announcement banner shown at the top of the public site.')
ON CONFLICT (key) DO NOTHING;

-- Tighten RLS: only admins can insert/update
DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can insert system settings" ON public.system_settings;

CREATE POLICY "Admins can update system settings"
  ON public.system_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert system settings"
  ON public.system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
