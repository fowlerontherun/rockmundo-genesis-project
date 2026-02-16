
INSERT INTO jobs (title, category, description, company_name, hourly_wage, required_level, health_impact_per_shift, energy_cost_per_shift, fame_impact_per_shift, base_fame_impact, start_time, end_time, work_days, city_id, is_active, max_employees, current_employees)
SELECT 
  t.title, t.category, t.description,
  t.company_prefix || ' - ' || c.name AS company_name,
  t.hourly_wage, t.required_level, t.health_impact_per_shift, t.energy_cost_per_shift,
  t.fame_impact_per_shift, t.base_fame_impact, t.start_time::time, t.end_time::time,
  t.work_days::jsonb, c.id AS city_id, true, 5, 0
FROM cities c
CROSS JOIN (VALUES
  ('Barista','food_service','Make coffee and serve customers in a busy café.','Daily Grind',14,1,-3,15,0,0,'06:00:00','14:00:00','["monday","tuesday","wednesday","thursday","friday","saturday"]'),
  ('Dishwasher','food_service','Wash dishes in restaurant kitchens. Hot, humid, and physically demanding.','DishDash',13,1,-6,25,-2,-2,'18:00:00','23:00:00','["monday","tuesday","wednesday","thursday","friday","saturday"]'),
  ('Line Cook','food_service','Prepare dishes in a fast-paced kitchen environment.','The Kitchen',23,2,-8,25,0,0,'14:00:00','22:00:00','["monday","wednesday","thursday","friday","saturday"]'),
  ('Food Delivery Driver','food_service','Deliver food orders around the city on bike or scooter.','QuickEats',18,1,-6,20,0,0,'17:00:00','23:00:00','["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]'),
  ('Record Store Clerk','retail','Sell vinyl and CDs to music lovers. Great for building music knowledge.','Vinyl Vibes',15,1,-2,12,1,1,'10:00:00','18:00:00','["monday","tuesday","wednesday","thursday","friday","saturday"]'),
  ('Clothing Store Assistant','retail','Help customers find outfits and manage stock.','Style Hub',14,1,-2,12,0,0,'09:00:00','17:00:00','["monday","tuesday","wednesday","thursday","friday","saturday"]'),
  ('Studio Runner','music_industry','Assist recording sessions and manage studio logistics.','Recording Hub',25,1,-4,15,3,3,'10:00:00','18:00:00','["monday","tuesday","wednesday","thursday","friday"]'),
  ('Music Blog Writer','music_industry','Write music reviews and articles. Stay connected to the scene.','MusicBeat Magazine',20,3,-2,15,3,3,'10:00:00','18:00:00','["monday","tuesday","wednesday","thursday","friday"]'),
  ('Sound Tech Assistant','music_industry','Assist with sound equipment at local venues.','Audio Pros',27,2,-6,20,2,2,'18:00:00','02:00:00','["friday","saturday","sunday"]'),
  ('Session Musician','music_industry','Play as a hired gun on other artists recordings.','Session Stars Agency',35,5,-5,25,5,5,'14:00:00','22:00:00','["tuesday","wednesday","thursday","friday"]'),
  ('Venue Sound Tech','entertainment','Run sound at local venues. Meet touring bands.','Live Sound Pro',28,3,-4,20,2,2,'17:00:00','01:00:00','["thursday","friday","saturday","sunday"]'),
  ('Street Performer','entertainment','Perform on busy streets for tips. Great exposure.','Self-Employed',10,1,-5,20,2,2,'12:00:00','18:00:00','["friday","saturday","sunday"]'),
  ('Hotel Front Desk','hospitality','Check guests in and out. Customer service skills required.','Grand Hotel',16,2,-3,15,0,0,'07:00:00','15:00:00','["monday","tuesday","wednesday","thursday","friday"]'),
  ('Bartender','hospitality','Mix drinks and manage the bar. Great for networking.','The Lounge',20,2,-5,20,1,1,'20:00:00','03:00:00','["wednesday","thursday","friday","saturday"]'),
  ('Car Wash Attendant','service','Wash and detail cars. Outdoor physical work.','Sparkle Auto Wash',11,1,-5,20,-2,-2,'08:00:00','16:00:00','["monday","tuesday","wednesday","thursday","friday","saturday"]'),
  ('Dog Walker','service','Walk dogs around the neighbourhood. Light physical work.','Paws & Go',12,1,2,10,0,0,'07:00:00','12:00:00','["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]'),
  ('Warehouse Worker','manual_labor','Load and unload shipments. Heavy physical labour.','LogiCrate',17,1,-10,35,-3,-3,'06:00:00','14:00:00','["monday","tuesday","wednesday","thursday","friday"]'),
  ('Garbage Collector','manual_labor','Collect and dispose of waste. Very physically demanding.','City Waste Services',16,1,-12,40,-4,-4,'04:00:00','10:00:00','["monday","tuesday","wednesday","thursday","friday"]'),
  ('Construction Labourer','manual_labor','General construction site work. Dangerous but pays okay.','BuildRight',19,1,-10,35,-2,-2,'07:00:00','15:00:00','["monday","tuesday","wednesday","thursday","friday"]'),
  ('Tattoo Apprentice','creative','Learn tattooing under a master artist. Creative and trendy.','Ink Studio',12,2,-3,15,1,1,'11:00:00','19:00:00','["tuesday","wednesday","thursday","friday","saturday"]'),
  ('Nightclub Promoter','entertainment','Promote club nights and manage guest lists. Networking heaven.','Nite Life',22,2,-4,18,3,3,'21:00:00','04:00:00','["thursday","friday","saturday"]')
) AS t(title, category, description, company_prefix, hourly_wage, required_level, health_impact_per_shift, energy_cost_per_shift, fame_impact_per_shift, base_fame_impact, start_time, end_time, work_days)
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE city_id IS NOT NULL);
