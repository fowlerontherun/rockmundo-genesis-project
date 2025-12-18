-- Seed comprehensive jobs for all cities
-- Food service jobs
INSERT INTO jobs (title, description, company_name, category, hourly_wage, required_level, health_impact_per_shift, fame_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, is_active, max_employees, city_id)
SELECT 
  j.title,
  j.description,
  j.company_name || ' - ' || c.name as company_name,
  j.category,
  (j.base_wage * (1 + COALESCE(c.cost_of_living, 50)::numeric / 200))::int as hourly_wage,
  j.required_level,
  j.health_impact,
  j.fame_impact,
  j.energy_cost,
  j.work_days::jsonb,
  j.start_time::time,
  j.end_time::time,
  true,
  j.max_emp,
  c.id as city_id
FROM cities c
CROSS JOIN (VALUES
  ('Barista', 'Make specialty coffee drinks and serve customers in a cozy café.', 'Local Coffee House', 'food_service', 14, 1, -4, 0, 15, '["monday","tuesday","wednesday","thursday","friday"]', '06:00', '12:00', 5),
  ('Server', 'Take orders and serve food in a busy restaurant.', 'Downtown Bistro', 'food_service', 16, 1, -5, 0, 18, '["tuesday","wednesday","thursday","friday","saturday"]', '11:00', '19:00', 8),
  ('Line Cook', 'Prepare dishes in a fast-paced kitchen environment.', 'The Kitchen', 'food_service', 18, 2, -8, 0, 25, '["monday","wednesday","thursday","friday","saturday"]', '14:00', '22:00', 4),
  ('Food Delivery Driver', 'Deliver food orders around the city on bike or scooter.', 'QuickEats', 'food_service', 15, 1, -6, 0, 20, '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]', '17:00', '23:00', 10)
) AS j(title, description, company_name, category, base_wage, required_level, health_impact, fame_impact, energy_cost, work_days, start_time, end_time, max_emp);

-- Retail jobs
INSERT INTO jobs (title, description, company_name, category, hourly_wage, required_level, health_impact_per_shift, fame_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, is_active, max_employees, city_id)
SELECT 
  j.title, j.description, j.company_name || ' - ' || c.name, j.category,
  (j.base_wage * (1 + COALESCE(c.cost_of_living, 50)::numeric / 200))::int,
  j.required_level, j.health_impact, j.fame_impact, j.energy_cost, j.work_days::jsonb, j.start_time::time, j.end_time::time, true, j.max_emp, c.id
FROM cities c
CROSS JOIN (VALUES
  ('Retail Associate', 'Help customers find products and stock shelves.', 'City Mart', 'retail', 15, 1, -3, 0, 12, '["monday","tuesday","thursday","friday","saturday"]', '09:00', '17:00', 6),
  ('Cashier', 'Process transactions at a busy retail store.', 'SuperStore', 'retail', 14, 1, -3, 0, 10, '["monday","tuesday","wednesday","thursday","friday"]', '08:00', '16:00', 8),
  ('Fashion Sales', 'Sell clothing and accessories in a trendy boutique.', 'Style House', 'retail', 16, 1, -2, 1, 10, '["wednesday","thursday","friday","saturday","sunday"]', '10:00', '18:00', 4)
) AS j(title, description, company_name, category, base_wage, required_level, health_impact, fame_impact, energy_cost, work_days, start_time, end_time, max_emp);

-- Music industry jobs
INSERT INTO jobs (title, description, company_name, category, hourly_wage, required_level, health_impact_per_shift, fame_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, is_active, max_employees, city_id)
SELECT 
  j.title, j.description, j.company_name || ' - ' || c.name, j.category,
  (j.base_wage * (1 + COALESCE(c.cost_of_living, 50)::numeric / 200))::int,
  j.required_level, j.health_impact, j.fame_impact, j.energy_cost, j.work_days::jsonb, j.start_time::time, j.end_time::time, true, j.max_emp, c.id
FROM cities c
CROSS JOIN (VALUES
  ('Music Store Clerk', 'Sell instruments and music gear to aspiring musicians.', 'Melody Music Shop', 'music_industry', 17, 1, -2, 2, 10, '["tuesday","wednesday","friday","saturday","sunday"]', '10:00', '18:00', 3),
  ('Roadie', 'Set up and break down equipment for live shows.', 'Stage Crew Services', 'music_industry', 22, 2, -12, 3, 30, '["thursday","friday","saturday","sunday"]', '16:00', '02:00', 6),
  ('Sound Tech Assistant', 'Assist with sound equipment at local venues.', 'Audio Pros', 'music_industry', 20, 2, -6, 2, 20, '["friday","saturday","sunday"]', '18:00', '02:00', 4),
  ('Studio Runner', 'Assist recording sessions and manage studio logistics.', 'Recording Hub', 'music_industry', 18, 1, -4, 3, 15, '["monday","tuesday","wednesday","thursday","friday"]', '10:00', '18:00', 3)
) AS j(title, description, company_name, category, base_wage, required_level, health_impact, fame_impact, energy_cost, work_days, start_time, end_time, max_emp);

