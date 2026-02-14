-- Deflate existing song quality scores to reflect early-game skill levels
-- Songs at 1000 (from the 10x migration) should be more like 400-500
-- Apply a 0.45 multiplier with some variance based on original score
-- Cap at 500 since no early-game song should be near-perfect
UPDATE songs 
SET quality_score = LEAST(500, GREATEST(50, ROUND(quality_score * 0.45)))
WHERE quality_score IS NOT NULL AND quality_score > 0;