-- Fix null cash/fame/level values
UPDATE profiles SET cash = 10000 WHERE cash IS NULL;
UPDATE profiles SET fame = 0 WHERE fame IS NULL;
UPDATE profiles SET level = 1 WHERE level IS NULL;

-- Add NOT NULL constraints with defaults to prevent future nulls
ALTER TABLE profiles ALTER COLUMN cash SET DEFAULT 10000;
ALTER TABLE profiles ALTER COLUMN cash SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN fame SET DEFAULT 0;
ALTER TABLE profiles ALTER COLUMN fame SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN level SET DEFAULT 1;
ALTER TABLE profiles ALTER COLUMN level SET NOT NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';