BEGIN;
INSERT INTO public.universities (name, city, prestige, quality_of_learning, course_cost)
VALUES
  ('Rockmundo Conservatory', 'London', 92, 95, 18500.00),
  ('Skyline School of Sound', 'New York', 88, 90, 21000.00),
  ('Harbor Lights Institute', 'Portsmouth', 76, 82, 12500.00),
  ('Sunset Boulevard Music Academy', 'Los Angeles', 84, 87, 19850.00),
  ('Pulsewave Technology College', 'Toronto', 79, 85, 16200.00)
ON CONFLICT (name, city) DO UPDATE
SET prestige = EXCLUDED.prestige,
    quality_of_learning = EXCLUDED.quality_of_learning,
    course_cost = EXCLUDED.course_cost;
COMMIT;
