-- Add coastal and train network flags to cities
ALTER TABLE cities ADD COLUMN IF NOT EXISTS is_coastal boolean DEFAULT false;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS has_train_network boolean DEFAULT false;

-- Update coastal cities
UPDATE cities SET is_coastal = true WHERE name IN (
  'London', 'Liverpool', 'Bristol', 'Glasgow', 'Edinburgh', 'Brighton',
  'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Auckland',
  'Tokyo', 'Osaka', 'Yokohama', 'Fukuoka', 'Nagoya', 'Kyoto',
  'Miami', 'San Francisco', 'Seattle', 'Los Angeles', 'San Diego', 'Boston', 'New York',
  'Vancouver', 'Toronto', 'Montreal',
  'Hong Kong', 'Singapore', 'Mumbai', 'Chennai', 'Kolkata', 'Delhi',
  'Rio de Janeiro', 'São Paulo', 'Buenos Aires', 'Lima', 'Bogotá',
  'Barcelona', 'Marseille', 'Naples', 'Venice', 'Lisbon', 'Porto', 'Seville', 'Valencia',
  'Athens', 'Istanbul', 'Dubai', 'Tel Aviv', 'Beirut',
  'Cape Town', 'Lagos', 'Cairo', 'Casablanca', 'Johannesburg',
  'Copenhagen', 'Stockholm', 'Oslo', 'Helsinki', 'Amsterdam', 'Rotterdam',
  'Hamburg', 'Gdansk', 'Dublin',
  'Shanghai', 'Shenzhen', 'Guangzhou', 'Beijing', 'Busan', 'Seoul', 'Taipei',
  'Bangkok', 'Ho Chi Minh City', 'Hanoi', 'Jakarta', 'Manila', 'Kuala Lumpur'
);

-- Update cities with train networks (Europe and Asia mainly)
UPDATE cities SET has_train_network = true WHERE region IN ('Europe', 'Asia');

-- Also add train networks to major US/Canadian corridors
UPDATE cities SET has_train_network = true WHERE country IN ('United States', 'Canada') 
  AND name IN ('New York', 'Boston', 'Washington', 'Philadelphia', 'Chicago', 'Los Angeles', 'San Francisco', 'Seattle', 'Toronto', 'Montreal', 'Vancouver');