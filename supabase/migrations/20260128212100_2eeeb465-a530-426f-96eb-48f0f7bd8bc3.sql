-- Fix city_laws UPDATE policy to allow current mayors (not just who enacted)
DROP POLICY IF EXISTS "Only mayors can update their city laws" ON city_laws;
CREATE POLICY "Current mayors can update city laws" ON city_laws
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM city_mayors cm 
    WHERE cm.city_id = city_laws.city_id 
    AND cm.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()) 
    AND cm.is_current = true
  )
);

-- Add unique constraint for game_balance_config upserts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'game_balance_config_category_key_key'
  ) THEN
    ALTER TABLE game_balance_config 
    ADD CONSTRAINT game_balance_config_category_key_key UNIQUE (category, key);
  END IF;
END $$;

-- Add admin write policy for game_balance_config (using user_roles table)
DROP POLICY IF EXISTS "Admins can write game balance config" ON game_balance_config;
CREATE POLICY "Admins can write game balance config" ON game_balance_config
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);