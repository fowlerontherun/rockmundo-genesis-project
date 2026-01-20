-- Create system_settings table for global app settings
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read settings
CREATE POLICY "Anyone can read system settings" 
ON public.system_settings 
FOR SELECT 
USING (true);

-- Only admins can modify settings (we'll check admin status in application)
CREATE POLICY "Admins can update system settings" 
ON public.system_settings 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can insert system settings" 
ON public.system_settings 
FOR INSERT 
WITH CHECK (true);

-- Insert initial VIP sales setting
INSERT INTO public.system_settings (key, value, description)
VALUES ('vip_sales_enabled', 'true', 'Whether VIP subscription sales are enabled')
ON CONFLICT (key) DO NOTHING;