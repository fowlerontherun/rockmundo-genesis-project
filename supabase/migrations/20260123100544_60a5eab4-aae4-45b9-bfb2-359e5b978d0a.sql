-- Fix band fans (MUST run first before any potential failure)
UPDATE bands SET total_fans = 
  CASE 
    WHEN fame >= 1000000 THEN GREATEST(total_fans, (fame * 0.05)::INTEGER)
    WHEN fame >= 100000 THEN GREATEST(total_fans, (fame * 0.03)::INTEGER)
    WHEN fame >= 10000 THEN GREATEST(total_fans, (fame * 0.02)::INTEGER)
    WHEN fame >= 1000 THEN GREATEST(total_fans, (fame * 0.01)::INTEGER)
    ELSE total_fans
  END
WHERE fame > 1000;