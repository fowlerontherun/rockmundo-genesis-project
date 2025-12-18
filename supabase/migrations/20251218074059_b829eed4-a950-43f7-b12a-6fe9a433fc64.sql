-- Release system improvements migration

-- Add new columns to releases table
ALTER TABLE releases ADD COLUMN IF NOT EXISTS revenue_share_enabled boolean DEFAULT false;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS revenue_share_percentage integer DEFAULT 10;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS manufacturing_discount_percentage integer DEFAULT 50;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS is_greatest_hits boolean DEFAULT false;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS last_greatest_hits_date timestamptz;

-- Add tracking column to release_songs for album exclusivity
ALTER TABLE release_songs ADD COLUMN IF NOT EXISTS album_release_id uuid REFERENCES releases(id);

-- Update cancelled status to be allowed
-- First check what constraint exists and update if needed
DO $$ 
BEGIN
    -- Add 'cancelled' to allowed status if not already there
    -- This handles the constraint properly
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'releases_status_check'
    ) THEN
        ALTER TABLE releases ADD CONSTRAINT releases_status_check 
        CHECK (release_status IN ('draft', 'planned', 'manufacturing', 'released', 'cancelled'));
    ELSE
        ALTER TABLE releases DROP CONSTRAINT IF EXISTS releases_status_check;
        ALTER TABLE releases ADD CONSTRAINT releases_status_check 
        CHECK (release_status IN ('draft', 'planned', 'manufacturing', 'released', 'cancelled'));
    END IF;
END $$;

-- Reduce manufacturing costs by ~15%
UPDATE manufacturing_costs SET cost_per_unit = 43 WHERE format_type = 'cd' AND min_quantity = 1;
UPDATE manufacturing_costs SET cost_per_unit = 30 WHERE format_type = 'cd' AND min_quantity = 100;
UPDATE manufacturing_costs SET cost_per_unit = 21 WHERE format_type = 'cd' AND min_quantity = 500;
UPDATE manufacturing_costs SET cost_per_unit = 13 WHERE format_type = 'cd' AND min_quantity = 1000;

UPDATE manufacturing_costs SET cost_per_unit = 127 WHERE format_type = 'vinyl' AND min_quantity = 1;
UPDATE manufacturing_costs SET cost_per_unit = 102 WHERE format_type = 'vinyl' AND min_quantity = 100;
UPDATE manufacturing_costs SET cost_per_unit = 77 WHERE format_type = 'vinyl' AND min_quantity = 500;
UPDATE manufacturing_costs SET cost_per_unit = 60 WHERE format_type = 'vinyl' AND min_quantity = 1000;

-- Create function to check greatest hits eligibility (once per year, 10+ released songs)
CREATE OR REPLACE FUNCTION check_greatest_hits_eligibility(p_band_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_released_song_count integer;
    v_last_greatest_hits timestamptz;
    v_can_create boolean;
    v_reason text;
BEGIN
    -- Count released songs
    SELECT COUNT(DISTINCT rs.song_id)
    INTO v_released_song_count
    FROM release_songs rs
    JOIN releases r ON rs.release_id = r.id
    WHERE r.release_status = 'released'
    AND (r.band_id = p_band_id OR r.user_id = p_user_id)
    AND r.is_greatest_hits = false;

    -- Get last greatest hits date
    SELECT MAX(created_at)
    INTO v_last_greatest_hits
    FROM releases
    WHERE is_greatest_hits = true
    AND (band_id = p_band_id OR user_id = p_user_id);

    -- Check eligibility
    v_can_create := true;
    v_reason := NULL;

    IF v_released_song_count < 10 THEN
        v_can_create := false;
        v_reason := 'Need at least 10 released songs (have ' || v_released_song_count || ')';
    ELSIF v_last_greatest_hits IS NOT NULL AND v_last_greatest_hits > NOW() - INTERVAL '1 year' THEN
        v_can_create := false;
        v_reason := 'Can only create one greatest hits album per year';
    END IF;

    RETURN jsonb_build_object(
        'eligible', v_can_create,
        'released_song_count', v_released_song_count,
        'last_greatest_hits_date', v_last_greatest_hits,
        'reason', v_reason
    );
END;
$$;

-- Create function to get songs already on albums (for exclusivity check)
CREATE OR REPLACE FUNCTION get_songs_on_albums(p_band_id uuid, p_user_id uuid)
RETURNS TABLE(song_id uuid, album_title text, release_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT rs.song_id, r.title as album_title, r.id as release_id
    FROM release_songs rs
    JOIN releases r ON rs.release_id = r.id
    WHERE r.release_type = 'album'
    AND r.is_greatest_hits = false
    AND r.release_status != 'cancelled'
    AND (r.band_id = p_band_id OR r.user_id = p_user_id);
END;
$$;