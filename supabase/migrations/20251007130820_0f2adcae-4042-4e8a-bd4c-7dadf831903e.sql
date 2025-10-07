-- Create band chat messages table
CREATE TABLE public.band_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.band_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Band members can view messages
CREATE POLICY "Band members can view chat messages"
ON public.band_chat_messages
FOR SELECT
USING (
  band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
  )
);

-- Policy: Band members can send messages
CREATE POLICY "Band members can send messages"
ON public.band_chat_messages
FOR INSERT
WITH CHECK (
  band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- Add index for performance
CREATE INDEX idx_band_chat_messages_band_id ON public.band_chat_messages(band_id, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.band_chat_messages;

-- Create band earnings table
CREATE TABLE public.band_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  source VARCHAR NOT NULL,
  description TEXT,
  earned_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.band_earnings ENABLE ROW LEVEL SECURITY;

-- Policy: Band members can view earnings
CREATE POLICY "Band members can view earnings"
ON public.band_earnings
FOR SELECT
USING (
  band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
  )
);

-- Policy: System can insert earnings (for game mechanics)
CREATE POLICY "Authenticated users can insert earnings"
ON public.band_earnings
FOR INSERT
WITH CHECK (
  band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
  )
);

-- Add index for performance
CREATE INDEX idx_band_earnings_band_id ON public.band_earnings(band_id, created_at DESC);

-- Add band_balance column to bands table
ALTER TABLE public.bands 
ADD COLUMN band_balance INTEGER DEFAULT 0;