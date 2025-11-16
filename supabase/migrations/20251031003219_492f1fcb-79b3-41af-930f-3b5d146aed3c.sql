-- Add encore support to setlist songs
ALTER TABLE setlist_songs 
ADD COLUMN IF NOT EXISTS is_encore BOOLEAN DEFAULT false;

-- Update gigs table to track slot type for time validation
ALTER TABLE gigs
ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'headline';

-- Create or replace the auto-start function to actually work
CREATE OR REPLACE FUNCTION auto_start_scheduled_gigs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Start gigs that are scheduled and past their start time
  UPDATE gigs
  SET 
    status = 'in_progress',
    started_at = NOW()
  WHERE 
    status = 'scheduled'
    AND scheduled_date <= NOW()
    AND started_at IS NULL;
END;
$$;

-- Create a function to calculate total setlist duration including encore
CREATE OR REPLACE FUNCTION get_setlist_total_duration(p_setlist_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_seconds INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(COALESCE(s.duration_seconds, 180)), 0)
  INTO total_seconds
  FROM setlist_songs ss
  JOIN songs s ON s.id = ss.song_id
  WHERE ss.setlist_id = p_setlist_id;
  
  RETURN total_seconds;
END;
$$;

-- Create function to validate setlist duration for slot type
CREATE OR REPLACE FUNCTION validate_setlist_for_slot(
  p_setlist_id UUID,
  p_slot_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  total_duration INTEGER;
  max_duration INTEGER;
  slot_name TEXT;
  result JSONB;
BEGIN
  -- Get total setlist duration
  total_duration := get_setlist_total_duration(p_setlist_id);
  
  -- Determine max duration and slot name based on slot type
  CASE p_slot_type
    WHEN 'kids' THEN
      max_duration := 35 * 60;  -- 30 minute slot + 5 minute flex
      slot_name := 'Kids Slot (30 min slot + 5 min flex)';
    WHEN 'opening' THEN
      max_duration := 35 * 60;  -- 30 minute slot + 5 minute flex
      slot_name := 'Opening Slot (30 min slot + 5 min flex)';
    WHEN 'support' THEN
      max_duration := 50 * 60;  -- 45 minute slot + 5 minute flex
      slot_name := 'Support Slot (45 min slot + 5 min flex)';
    ELSE  -- headline or custom
      max_duration := 80 * 60;  -- 75 minute slot + 5 minute flex
      slot_name := 'Headline Slot (75 min slot + 5 min flex)';
  END CASE;
  
  -- Build result
  IF total_duration > max_duration THEN
    result := jsonb_build_object(
      'valid', false,
      'message', format('Setlist is %s min but %s allows max %s min', 
        (total_duration / 60)::TEXT,
        slot_name,
        (max_duration / 60)::TEXT
      ),
      'total_minutes', total_duration / 60,
      'max_minutes', max_duration / 60
    );
  ELSIF total_duration < (max_duration * 0.6) THEN
    result := jsonb_build_object(
      'valid', true,
      'message', format('Setlist is only %s min. Consider adding songs to fill the %s',
        (total_duration / 60)::TEXT,
        slot_name
      ),
      'total_minutes', total_duration / 60,
      'max_minutes', max_duration / 60
    );
  ELSE
    result := jsonb_build_object(
      'valid', true,
      'message', NULL,
      'total_minutes', total_duration / 60,
      'max_minutes', max_duration / 60
    );
  END IF;
  
  RETURN result;
END;
$$;