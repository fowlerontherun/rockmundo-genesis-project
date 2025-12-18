-- Seed universities (2 per city)
INSERT INTO public.universities (name, city, prestige, quality_of_learning, course_cost_modifier, description)
SELECT 
  c.name || ' ' || uni_data.uni_suffix,
  c.name,
  uni_data.prestige,
  uni_data.quality_of_learning,
  uni_data.course_cost_modifier,
  uni_data.description
FROM cities c
CROSS JOIN (VALUES
  ('School of Music', 65, 70, 1.0, 'Local music school offering practical courses'),
  ('Conservatory of Arts', 85, 88, 1.5, 'Prestigious conservatory with renowned faculty')
) AS uni_data(uni_suffix, prestige, quality_of_learning, course_cost_modifier, description)
ON CONFLICT (name, city) DO NOTHING;