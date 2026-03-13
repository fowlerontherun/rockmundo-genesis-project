-- Set base character slots to 2 for all players.
ALTER TABLE public.character_slots
  ALTER COLUMN max_slots SET DEFAULT 2;

-- Backfill older rows that still have 1 slot and no purchased extras.
UPDATE public.character_slots
SET max_slots = 2,
    updated_at = now()
WHERE max_slots < 2
  AND extra_slots_purchased = 0;
