-- Add RLS policies for game_events table to allow admin operations

-- Allow authenticated users to insert game events (festivals)
CREATE POLICY "Authenticated users can create game events"
ON game_events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update game events
CREATE POLICY "Authenticated users can update game events"
ON game_events
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete game events
CREATE POLICY "Authenticated users can delete game events"
ON game_events
FOR DELETE
TO authenticated
USING (true);