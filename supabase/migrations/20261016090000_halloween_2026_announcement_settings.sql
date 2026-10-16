-- Halloween announcement is distinct from the editable generic news banner.
-- It cannot advertise unimplemented XP/performance rewards until BOTH switches
-- are explicitly enabled by an admin after the gig reward integration is live.
-- The timestamp bounds are authoritative real-world Europe/London times.
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'halloween_2026_event',
  jsonb_build_object(
    'enabled', false,
    'rewards_live', false,
    'starts_at', ('2026-10-24 00:00 Europe/London')::timestamptz,
    'ends_at', ('2026-11-02 00:00 Europe/London')::timestamptz
  ),
  'Controls the login, dashboard and public announcement of The Haunted Stage 2026. Enable only after server-side gig rewards have passed deployment checks.'
)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
