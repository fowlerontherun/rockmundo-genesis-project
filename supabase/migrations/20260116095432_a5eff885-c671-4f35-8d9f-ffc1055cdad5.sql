-- Fix UK/United Kingdom inconsistency
UPDATE radio_stations SET country = 'United Kingdom' WHERE country = 'UK';

-- Also fix any other common abbreviations
UPDATE radio_stations SET country = 'United States' WHERE country = 'USA';