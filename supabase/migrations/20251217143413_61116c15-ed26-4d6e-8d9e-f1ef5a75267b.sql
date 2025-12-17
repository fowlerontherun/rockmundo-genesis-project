-- Enable realtime for twaats table
ALTER TABLE twaats REPLICA IDENTITY FULL;

-- Add to realtime publication (if not already there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'twaats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE twaats;
  END IF;
END $$;