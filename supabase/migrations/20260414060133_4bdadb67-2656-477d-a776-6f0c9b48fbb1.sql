-- Reduce all physical manufacturing costs by 10%
UPDATE manufacturing_costs 
SET cost_per_unit = ROUND(cost_per_unit * 0.9)
WHERE format_type IN ('vinyl', 'cd', 'cassette');

-- Create auto-hype function based on fame and fans
CREATE OR REPLACE FUNCTION public.auto_build_release_hype()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  band_fame INT;
  band_fans INT;
  hype_gain NUMERIC;
BEGIN
  -- Process all active releases (draft, manufacturing, or released within 90 days)
  FOR r IN 
    SELECT rel.id AS release_id, rel.band_id, rel.hype_score, rel.release_status
    FROM releases rel
    WHERE rel.band_id IS NOT NULL
      AND (
        rel.release_status IN ('draft', 'manufacturing')
        OR (rel.release_status = 'released' AND rel.created_at > NOW() - INTERVAL '90 days')
      )
      AND (rel.hype_score IS NULL OR rel.hype_score < 1000)
  LOOP
    -- Get band fame and fans
    SELECT COALESCE(b.fame, 0), COALESCE(b.total_fans, 0)
    INTO band_fame, band_fans
    FROM bands b
    WHERE b.id = r.band_id;

    -- Calculate hype gain: base 1-3 + fame bonus (0-5) + fan bonus (0-5)
    -- Fame bonus: fame/200 capped at 5
    -- Fan bonus: log10(fans+1) capped at 5
    hype_gain := 1 + RANDOM() * 2
      + LEAST(band_fame::NUMERIC / 200, 5)
      + LEAST(LOG(GREATEST(band_fans, 1) + 1), 5);
    
    -- Round to integer
    hype_gain := ROUND(hype_gain);
    
    -- Update the release hype, capped at 1000
    UPDATE releases
    SET hype_score = LEAST(COALESCE(hype_score, 0) + hype_gain, 1000)
    WHERE id = r.release_id;
  END LOOP;
END;
$$;