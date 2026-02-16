-- Set frequency for quadrennial events
UPDATE public.major_events SET frequency_years = 4 WHERE name IN (
  'Olympics Opening Ceremony', 'Olympics Closing Ceremony',
  'Winter Olympics Opening Ceremony', 'Winter Olympics Closing Ceremony',
  'Men''s World Cup Final', 'Women''s World Cup Final'
);

-- All others are annual (already default 1, but be explicit)
UPDATE public.major_events SET frequency_years = 1 WHERE frequency_years IS NULL OR name NOT IN (
  'Olympics Opening Ceremony', 'Olympics Closing Ceremony',
  'Winter Olympics Opening Ceremony', 'Winter Olympics Closing Ceremony',
  'Men''s World Cup Final', 'Women''s World Cup Final'
);