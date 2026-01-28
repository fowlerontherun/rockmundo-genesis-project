-- Create player_behavior_settings table
CREATE TABLE public.player_behavior_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  travel_comfort TEXT NOT NULL DEFAULT 'standard' CHECK (travel_comfort IN ('budget', 'standard', 'luxury')),
  hotel_standard TEXT NOT NULL DEFAULT 'standard' CHECK (hotel_standard IN ('hostel', 'budget', 'standard', 'luxury', 'suite')),
  partying_intensity TEXT NOT NULL DEFAULT 'moderate' CHECK (partying_intensity IN ('abstinent', 'light', 'moderate', 'heavy', 'legendary')),
  fan_interaction TEXT NOT NULL DEFAULT 'friendly' CHECK (fan_interaction IN ('distant', 'professional', 'friendly', 'wild')),
  media_behavior TEXT NOT NULL DEFAULT 'professional' CHECK (media_behavior IN ('reclusive', 'professional', 'outspoken', 'controversial')),
  afterparty_attendance TEXT NOT NULL DEFAULT 'sometimes' CHECK (afterparty_attendance IN ('never', 'sometimes', 'always')),
  entourage_size TEXT NOT NULL DEFAULT 'small' CHECK (entourage_size IN ('solo', 'small', 'medium', 'large')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_behavior_settings UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.player_behavior_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own behavior settings"
  ON public.player_behavior_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own behavior settings"
  ON public.player_behavior_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own behavior settings"
  ON public.player_behavior_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_player_behavior_settings_updated_at
  BEFORE UPDATE ON public.player_behavior_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_player_behavior_settings_user_id ON public.player_behavior_settings(user_id);