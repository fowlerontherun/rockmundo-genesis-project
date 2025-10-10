-- Create rehearsal_rooms table
CREATE TABLE public.rehearsal_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL,
  location VARCHAR,
  city_id UUID REFERENCES public.cities(id),
  hourly_rate INTEGER NOT NULL DEFAULT 50,
  quality_rating INTEGER DEFAULT 50,
  capacity INTEGER DEFAULT 10,
  equipment_quality INTEGER DEFAULT 50,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rehearsal_rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rehearsal_rooms
CREATE POLICY "Rehearsal rooms are viewable by everyone"
ON public.rehearsal_rooms FOR SELECT
USING (true);

CREATE POLICY "Admins can manage rehearsal rooms"
ON public.rehearsal_rooms FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create band_rehearsals table
CREATE TABLE public.band_rehearsals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  rehearsal_room_id UUID NOT NULL REFERENCES public.rehearsal_rooms(id),
  duration_hours INTEGER NOT NULL CHECK (duration_hours IN (2, 4, 6)),
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  total_cost INTEGER NOT NULL,
  chemistry_gain INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.band_rehearsals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for band_rehearsals
CREATE POLICY "Band members can view their rehearsals"
ON public.band_rehearsals FOR SELECT
USING (
  band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Band members can create rehearsals"
ON public.band_rehearsals FOR INSERT
WITH CHECK (
  band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Band members can update their rehearsals"
ON public.band_rehearsals FOR UPDATE
USING (
  band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_rehearsal_rooms_updated_at
BEFORE UPDATE ON public.rehearsal_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();