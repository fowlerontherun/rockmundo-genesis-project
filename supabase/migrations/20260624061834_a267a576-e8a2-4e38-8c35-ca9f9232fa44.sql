
CREATE TABLE public.beta_v2_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  discord_handle TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT INSERT ON public.beta_v2_signups TO anon;
GRANT INSERT, SELECT ON public.beta_v2_signups TO authenticated;
GRANT ALL ON public.beta_v2_signups TO service_role;

ALTER TABLE public.beta_v2_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register for beta v2"
  ON public.beta_v2_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view beta signups"
  ON public.beta_v2_signups
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
