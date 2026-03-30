-- Recalculate Fratton Park capacity based on actual upgrade levels
-- Base capacity was likely 100, with 7 capacity upgrades: sum of (50 + level*25) for levels 1-7 = 1050
-- Correct capacity = 100 + 1050 = 1150
UPDATE venues 
SET capacity = 1150
WHERE id = 'c754301c-b7ab-4e01-97bf-4da324498c03';