-- Entertainment jobs
INSERT INTO jobs (title, description, company_name, category, hourly_wage, required_level, health_impact_per_shift, fame_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, is_active, max_employees, city_id)
SELECT 
  j.title, j.description, j.company_name || ' - ' || c.name, j.category,
  (j.base_wage * (1 + COALESCE(c.cost_of_living, 50)::numeric / 200))::int,
  j.required_level, j.health_impact, j.fame_impact, j.energy_cost, j.work_days::jsonb, j.start_time::time, j.end_time::time, true, j.max_emp, c.id
FROM cities c
CROSS JOIN (VALUES
  ('Venue Staff', 'Work at a live music venue checking tickets and serving.', 'The Live Room', 'entertainment', 16, 1, -6, 1, 18, '["thursday","friday","saturday","sunday"]', '18:00', '02:00', 10),
  ('Bouncer', 'Maintain security and check IDs at nightclubs.', 'Night Owl Club', 'entertainment', 20, 2, -10, 0, 25, '["friday","saturday","sunday"]', '21:00', '04:00', 4),
  ('DJ Assistant', 'Help DJs set up and manage music equipment.', 'Club Vibes', 'entertainment', 18, 1, -5, 2, 15, '["friday","saturday"]', '22:00', '04:00', 3),
  ('Event Staff', 'Work concerts and festivals assisting attendees.', 'Event Crew', 'entertainment', 17, 1, -7, 1, 20, '["friday","saturday","sunday"]', '12:00', '22:00', 8)
) AS j(title, description, company_name, category, base_wage, required_level, health_impact, fame_impact, energy_cost, work_days, start_time, end_time, max_emp);

-- Service jobs  
INSERT INTO jobs (title, description, company_name, category, hourly_wage, required_level, health_impact_per_shift, fame_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, is_active, max_employees, city_id)
SELECT 
  j.title, j.description, j.company_name || ' - ' || c.name, j.category,
  (j.base_wage * (1 + COALESCE(c.cost_of_living, 50)::numeric / 200))::int,
  j.required_level, j.health_impact, j.fame_impact, j.energy_cost, j.work_days::jsonb, j.start_time::time, j.end_time::time, true, j.max_emp, c.id
FROM cities c
CROSS JOIN (VALUES
  ('Night Security', 'Patrol buildings and monitor security cameras.', 'SecureGuard', 'service', 18, 1, -8, 0, 15, '["monday","tuesday","wednesday","thursday","friday"]', '22:00', '06:00', 4),
  ('Office Cleaner', 'Clean and maintain office spaces after hours.', 'CleanPro', 'service', 15, 1, -6, 0, 20, '["monday","tuesday","wednesday","thursday","friday"]', '18:00', '22:00', 6),
  ('Hotel Receptionist', 'Manage hotel check-ins and guest services.', 'City Hotel', 'hospitality', 17, 1, -3, 0, 12, '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]', '07:00', '15:00', 4),
  ('Tour Guide', 'Lead tours around the city for tourists.', 'City Tours', 'hospitality', 19, 2, -5, 2, 18, '["saturday","sunday"]', '09:00', '17:00', 5)
) AS j(title, description, company_name, category, base_wage, required_level, health_impact, fame_impact, energy_cost, work_days, start_time, end_time, max_emp);

-- Manual labor jobs
INSERT INTO jobs (title, description, company_name, category, hourly_wage, required_level, health_impact_per_shift, fame_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, is_active, max_employees, city_id)
SELECT 
  j.title, j.description, j.company_name || ' - ' || c.name, j.category,
  (j.base_wage * (1 + COALESCE(c.cost_of_living, 50)::numeric / 200))::int,
  j.required_level, j.health_impact, j.fame_impact, j.energy_cost, j.work_days::jsonb, j.start_time::time, j.end_time::time, true, j.max_emp, c.id
FROM cities c
CROSS JOIN (VALUES
  ('Warehouse Worker', 'Load and unload shipments in a busy warehouse.', 'Logistics Hub', 'manual_labor', 18, 1, -10, 0, 30, '["monday","tuesday","wednesday","thursday","friday"]', '06:00', '14:00', 8),
  ('Mover', 'Help people move furniture and belongings.', 'Quick Movers', 'manual_labor', 20, 1, -12, 0, 35, '["monday","tuesday","wednesday","thursday","friday","saturday"]', '08:00', '16:00', 6),
  ('Construction Helper', 'Assist on construction sites with various tasks.', 'BuildRight', 'manual_labor', 22, 2, -15, 0, 40, '["monday","tuesday","wednesday","thursday","friday"]', '07:00', '15:00', 5)
) AS j(title, description, company_name, category, base_wage, required_level, health_impact, fame_impact, energy_cost, work_days, start_time, end_time, max_emp);