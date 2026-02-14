-- Migrate existing song quality scores from 0-100 scale to 0-1000 scale
UPDATE songs SET quality_score = quality_score * 10 WHERE quality_score IS NOT NULL AND quality_score <= 100;