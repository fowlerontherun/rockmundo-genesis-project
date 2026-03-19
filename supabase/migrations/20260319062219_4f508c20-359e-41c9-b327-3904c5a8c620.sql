-- Fix all release_formats where retail_price was stored in dollars instead of cents
-- Affected releases are those created after ~Feb 2026 where retail_price < 100
-- (legitimate prices in cents would be >= 100 for any reasonable retail price)
UPDATE release_formats
SET retail_price = retail_price * 100
WHERE retail_price > 0 AND retail_price < 100;